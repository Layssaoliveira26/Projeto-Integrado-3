// mobile/src/repositories/syncQueueRepository.js
import { getDbConnection } from "../database/index";
import { gerarUUID } from "../utils/uuid";

/**
 * Registra uma operação na fila local de sincronização (Outbox Pattern).
 * Aplica coalescência (coalescing) quando já existe um item pendente para o mesmo registro,
 * evitando tráfego redundante quando o usuário edita ou exclui algo ainda offline.
 *
 * @param {Object} params
 * @param {string} params.tabelaReferencia - Ex: 'obras', 'planilhas_base', 'ciclos_medicao', 'medicoes', 'fotografias'
 * @param {string} params.registroId - UUID do registro afetado
 * @param {'insert'|'update'|'delete'} params.operacao - Tipo de mutação
 * @param {Object|null} [params.payload] - Snapshot dos dados do registro
 * @param {Object} [dbOverride] - Conexão opcional para injeção em testes unitários
 */
export const enfileirarOperacao = async (
  { tabelaReferencia, registroId, operacao, payload = null },
  dbOverride = null
) => {
  if (!tabelaReferencia || !registroId || !operacao) {
    throw new Error(
      "tabelaReferencia, registroId e operacao são obrigatórios na fila de sincronização."
    );
  }

  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  const payloadStr =
    payload !== null && payload !== undefined
      ? typeof payload === "string"
        ? payload
        : JSON.stringify(payload)
      : null;

  // Verifica se já existe operação pendente ou com erro para a mesma entidade e registro
  const existente = await db.getFirstAsync(
    `SELECT * FROM fila_sincronizacao
     WHERE tabela_referencia = ? AND registro_id = ? AND status IN ('pendente', 'erro')
     ORDER BY created_at DESC LIMIT 1;`,
    [tabelaReferencia, String(registroId)]
  );

  if (existente) {
    // Caso 1: Foi criado offline ('insert') e agora excluído ('delete') antes de sincronizar -> cancela ambos
    if (existente.operacao === "insert" && operacao === "delete") {
      await db.runAsync(`DELETE FROM fila_sincronizacao WHERE id = ?;`, [
        existente.id,
      ]);
      return { id: existente.id, acao: "cancelado_antes_do_envio" };
    }

    // Caso 2: Foi criado offline ('insert') e agora atualizado ('update') -> mantém como 'insert' com o payload mesclado
    if (existente.operacao === "insert" && operacao === "update") {
      let payloadMesclado = payloadStr;
      try {
        const objAnterior = existente.payload ? JSON.parse(existente.payload) : {};
        const objNovo = payloadStr ? JSON.parse(payloadStr) : {};
        payloadMesclado = JSON.stringify({ ...objAnterior, ...objNovo });
      } catch {
        payloadMesclado = payloadStr;
      }

      await db.runAsync(
        `UPDATE fila_sincronizacao
         SET payload = ?, status = 'pendente', ultimo_erro = NULL, updated_at = ?
         WHERE id = ?;`,
        [payloadMesclado, agora, existente.id]
      );
      return { id: existente.id, acao: "atualizado_no_insert" };
    }

    // Caso 3: Atualizações repetidas ('update' -> 'update') ou ('update' -> 'delete') -> sobrescreve com a última operação
    await db.runAsync(
      `UPDATE fila_sincronizacao
       SET operacao = ?, payload = ?, status = 'pendente', ultimo_erro = NULL, updated_at = ?
       WHERE id = ?;`,
      [operacao, payloadStr, agora, existente.id]
    );
    return { id: existente.id, acao: "coalescido" };
  }

  const id = gerarUUID();
  await db.runAsync(
    `INSERT INTO fila_sincronizacao (
      id, tabela_referencia, registro_id, operacao, payload, status, tentativas, ultimo_erro, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'pendente', 0, NULL, ?, ?);`,
    [id, tabelaReferencia, String(registroId), operacao, payloadStr, agora, agora]
  );

  return { id, acao: "inserido" };
};

/**
 * Lista todos os itens aguardando sincronização ('pendente' ou 'erro'),
 * ordenados pela ordem de criação (FIFO).
 */
export const listarItensPendentes = async (dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const rows = await db.getAllAsync(
    `SELECT * FROM fila_sincronizacao
     WHERE status IN ('pendente', 'erro')
     ORDER BY created_at ASC;`
  );

  return (rows || []).map((row) => {
    let parsedPayload = null;
    if (row.payload) {
      try {
        parsedPayload = JSON.parse(row.payload);
      } catch {
        parsedPayload = row.payload;
      }
    }
    return {
      ...row,
      payloadObj: parsedPayload,
    };
  });
};

/**
 * Marca um item da fila como 'sincronizado'.
 */
export const marcarItemSincronizado = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'sincronizado', ultimo_erro = NULL, updated_at = ?
     WHERE id = ?;`,
    [agora, id]
  );
};

/**
 * Registra falha na tentativa de sincronização de um item, incrementando o contador
 * e preservando o item para nova tentativa posterior.
 */
export const registrarFalhaItem = async (
  id,
  mensagemErro = "Falha de comunicação com o servidor",
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'erro',
         tentativas = COALESCE(tentativas, 0) + 1,
         ultimo_erro = ?,
         updated_at = ?
     WHERE id = ?;`,
    [String(mensagemErro), agora, id]
  );
};

/**
 * Obtém o resumo quantitativo da fila para exibição de status na UI.
 */
export const obterResumoFila = async (dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const rows = await db.getAllAsync(
    `SELECT status, COUNT(*) AS total
     FROM fila_sincronizacao
     WHERE status IN ('pendente', 'erro')
     GROUP BY status;`
  );

  let pendentes = 0;
  let erros = 0;

  for (const row of rows || []) {
    if (row.status === "pendente") pendentes += Number(row.total || 0);
    if (row.status === "erro") erros += Number(row.total || 0);
  }

  return {
    pendentes,
    erros,
    totalNaoSincronizados: pendentes + erros,
  };
};

/**
 * Remove itens já sincronizados antigos para manter o banco enxuto.
 */
export const limparSincronizados = async (dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  await db.runAsync(
    `DELETE FROM fila_sincronizacao WHERE status = 'sincronizado';`
  );
};

export default {
  enfileirarOperacao,
  listarItensPendentes,
  marcarItemSincronizado,
  registrarFalhaItem,
  obterResumoFila,
  limparSincronizados,
};

