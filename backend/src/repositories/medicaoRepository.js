const db = require("../config/db");

const buscarServicoPorId = async (servicoId) => {
  const { rows } = await db.query(`SELECT * FROM servicos WHERE id = $1;`, [servicoId]);
  return rows[0];
};

const buscarUltimaMedicao = async (servicoId, cicloId) => {
  const query = `
    SELECT m.* 
    FROM medicoes m
    INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
    WHERE m.servico_id = $1 AND m.ciclo_id != $2
    ORDER BY c.numero_ciclo DESC
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [servicoId, cicloId]);
  return rows[0];
};

const salvarMedicao = async (dados) => {
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
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    dados.id, dados.ciclo_id, dados.servico_id, dados.usuario_id,
    dados.quantidade_medida_periodo, dados.quantidade_acumulada_anterior,
    dados.quantidade_acumulada_atual, dados.saldo_quantidade,
    dados.valor_medido_periodo, dados.valor_acumulado_anterior,
    dados.valor_acumulado_atual, dados.percentual_execucao
  ];

  const { rows } = await db.query(query, values);
  return rows[0];
};

module.exports = { buscarServicoPorId, buscarUltimaMedicao, salvarMedicao };