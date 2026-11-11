// mobile/src/repositories/cicloLocalRepository.js
import { getDbConnection } from "../database/index";
import { gerarUUID } from "../utils/uuid";
import { enfileirarOperacao } from "./syncQueueRepository";

/**
 * Salva ou atualiza um ciclo vindo do servidor no SQLite local (cache sem enfileirar).
 */
export const upsertCicloSincronizado = async (ciclo, dbOverride = null) => {
  if (!ciclo || !ciclo.id || !ciclo.obra_id) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO ciclos_medicao (
      id, obra_id, numero_ciclo, status, data_inicio, data_encerramento, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(obra_id, numero_ciclo) DO UPDATE SET
      id = excluded.id,
      status = excluded.status,
      data_inicio = excluded.data_inicio,
      data_encerramento = excluded.data_encerramento,
      updated_at = excluded.updated_at;`,
    [
      String(ciclo.id),
      String(ciclo.obra_id),
      Number(ciclo.numero_ciclo || 1),
      ciclo.status || "aberto",
      ciclo.data_inicio || agora,
      ciclo.data_encerramento || null,
      ciclo.created_at || agora,
      ciclo.updated_at || agora,
    ]
  );
};

/**
 * Lista todos os ciclos de uma obra no SQLite local com o percentual de progresso atribuído.
 */
export const listarCiclosObraLocal = async (obraId, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());

  const orcRes = await db.getFirstAsync(
    `SELECT COALESCE(SUM(preco_total), 0) AS total_orcado
     FROM servicos WHERE obra_id = ?;`,
    [String(obraId)]
  );
  const totalOrcado = Number(orcRes?.total_orcado || 0);

  const ciclos = await db.getAllAsync(
    `SELECT c.*,
            COALESCE(SUM(m.valor_acumulado_atual), 0) AS total_executado
     FROM ciclos_medicao c
     LEFT JOIN medicoes m ON m.ciclo_id = c.id
     WHERE c.obra_id = ?
     GROUP BY c.id
     ORDER BY c.numero_ciclo DESC;`,
    [String(obraId)]
  );

  return (ciclos || []).map((c) => {
    const progresso =
      totalOrcado > 0
        ? Math.round((Number(c.total_executado || 0) / totalOrcado) * 100)
        : 0;
    return {
      id: c.id,
      obra_id: c.obra_id,
      numero_ciclo: Number(c.numero_ciclo),
      status: c.status,
      data_inicio: c.data_inicio,
      data_encerramento: c.data_encerramento,
      progresso_percentual: progresso,
    };
  });
};

/**
 * Obtém os detalhes consolidados de um ciclo no SQLite local (mesmo formato de GET /ciclos/:id/detalhes).
 */
export const obterDetalhesCicloLocal = async (cicloId, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());

  const ciclo = await db.getFirstAsync(
    `SELECT c.*, o.nome AS obra_nome
     FROM ciclos_medicao c
     LEFT JOIN obras o ON c.obra_id = o.id
     WHERE c.id = ?;`,
    [String(cicloId)]
  );

  if (!ciclo) return null;

  const medicoesRows = await db.getAllAsync(
    `SELECT m.*, s.descricao, s.codigo_servico, s.preco_total
     FROM medicoes m
     INNER JOIN servicos s ON m.servico_id = s.id
     WHERE m.ciclo_id = ?;`,
    [String(cicloId)]
  );

  const orcamentoRes = await db.getFirstAsync(
    `SELECT COALESCE(SUM(preco_total), 0) AS total_orcado
     FROM servicos WHERE obra_id = ?;`,
    [String(ciclo.obra_id)]
  );
  const totalOrcadoObra = Number(orcamentoRes?.total_orcado || 0);

  const inicio = ciclo.data_inicio ? new Date(ciclo.data_inicio) : new Date();
  const fim = ciclo.data_encerramento
    ? new Date(ciclo.data_encerramento)
    : new Date();
  const duracaoDias = Math.max(
    1,
    Math.ceil((fim - inicio) / (1000 * 60 * 60 * 24))
  );

  let valorTotalAcumuladoCiclo = 0;
  const servicosMapeados = (medicoesRows || []).map((m) => {
    const valorAcumulado = Number(m.valor_acumulado_atual || 0);
    valorTotalAcumuladoCiclo += valorAcumulado;

    return {
      id: m.servico_id,
      descricao: m.descricao || m.codigo_servico,
      valor_medido: valorAcumulado,
      percentual: Math.round(Number(m.percentual_execucao || 0)),
    };
  });

  const progressoAtribuido =
    totalOrcadoObra > 0
      ? Math.round((valorTotalAcumuladoCiclo / totalOrcadoObra) * 100)
      : 0;

  return {
    ciclo_id: ciclo.id,
    obra_nome: ciclo.obra_nome || "Obra",
    numero_ciclo: Number(ciclo.numero_ciclo),
    status: ciclo.status,
    duracao_dias: duracaoDias,
    data_inicio: ciclo.data_inicio,
    data_encerramento: ciclo.data_encerramento,
    progresso_atribuido: progressoAtribuido,
    servicos: servicosMapeados,
  };
};

/**
 * Encerra o ciclo atual localmente no SQLite, cria o próximo ciclo (N+1) herdando o progresso acumulado
 * e enfileira a operação para sincronização com o servidor.
 */
export const encerrarCicloLocal = async (cicloId, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const cicloAtual = await db.getFirstAsync(
    `SELECT * FROM ciclos_medicao WHERE id = ?;`,
    [String(cicloId)]
  );

  if (!cicloAtual) {
    throw new Error("Ciclo não encontrado localmente.");
  }
  if (cicloAtual.status === "encerrado") {
    throw new Error("Este ciclo já está encerrado.");
  }

  const agora = new Date().toISOString();

  // 1. Encerra o ciclo atual
  await db.runAsync(
    `UPDATE ciclos_medicao
     SET status = 'encerrado', data_encerramento = ?, updated_at = ?
     WHERE id = ?;`,
    [agora, agora, String(cicloId)]
  );

  // 2. Cria o novo ciclo (N+1)
  const novoCicloId = gerarUUID();
  const proximoNumero = Number(cicloAtual.numero_ciclo) + 1;

  await db.runAsync(
    `INSERT OR REPLACE INTO ciclos_medicao (
      id, obra_id, numero_ciclo, status, data_inicio, created_at, updated_at
    ) VALUES (?, ?, ?, 'aberto', ?, ?, ?);`,
    [
      novoCicloId,
      String(cicloAtual.obra_id),
      proximoNumero,
      agora,
      agora,
      agora,
    ]
  );

  // 3. Herança de progresso para o novo ciclo
  const medicoesAnteriores = await db.getAllAsync(
    `SELECT * FROM medicoes WHERE ciclo_id = ?;`,
    [String(cicloId)]
  );

  for (const m of medicoesAnteriores || []) {
    await db.runAsync(
      `INSERT OR REPLACE INTO medicoes (
        id, ciclo_id, servico_id, usuario_id,
        quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
        saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
        valor_acumulado_atual, percentual_execucao, sync_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, 0, ?, ?, ?, 0, ?, ?, ?, 'synced', ?, ?);`,
      [
        gerarUUID(),
        novoCicloId,
        m.servico_id,
        m.usuario_id,
        Number(m.quantidade_acumulada_atual || 0),
        Number(m.quantidade_acumulada_atual || 0),
        Number(m.saldo_quantidade || 0),
        Number(m.valor_acumulado_atual || 0),
        Number(m.valor_acumulado_atual || 0),
        Number(m.percentual_execucao || 0),
        agora,
        agora,
      ]
    );
  }

  const novoCicloObj = {
    id: novoCicloId,
    obra_id: cicloAtual.obra_id,
    numero_ciclo: proximoNumero,
    status: "aberto",
    data_inicio: agora,
  };

  await enfileirarOperacao(
    {
      tabelaReferencia: "ciclos_medicao",
      registroId: String(cicloId),
      operacao: "update",
      payload: {
        acao: "encerrar",
        ciclo_encerrado_id: String(cicloId),
        obra_id: String(cicloAtual.obra_id),
        novo_ciclo: novoCicloObj,
        data_encerramento: agora,
      },
    },
    db
  );

  return {
    mensagem: "Ciclo encerrado com sucesso!",
    cicloEncerrado: String(cicloId),
    novoCiclo: novoCicloObj,
  };
};

export default {
  upsertCicloSincronizado,
  listarCiclosObraLocal,
  obterDetalhesCicloLocal,
  encerrarCicloLocal,
};

