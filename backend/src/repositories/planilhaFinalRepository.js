const db = require("../config/db");

/**
 * Busca ciclo ativo ou o último ciclo da obra caso nenhum seja especificado.
 */
async function buscarCicloReferencia(obraId, cicloId = null) {
  if (cicloId) {
    const res = await db.query(
      `SELECT id, obra_id, numero_ciclo, status, data_inicio, data_encerramento
       FROM ciclos_medicao
       WHERE id = $1 AND obra_id = $2;`,
      [cicloId, obraId]
    );
    if (res.rows.length > 0) return res.rows[0];
  }

  // Tenta buscar o ciclo com status 'aberto'
  const cicloAberto = await db.query(
    `SELECT id, obra_id, numero_ciclo, status, data_inicio, data_encerramento
     FROM ciclos_medicao
     WHERE obra_id = $1 AND status = 'aberto'
     ORDER BY numero_ciclo DESC
     LIMIT 1;`,
    [obraId]
  );
  if (cicloAberto.rows.length > 0) return cicloAberto.rows[0];

  // Caso não tenha nenhum aberto, pega o mais recente
  const ultimoCiclo = await db.query(
    `SELECT id, obra_id, numero_ciclo, status, data_inicio, data_encerramento
     FROM ciclos_medicao
     WHERE obra_id = $1
     ORDER BY numero_ciclo DESC
     LIMIT 1;`,
    [obraId]
  );
  return ultimoCiclo.rows[0] || null;
}

/**
 * Busca a obra por ID.
 */
async function buscarObraPorId(obraId) {
  const res = await db.query(
    `SELECT id, usuario_id, nome, endereco, status, data_inicio, data_conclusao, orcamento_total
     FROM obras
     WHERE id = $1;`,
    [obraId]
  );
  return res.rows[0] || null;
}

/**
 * Busca todos os serviços e etapas combinados com as medições do ciclo.
 */
async function buscarEstruturaPlanilhaFinal(obraId, cicloId) {
  const query = `
    SELECT
      e.id AS etapa_id,
      e.nome AS etapa_nome,
      e.ordem AS etapa_ordem,
      s.id AS servico_id,
      s.codigo_servico,
      s.descricao AS servico_descricao,
      s.fonte_origem,
      s.unidade_medida,
      s.quantidade_orcada,
      s.preco_unitario,
      s.preco_total AS preco_total_orcado,
      s.ordem AS servico_ordem,
      COALESCE(m.quantidade_acumulada_anterior, 0) AS quantidade_anterior,
      COALESCE(m.valor_acumulado_anterior, 0) AS valor_anterior,
      COALESCE(m.quantidade_medida_periodo, 0) AS quantidade_periodo,
      COALESCE(m.valor_medido_periodo, 0) AS valor_periodo,
      COALESCE(m.quantidade_acumulada_atual, 0) AS quantidade_acumulada,
      COALESCE(m.valor_acumulado_atual, 0) AS valor_acumulado,
      COALESCE(m.saldo_quantidade, (s.quantidade_orcada - COALESCE(m.quantidade_acumulada_atual, 0))) AS saldo_quantidade,
      (s.preco_total - COALESCE(m.valor_acumulado_atual, 0)) AS saldo_valor,
      COALESCE(m.percentual_execucao, 
        CASE WHEN s.quantidade_orcada > 0 
          THEN (COALESCE(m.quantidade_acumulada_atual, 0) / s.quantidade_orcada) * 100 
          ELSE 0 
        END
      ) AS percentual_execucao
    FROM etapas e
    JOIN servicos s ON s.etapa_id = e.id
    LEFT JOIN medicoes m ON m.servico_id = s.id AND m.ciclo_id = $2
    WHERE e.obra_id = $1
    ORDER BY e.ordem ASC, s.ordem ASC;
  `;

  const { rows } = await db.query(query, [obraId, cicloId]);
  return rows;
}

module.exports = {
  buscarObraPorId,
  buscarCicloReferencia,
  buscarEstruturaPlanilhaFinal,
};
