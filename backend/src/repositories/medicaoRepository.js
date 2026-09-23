const crypto = require("node:crypto");
const db = require("../config/db");

/**
 * Busca um serviço pelo ID com todos os dados orçamentários.
 */
const buscarServicoPorId = async (servicoId) => {
  const { rows } = await db.query(`SELECT * FROM servicos WHERE id = $1;`, [servicoId]);
  return rows[0] || null;
};

/**
 * Busca um ciclo de medição pelo ID.
 */
const buscarCicloPorId = async (cicloId) => {
  const { rows } = await db.query(`SELECT * FROM ciclos_medicao WHERE id = $1;`, [cicloId]);
  return rows[0] || null;
};

/**
 * Busca a medição de um serviço no ciclo imediatamente anterior ao ciclo atual informado.
 * Filtra por c.numero_ciclo < numeroCicloAtual para garantir consistência temporal.
 */
const buscarUltimaMedicao = async (servicoId, numeroCicloAtual) => {
  const query = `
    SELECT m.* 
    FROM medicoes m
    INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
    WHERE m.servico_id = $1 AND c.numero_ciclo < $2
    ORDER BY c.numero_ciclo DESC
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [servicoId, numeroCicloAtual]);
  return rows[0] || null;
};

/**
 * Busca a medição registrada para um serviço no ciclo especificado.
 */
const buscarMedicaoAtual = async (servicoId, cicloId) => {
  const query = `
    SELECT * FROM medicoes
    WHERE servico_id = $1 AND ciclo_id = $2;
  `;
  const { rows } = await db.query(query, [servicoId, cicloId]);
  return rows[0] || null;
};

/**
 * Salva ou atualiza a medição de um serviço em um ciclo.
 * Se nenhum ID for enviado, gera um UUID v4 automaticamente.
 */
const salvarMedicao = async (dados) => {
  const id = dados.id || crypto.randomUUID();

  const query = `
    INSERT INTO medicoes (
      id, ciclo_id, servico_id, usuario_id,
      quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
      saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
      valor_acumulado_atual, percentual_execucao, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (ciclo_id, servico_id) 
    DO UPDATE SET
      quantidade_medida_periodo = EXCLUDED.quantidade_medida_periodo,
      quantidade_acumulada_anterior = EXCLUDED.quantidade_acumulada_anterior,
      quantidade_acumulada_atual = EXCLUDED.quantidade_acumulada_atual,
      saldo_quantidade = EXCLUDED.saldo_quantidade,
      valor_medido_periodo = EXCLUDED.valor_medido_periodo,
      valor_acumulado_anterior = EXCLUDED.valor_acumulado_anterior,
      valor_acumulado_atual = EXCLUDED.valor_acumulado_atual,
      percentual_execucao = EXCLUDED.percentual_execucao,
      usuario_id = EXCLUDED.usuario_id,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    id,
    dados.ciclo_id,
    dados.servico_id,
    dados.usuario_id,
    dados.quantidade_medida_periodo,
    dados.quantidade_acumulada_anterior,
    dados.quantidade_acumulada_atual,
    dados.saldo_quantidade,
    dados.valor_medido_periodo,
    dados.valor_acumulado_anterior,
    dados.valor_acumulado_atual,
    dados.percentual_execucao,
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

/**
 * Lista todas as medições de um ciclo com informações dos serviços associados.
 */
const listarMedicoesPorCiclo = async (cicloId) => {
  const query = `
    SELECT 
      m.*,
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
    WHERE m.ciclo_id = $1
    ORDER BY e.ordem ASC, s.ordem ASC;
  `;
  const { rows } = await db.query(query, [cicloId]);
  return rows;
};

module.exports = {
  buscarServicoPorId,
  buscarCicloPorId,
  buscarUltimaMedicao,
  buscarMedicaoAtual,
  salvarMedicao,
  listarMedicoesPorCiclo,
};