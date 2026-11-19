// mobile/src/repositories/syncQueueRepository.js
import { getDbConnection } from "../database/index";
import { gerarUUID } from "../utils/uuid";

const inferirAcaoOperacao = (tabelaReferencia, operacao, payloadObj = null) => {
  if (tabelaReferencia === "obras" && operacao === "update") {
    if (payloadObj?.acao === "arquivar" || payloadObj?.status === "arquivada") {
      return "arquivar";
    }
    if (payloadObj?.acao === "encerrar" || payloadObj?.status === "encerrada") {
      return "encerrar";
    }
    return "atualizar_dados";
  }
  return payloadObj?.acao || operacao;
};

const obterCategoriaCoalescencia = (tabelaReferencia, operacao, acao) => {
  if (tabelaReferencia === "obras" && operacao === "update") {
    if (acao === "arquivar" || acao === "encerrar") {
      return "obras:alterar_status";
    }
    return "obras:atualizar_dados";
  }
  return `${tabelaReferencia}:${acao || operacao}`;
};

const normalizarUsuarioIdValido = (usuarioId) => {
  if (usuarioId === null || usuarioId === undefined) return null;
  const limpo = String(usuarioId).trim();
  if (!limpo || limpo === "local_user") return null;
  return limpo;
};

const parsePayloadSeguro = (payload) => {
  if (payload === null || payload === undefined) return null;
  if (typeof payload === "object") return payload;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Registra uma operação na fila local de sincronização (Outbox Pattern).
 * Aplica coalescência segura apenas sobre itens ainda não enviados ('pendente' ou 'erro'),
 * preservando itens em trânsito ('enviando') e separando intenções de negócio distintas (acao).
 *
 * @param {Object} params
 * @param {string} params.tabelaReferencia - Ex: 'obras', 'planilhas_base', 'ciclos_medicao', 'medicoes', 'fotografias'
 * @param {string} params.registroId - UUID do registro afetado
 * @param {'insert'|'update'|'delete'} params.operacao - Tipo de mutação
 * @param {string|null} [params.acao] - Intenção explícita (ex: 'atualizar_dados', 'arquivar', 'encerrar')
 * @param {string|null} [params.usuarioId] - Dono da operação para isolamento multi-usuário
 * @param {Object|string|null} [params.payload] - Snapshot dos dados do registro
 * @param {Object} [dbOverride] - Conexão opcional para injeção em testes unitários
 */
export const enfileirarOperacao = async (
  {
    tabelaReferencia,
    registroId,
    operacao,
    acao = null,
    usuarioId = null,
    payload = null,
  },
  dbOverride = null
) => {
  if (!tabelaReferencia || !registroId || !operacao) {
    throw new Error(
      "tabelaReferencia, registroId e operacao são obrigatórios na fila de sincronização."
    );
  }

  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  const payloadParsed = parsePayloadSeguro(payload);
  const acaoNormalizada =
    acao || inferirAcaoOperacao(tabelaReferencia, operacao, payloadParsed);
  const usuarioEfetivo = normalizarUsuarioIdValido(
    usuarioId || payloadParsed?.usuario_id
  );

  const payloadStr =
    payload !== null && payload !== undefined
      ? typeof payload === "string"
        ? payload
        : JSON.stringify(payload)
      : null;

  // Nunca coalesce sobre itens 'enviando' nem mistura pendências de usuários distintos
  const filtroUsuarioSql = usuarioEfetivo
    ? `AND usuario_id = ?`
    : `AND (usuario_id IS NULL OR usuario_id = '' OR usuario_id = 'local_user')`;
  const paramsExistentes = usuarioEfetivo
    ? [tabelaReferencia, String(registroId), usuarioEfetivo]
    : [tabelaReferencia, String(registroId)];

  const existentes =
    (await db.getAllAsync(
      `SELECT * FROM fila_sincronizacao
       WHERE tabela_referencia = ? AND registro_id = ? AND status IN ('pendente', 'erro')
         ${filtroUsuarioSql}
       ORDER BY created_at DESC, rowid DESC;`,
      paramsExistentes
    )) || [];

  const existenteInsert = existentes.find((e) => e.operacao === "insert");

  // Caso 1: Foi criado offline ('insert') ainda não enviado e agora excluído ('delete') -> cancela pendências locais do mesmo usuário
  if (existenteInsert && operacao === "delete") {
    await db.runAsync(
      `DELETE FROM fila_sincronizacao
       WHERE tabela_referencia = ? AND registro_id = ? AND status IN ('pendente', 'erro')
         ${filtroUsuarioSql};`,
      paramsExistentes
    );
    return { id: existenteInsert.id, acao: "cancelado_antes_do_envio" };
  }

  // Caso 2: Foi criado offline ('insert') ainda não enviado e agora atualizado ('update') -> mantém 'insert' mesclado
  if (existenteInsert && operacao === "update") {
    let payloadMesclado = payloadStr;
    try {
      const objAnterior = existenteInsert.payload
        ? JSON.parse(existenteInsert.payload)
        : {};
      const objNovo = payloadStr ? JSON.parse(payloadStr) : {};
      payloadMesclado = JSON.stringify({ ...objAnterior, ...objNovo });
    } catch {
      payloadMesclado = payloadStr;
    }

    await db.runAsync(
      `UPDATE fila_sincronizacao
       SET payload = ?,
           usuario_id = COALESCE(?, usuario_id),
           status = 'pendente',
           erro_permanente = 0,
           proxima_tentativa_em = NULL,
           ultimo_erro = NULL,
           updated_at = ?
       WHERE id = ?;`,
      [payloadMesclado, usuarioEfetivo, agora, existenteInsert.id]
    );
    return { id: existenteInsert.id, acao: "atualizado_no_insert" };
  }

  // Caso 3: Exclusão de registro já sincronizado (ou cujo insert já está em voo): substitui pendências 'update' anteriores do mesmo usuário
  if (operacao === "delete" && existentes.length > 0) {
    const existenteDelete = existentes.find((e) => e.operacao === "delete");
    const alvo = existenteDelete || existentes[0];
    const paramsDelete = usuarioEfetivo
      ? [tabelaReferencia, String(registroId), alvo.id, usuarioEfetivo]
      : [tabelaReferencia, String(registroId), alvo.id];

    await db.runAsync(
      `DELETE FROM fila_sincronizacao
       WHERE tabela_referencia = ? AND registro_id = ? AND status IN ('pendente', 'erro') AND id != ?
         ${filtroUsuarioSql};`,
      paramsDelete
    );

    await db.runAsync(
      `UPDATE fila_sincronizacao
       SET operacao = 'delete',
           acao = ?,
           payload = ?,
           usuario_id = COALESCE(?, usuario_id),
           status = 'pendente',
           erro_permanente = 0,
           proxima_tentativa_em = NULL,
           ultimo_erro = NULL,
           updated_at = ?
       WHERE id = ?;`,
      [acaoNormalizada, payloadStr, usuarioEfetivo, agora, alvo.id]
    );
    return { id: alvo.id, acao: "coalescido" };
  }

  // Caso 4: Atualizações da mesma intenção (categoria de ação) são coalescidas; intenções distintas coexistem na ordem
  if (operacao === "update" && existentes.length > 0) {
    const categoriaNova = obterCategoriaCoalescencia(
      tabelaReferencia,
      operacao,
      acaoNormalizada
    );

    const mesmaIntencao = existentes.find((e) => {
      if (e.operacao !== "update") return false;
      const acaoExistente =
        e.acao ||
        inferirAcaoOperacao(
          e.tabela_referencia,
          e.operacao,
          parsePayloadSeguro(e.payload)
        );
      return (
        obterCategoriaCoalescencia(
          e.tabela_referencia,
          e.operacao,
          acaoExistente
        ) === categoriaNova
      );
    });

    if (mesmaIntencao) {
      await db.runAsync(
        `UPDATE fila_sincronizacao
         SET operacao = ?,
             acao = ?,
             payload = ?,
             usuario_id = COALESCE(?, usuario_id),
             status = 'pendente',
             erro_permanente = 0,
             proxima_tentativa_em = NULL,
             ultimo_erro = NULL,
             updated_at = ?
         WHERE id = ?;`,
        [
          operacao,
          acaoNormalizada,
          payloadStr,
          usuarioEfetivo,
          agora,
          mesmaIntencao.id,
        ]
      );
      return { id: mesmaIntencao.id, acao: "coalescido" };
    }
  }

  const id = gerarUUID();
  await db.runAsync(
    `INSERT INTO fila_sincronizacao (
      id, tabela_referencia, registro_id, operacao, acao, usuario_id, payload,
      status, tentativas, erro_permanente, proxima_tentativa_em, ultimo_erro, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pendente', 0, 0, NULL, NULL, ?, ?);`,
    [
      id,
      tabelaReferencia,
      String(registroId),
      operacao,
      acaoNormalizada,
      usuarioEfetivo,
      payloadStr,
      agora,
      agora,
    ]
  );

  return { id, acao: "inserido" };
};

/**
 * Reverte itens presos no estado 'enviando' caso o app tenha sido fechado/reiniciado no meio de um Push.
 */
export const recuperarItensEmVooInterrompidos = async (dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'pendente', updated_at = ?
     WHERE status = 'enviando';`,
    [agora]
  );
};

/**
 * Marca um lote de itens como 'enviando' (in-flight) antes do envio HTTP.
 */
export const marcarItensEnviando = async (ids = [], dbOverride = null) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'enviando', updated_at = ?
     WHERE id IN (${placeholders});`,
    [agora, ...ids.map(String)]
  );
};

/**
 * Reverte itens de um lote 'enviando' para 'pendente' quando a chamada HTTP falha antes de resposta do servidor.
 */
export const reverterItensParaPendente = async (ids = [], dbOverride = null) => {
  if (!Array.isArray(ids) || ids.length === 0) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  const placeholders = ids.map(() => "?").join(", ");
  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'pendente', updated_at = ?
     WHERE id IN (${placeholders}) AND status = 'enviando';`,
    [agora, ...ids.map(String)]
  );
};

/**
 * Verifica se ainda existe alguma outra pendência ativa na fila para o mesmo registro,
 * evitando marcar sync_status = 'synced' prematuramente quando houve nova edição durante o Push.
 */
export const possuiOutraPendenciaAtiva = async (
  tabelaReferencia,
  registroId,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const row = await db.getFirstAsync(
    `SELECT id FROM fila_sincronizacao
     WHERE tabela_referencia = ? AND registro_id = ?
       AND status IN ('pendente', 'enviando')
       AND COALESCE(erro_permanente, 0) = 0
     LIMIT 1;`,
    [tabelaReferencia, String(registroId)]
  );
  return Boolean(row);
};

/**
 * Consulta o estado da operação de criação (insert) na fila para o registro informado,
 * permitindo ao pipeline de mídia aguardar o metadado subir ou abortar caso haja erro permanente.
 */
export const possuiPendenciaOuErroMetadado = async (
  tabelaReferencia,
  registroId,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  return await db.getFirstAsync(
    `SELECT status, COALESCE(erro_permanente, 0) AS erro_permanente
     FROM fila_sincronizacao
     WHERE tabela_referencia = ? AND registro_id = ?
       AND operacao = 'insert'
       AND status IN ('pendente', 'enviando', 'erro')
     ORDER BY rowid DESC
     LIMIT 1;`,
    [tabelaReferencia, String(registroId)]
  );
};

/**
 * Lista itens aguardando sincronização ('pendente' ou 'erro' retentável),
 * ordenados pela ordem de criação (FIFO) com suporte a paginação, isolamento por usuário e backoff.
 */
export const listarItensPendentes = async (dbOverride = null, opcoes = {}) => {
  const db = dbOverride || (await getDbConnection());
  const { usuarioId = null, limite = 40, ignorarBackoff = false } = opcoes || {};
  const usuarioNormalizado = normalizarUsuarioIdValido(usuarioId);
  if (!usuarioNormalizado) {
    return [];
  }

  const agora = new Date().toISOString();

  let sql = `SELECT rowid AS ordem_fila, * FROM fila_sincronizacao
     WHERE status IN ('pendente', 'erro')
       AND tabela_referencia != 'usuarios'
       AND COALESCE(erro_permanente, 0) = 0
       AND usuario_id = ?`;
  const params = [usuarioNormalizado];

  if (!ignorarBackoff) {
    sql += ` AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)`;
    params.push(agora);
  }

  sql += ` ORDER BY created_at ASC, rowid ASC`;

  if (limite && Number(limite) > 0) {
    sql += ` LIMIT ?`;
    params.push(Number(limite));
  }

  sql += `;`;

  const rows = await db.getAllAsync(sql, params);

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
     SET status = 'sincronizado',
         erro_permanente = 0,
         proxima_tentativa_em = NULL,
         ultimo_erro = NULL,
         updated_at = ?
     WHERE id = ?;`,
    [agora, id]
  );
};

/**
 * Registra falha na tentativa de sincronização de um item, aplicando backoff exponencial
 * ou marcando como erro permanente para evitar loops infinitos em erros 4xx definitivos.
 */
export const registrarFalhaItem = async (
  id,
  mensagemErro = "Falha de comunicação com o servidor",
  dbOverride = null,
  opcoes = {}
) => {
  const db = dbOverride || (await getDbConnection());
  const agoraMs = Date.now();
  const agora = new Date(agoraMs).toISOString();
  const permanenteFlag = Boolean(opcoes?.permanente);

  const atual = await db
    .getFirstAsync(`SELECT tentativas FROM fila_sincronizacao WHERE id = ?;`, [
      id,
    ])
    .catch(() => null);
  const tentativasAnteriores = Number(atual?.tentativas || 0);
  const novasTentativas = tentativasAnteriores + 1;
  const ehPermanente = permanenteFlag || novasTentativas >= 8 ? 1 : 0;

  let proximaTentativa = null;
  if (!ehPermanente) {
    const atrasoSegundos = Math.min(300, Math.pow(2, novasTentativas) * 5);
    proximaTentativa = new Date(agoraMs + atrasoSegundos * 1000).toISOString();
  }

  await db.runAsync(
    `UPDATE fila_sincronizacao
     SET status = 'erro',
         tentativas = ?,
         erro_permanente = ?,
         proxima_tentativa_em = ?,
         ultimo_erro = ?,
         updated_at = ?
     WHERE id = ?;`,
    [
      novasTentativas,
      ehPermanente,
      proximaTentativa,
      String(mensagemErro),
      agora,
      id,
    ]
  );
};

/**
 * Obtém o resumo quantitativo da fila para exibição de status na UI.
 */
export const obterResumoFila = async (dbOverride = null, usuarioId = null) => {
  const usuarioNormalizado = normalizarUsuarioIdValido(usuarioId);
  if (!usuarioNormalizado) {
    return {
      pendentes: 0,
      erros: 0,
      errosPermanentes: 0,
      totalNaoSincronizados: 0,
    };
  }

  const db = dbOverride || (await getDbConnection());
  const sql = `SELECT status, COALESCE(erro_permanente, 0) AS erro_permanente, COUNT(*) AS total
     FROM fila_sincronizacao
     WHERE status IN ('pendente', 'enviando', 'erro')
       AND tabela_referencia != 'usuarios'
       AND usuario_id = ?
     GROUP BY status, COALESCE(erro_permanente, 0);`;
  const params = [usuarioNormalizado];

  const rows = await db.getAllAsync(sql, params);

  let pendentes = 0;
  let erros = 0;
  let errosPermanentes = 0;

  for (const row of rows || []) {
    const qtd = Number(row.total || 0);
    if (row.status === "pendente" || row.status === "enviando") {
      pendentes += qtd;
    } else if (row.status === "erro") {
      if (Number(row.erro_permanente) === 1) {
        errosPermanentes += qtd;
      } else {
        erros += qtd;
      }
    }
  }

  return {
    pendentes,
    erros,
    errosPermanentes,
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

/**
 * Lê um metadado de sincronização (ex: cursor since por usuário) da tabela sync_meta.
 */
export const obterMetaSync = async (chave, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const row = await db.getFirstAsync(
    `SELECT valor FROM sync_meta WHERE chave = ?;`,
    [String(chave)]
  );
  return row?.valor ?? null;
};

/**
 * Persiste um metadado de sincronização na tabela sync_meta.
 */
export const salvarMetaSync = async (chave, valor, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO sync_meta (chave, valor, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(chave) DO UPDATE SET
       valor = excluded.valor,
       updated_at = excluded.updated_at;`,
    [String(chave), valor !== null && valor !== undefined ? String(valor) : null, agora]
  );
};

export default {
  enfileirarOperacao,
  recuperarItensEmVooInterrompidos,
  marcarItensEnviando,
  reverterItensParaPendente,
  possuiOutraPendenciaAtiva,
  possuiPendenciaOuErroMetadado,
  listarItensPendentes,
  marcarItemSincronizado,
  registrarFalhaItem,
  obterResumoFila,
  limparSincronizados,
  obterMetaSync,
  salvarMetaSync,
};
