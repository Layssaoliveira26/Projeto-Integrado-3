const db = require("../config/db");

async function buscarCicloAtivo(obraId) {
  const query = `
    SELECT id, numero_ciclo, status
    FROM ciclos_medicao
    WHERE obra_id = $1 AND status = 'aberto'
    LIMIT 1;
  `;
  const { rows } = await db.query(query, [obraId]);
  return rows[0] || null;
}

async function buscarEstruturaAcompanhamento(obraId, cicloId) {
  const query = `
    SELECT 
      o.id AS obra_id,
      o.nome AS obra_nome,
      e.id AS etapa_id,
      e.nome AS etapa_nome,
      e.ordem AS etapa_ordem,
      s.id AS servico_id,
      s.codigo_servico,
      s.descricao AS servico_descricao,
      s.unidade_medida,
      s.preco_total AS servico_preco_total,
      COALESCE(m.valor_acumulado_atual, 0) AS valor_acumulado_atual,
      COALESCE(m.percentual_execucao, 0) AS percentual_execucao
    FROM obras o
    JOIN etapas e ON e.obra_id = o.id
    JOIN servicos s ON s.etapa_id = e.id
    LEFT JOIN medicoes m ON m.servico_id = s.id AND m.ciclo_id = $2
    WHERE o.id = $1
    ORDER BY e.ordem ASC, s.ordem ASC;
  `;
  const { rows } = await db.query(query, [obraId, cicloId]);
  return rows;
}

module.exports = {
  buscarCicloAtivo,
  buscarEstruturaAcompanhamento
};