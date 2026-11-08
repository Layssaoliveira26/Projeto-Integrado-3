// mobile/src/repositories/medicaoLocalRepository.js
import { getDbConnection } from "../database/index";
import { gerarUUID } from "../utils/uuid";
import { calcularMedicaoLocal } from "../utils/calculoMedicaoLocal";
import { enfileirarOperacao } from "./syncQueueRepository";

/**
 * Obtém os dados orçamentários do serviço, o acumulado do ciclo anterior e a medição atual
 * diretamente do SQLite local, garantindo resposta imediata em campo (RNF01 / RNF04).
 */
export const obterDadosMedicaoLocal = async (
  servicoId,
  cicloId,
  dbOverride = null
) => {
  if (!servicoId || !cicloId) {
    throw new Error(
      "IDs de serviço e ciclo são obrigatórios para carregar a medição."
    );
  }

  const db = dbOverride || (await getDbConnection());

  const servico = await db.getFirstAsync(
    `SELECT * FROM servicos WHERE id = ?;`,
    [String(servicoId)]
  );
  if (!servico) {
    return null;
  }

  const ciclo = await db.getFirstAsync(
    `SELECT * FROM ciclos_medicao WHERE id = ?;`,
    [String(cicloId)]
  );
  const numeroCicloAtual = Number(ciclo?.numero_ciclo || 1);

  // Busca medição do ciclo imediatamente anterior (numero_ciclo < numeroCicloAtual)
  const medicaoAnterior = await db.getFirstAsync(
    `SELECT m.*
     FROM medicoes m
     INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
     WHERE m.servico_id = ? AND c.numero_ciclo < ?
     ORDER BY c.numero_ciclo DESC
     LIMIT 1;`,
    [String(servicoId), numeroCicloAtual]
  );

  const medicaoAtual = await db.getFirstAsync(
    `SELECT * FROM medicoes WHERE servico_id = ? AND ciclo_id = ?;`,
    [String(servicoId), String(cicloId)]
  );

  // Caso o ciclo N+1 tenha herdado uma linha inicial com quantidade_medida_periodo = 0,
  // e não haja medicaoAnterior encontrada via JOIN, preserva o quantidade_acumulada_anterior da própria linha
  const qtdAnterior = medicaoAnterior
    ? Number(medicaoAnterior.quantidade_acumulada_atual || 0)
    : Number(medicaoAtual?.quantidade_acumulada_anterior || 0);
  const valAnterior = medicaoAnterior
    ? Number(medicaoAnterior.valor_acumulado_atual || 0)
    : Number(medicaoAtual?.valor_acumulado_anterior || 0);

  return {
    ciclo: ciclo || {
      id: String(cicloId),
      numero_ciclo: numeroCicloAtual,
      status: "aberto",
      obra_id: servico.obra_id,
    },
    servico: {
      id: servico.id,
      codigo_servico: servico.codigo_servico,
      descricao: servico.descricao,
      origem: servico.fonte_origem || "SEINFRA",
      fonte_origem: servico.fonte_origem || "SEINFRA",
      unidade_medida: servico.unidade_medida,
      quantidade_orcada: servico.quantidade_orcada,
      preco_unitario: servico.preco_unitario,
      preco_total: servico.preco_total,
    },
    acumulado_anterior: {
      quantidade_acumulada_anterior: qtdAnterior,
      valor_acumulado_anterior: valAnterior,
    },
    medicao_atual: medicaoAtual || null,
  };
};

/**
 * Registra ou atualiza uma medição no SQLite local, executa os cálculos de precisão
 * e enfileira a mutação para sincronização posterior com o servidor (RF31 / RNF01).
 */
export const registrarMedicaoLocal = async (
  { id, cicloId, servicoId, usuarioId, quantidadeMedidaPeriodo },
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const dadosAtuais = await obterDadosMedicaoLocal(servicoId, cicloId, db);

  if (!dadosAtuais || !dadosAtuais.servico) {
    throw new Error("Serviço não encontrado no armazenamento local.");
  }

  if (dadosAtuais.ciclo && dadosAtuais.ciclo.status === "encerrado") {
    throw new Error(
      "Não é possível registrar ou alterar medições em um ciclo encerrado."
    );
  }

  const calculos = calcularMedicaoLocal({
    quantidadePeriodo: quantidadeMedidaPeriodo,
    quantidadeAnterior:
      dadosAtuais.acumulado_anterior.quantidade_acumulada_anterior,
    valorAnterior: dadosAtuais.acumulado_anterior.valor_acumulado_anterior,
    quantidadeOrcada: dadosAtuais.servico.quantidade_orcada,
    precoUnitario: dadosAtuais.servico.preco_unitario,
    unidadeMedida: dadosAtuais.servico.unidade_medida,
  });

  const medicaoId =
    dadosAtuais.medicao_atual?.id || id || gerarUUID();
  const agora = new Date().toISOString();
  const idUsuarioFinal = String(usuarioId || "local_user");

  await db.runAsync(
    `INSERT INTO medicoes (
      id, ciclo_id, servico_id, usuario_id,
      quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
      saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
      valor_acumulado_atual, percentual_execucao, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    ON CONFLICT(ciclo_id, servico_id) DO UPDATE SET
      quantidade_medida_periodo = excluded.quantidade_medida_periodo,
      quantidade_acumulada_anterior = excluded.quantidade_acumulada_anterior,
      quantidade_acumulada_atual = excluded.quantidade_acumulada_atual,
      saldo_quantidade = excluded.saldo_quantidade,
      valor_medido_periodo = excluded.valor_medido_periodo,
      valor_acumulado_anterior = excluded.valor_acumulado_anterior,
      valor_acumulado_atual = excluded.valor_acumulado_atual,
      percentual_execucao = excluded.percentual_execucao,
      usuario_id = excluded.usuario_id,
      sync_status = 'pending',
      updated_at = excluded.updated_at;`,
    [
      medicaoId,
      String(cicloId),
      String(servicoId),
      idUsuarioFinal,
      calculos.quantidade_medida_periodo,
      calculos.quantidade_acumulada_anterior,
      calculos.quantidade_acumulada_atual,
      calculos.saldo_quantidade,
      calculos.valor_medido_periodo,
      calculos.valor_acumulado_anterior,
      calculos.valor_acumulado_atual,
      calculos.percentual_execucao,
      agora,
      agora,
    ]
  );

  const registroSalvo = {
    id: medicaoId,
    ciclo_id: String(cicloId),
    servico_id: String(servicoId),
    usuario_id: idUsuarioFinal,
    ...calculos,
    sync_status: "pending",
    updated_at: agora,
  };

  await enfileirarOperacao(
    {
      tabelaReferencia: "medicoes",
      registroId: medicaoId,
      operacao: dadosAtuais.medicao_atual ? "update" : "insert",
      payload: registroSalvo,
    },
    db
  );

  return registroSalvo;
};

/**
 * Salva no SQLite uma medição já sincronizada vinda do backend (sem enfileirar).
 */
export const upsertMedicaoSincronizada = async (medicao, dbOverride = null) => {
  if (!medicao || !medicao.ciclo_id || !medicao.servico_id) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO medicoes (
      id, ciclo_id, servico_id, usuario_id,
      quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
      saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
      valor_acumulado_atual, percentual_execucao, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?, ?)
    ON CONFLICT(ciclo_id, servico_id) DO UPDATE SET
      id = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.id ELSE excluded.id END,
      quantidade_medida_periodo = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.quantidade_medida_periodo ELSE excluded.quantidade_medida_periodo END,
      quantidade_acumulada_anterior = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.quantidade_acumulada_anterior ELSE excluded.quantidade_acumulada_anterior END,
      quantidade_acumulada_atual = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.quantidade_acumulada_atual ELSE excluded.quantidade_acumulada_atual END,
      saldo_quantidade = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.saldo_quantidade ELSE excluded.saldo_quantidade END,
      valor_medido_periodo = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.valor_medido_periodo ELSE excluded.valor_medido_periodo END,
      valor_acumulado_anterior = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.valor_acumulado_anterior ELSE excluded.valor_acumulado_anterior END,
      valor_acumulado_atual = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.valor_acumulado_atual ELSE excluded.valor_acumulado_atual END,
      percentual_execucao = CASE WHEN medicoes.sync_status = 'pending' THEN medicoes.percentual_execucao ELSE excluded.percentual_execucao END,
      sync_status = CASE WHEN medicoes.sync_status = 'pending' THEN 'pending' ELSE 'synced' END;`,
    [
      String(medicao.id || gerarUUID()),
      String(medicao.ciclo_id),
      String(medicao.servico_id),
      String(medicao.usuario_id || ""),
      Number(medicao.quantidade_medida_periodo || 0),
      Number(medicao.quantidade_acumulada_anterior || 0),
      Number(medicao.quantidade_acumulada_atual || 0),
      Number(medicao.saldo_quantidade || 0),
      Number(medicao.valor_medido_periodo || 0),
      Number(medicao.valor_acumulado_anterior || 0),
      Number(medicao.valor_acumulado_atual || 0),
      Number(medicao.percentual_execucao || 0),
      medicao.created_at || agora,
      medicao.updated_at || agora,
    ]
  );
};

/**
 * Lista todas as medições de um ciclo no SQLite local.
 */
export const listarMedicoesCicloLocal = async (
  cicloId,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const ciclo = await db.getFirstAsync(
    `SELECT * FROM ciclos_medicao WHERE id = ?;`,
    [String(cicloId)]
  );

  const medicoes = await db.getAllAsync(
    `SELECT m.*,
            s.codigo_servico,
            s.descricao AS servico_descricao,
            s.unidade_medida,
            s.quantidade_orcada,
            s.preco_unitario,
            s.preco_total AS preco_total_orcado,
            e.id AS etapa_id,
            e.nome AS etapa_nome
     FROM medicoes m
     INNER JOIN servicos s ON m.servico_id = s.id
     LEFT JOIN etapas e ON s.etapa_id = e.id
     WHERE m.ciclo_id = ?
     ORDER BY e.ordem ASC, s.ordem ASC;`,
    [String(cicloId)]
  );

  return {
    ciclo: ciclo || { id: String(cicloId) },
    total_itens: (medicoes || []).length,
    medicoes: medicoes || [],
  };
};

export default {
  obterDadosMedicaoLocal,
  registrarMedicaoLocal,
  upsertMedicaoSincronizada,
  listarMedicoesCicloLocal,
};

