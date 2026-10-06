const crypto = require("node:crypto");
const { pool, query } = require("../config/db");

/**
 * Busca uma obra verificando a permissão do usuário autenticado.
 */
async function buscarObraComPermissao(obraId, usuarioId) {
  const sql = `
    SELECT id, usuario_id, nome, status, orcamento_total
    FROM obras
    WHERE id = $1 AND usuario_id = $2 AND deleted_at IS NULL;
  `;
  const { rows } = await query(sql, [obraId, usuarioId]);
  return rows[0] || null;
}

/**
 * Verifica se já existem medições lançadas para os serviços ou ciclos dessa obra.
 */
async function verificarMedicoesExistentes(obraId) {
  const sql = `
    SELECT COUNT(m.id)::int AS total
    FROM medicoes m
    INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
    WHERE c.obra_id = $1;
  `;
  const { rows } = await query(sql, [obraId]);
  return (rows[0]?.total || 0) > 0;
}

/**
 * Busca o registro da planilha-base mais recente vinculada à obra.
 */
async function buscarPlanilhaPorObraId(obraId) {
  const sql = `
    SELECT id, obra_id, nome_arquivo, status_validacao, mensagens_validacao, data_importacao, created_at, updated_at
    FROM planilhas_base
    WHERE obra_id = $1
    ORDER BY data_importacao DESC
    LIMIT 1;
  `;
  const { rows } = await query(sql, [obraId]);
  return rows[0] || null;
}

/**
 * Executa uma função com operações atômicas dentro de uma transação PostgreSQL.
 */
async function executarEmTransacao(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const resultado = await callback(client);
    await client.query("COMMIT");
    return resultado;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Registra o arquivo na tabela planilhas_base (dentro de transação).
 */
async function salvarPlanilhaBase(client, { obraId, nomeArquivo, statusValidacao = "valida", mensagensValidacao = null }) {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO planilhas_base (
      id, obra_id, nome_arquivo, status_validacao, mensagens_validacao, data_importacao, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [
    id,
    obraId,
    nomeArquivo,
    statusValidacao,
    mensagensValidacao ? JSON.stringify(mensagensValidacao) : null
  ];
  const { rows } = await client.query(sql, values);
  return rows[0];
}

/**
 * Limpa a estrutura anterior de serviços e etapas de uma obra (dentro de transação).
 */
async function limparEstruturaObra(client, obraId) {
  await client.query(`DELETE FROM servicos WHERE obra_id = $1;`, [obraId]);
  await client.query(`DELETE FROM etapas WHERE obra_id = $1;`, [obraId]);
}

/**
 * Salva uma etapa no banco de dados (dentro de transação).
 */
async function salvarEtapa(client, { id, obraId, etapaPaiId = null, nome, ordem = 0 }) {
  const etapaId = id || crypto.randomUUID();
  const sql = `
    INSERT INTO etapas (id, obra_id, etapa_pai_id, nome, ordem, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [etapaId, obraId, etapaPaiId, nome, ordem];
  const { rows } = await client.query(sql, values);
  return rows[0];
}

/**
 * Salva um serviço orçado no banco de dados (dentro de transação).
 */
async function salvarServico(client, {
  id,
  obraId,
  etapaId,
  codigoServico,
  descricao,
  fonteOrigem = null,
  unidadeMedida,
  quantidadeOrcada,
  precoUnitario,
  precoTotal,
  ordem = 0
}) {
  const servicoId = id || crypto.randomUUID();
  const sql = `
    INSERT INTO servicos (
      id, obra_id, etapa_id, codigo_servico, descricao, fonte_origem,
      unidade_medida, quantidade_orcada, preco_unitario, preco_total,
      ordem, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *;
  `;
  const values = [
    servicoId,
    obraId,
    etapaId,
    codigoServico,
    descricao,
    fonteOrigem,
    unidadeMedida,
    quantidadeOrcada,
    precoUnitario,
    precoTotal,
    ordem
  ];
  const { rows } = await client.query(sql, values);
  return rows[0];
}

/**
 * Atualiza o valor do orçamento total na obra (dentro de transação).
 */
async function atualizarOrcamentoObra(client, obraId, orcamentoTotal) {
  const sql = `
    UPDATE obras
    SET orcamento_total = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [orcamentoTotal, obraId]);
  return rows[0];
}

/**
 * Garante que o Ciclo 1 da obra existe e está aberto (dentro de transação).
 */
async function garantirCicloInicial(client, obraId) {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO ciclos_medicao (id, obra_id, numero_ciclo, status, data_inicio)
    VALUES ($1, $2, 1, 'aberto', CURRENT_TIMESTAMP)
    ON CONFLICT (obra_id, numero_ciclo) DO UPDATE
      SET updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const { rows } = await client.query(sql, [id, obraId]);
  return rows[0];
}

module.exports = {
  buscarObraComPermissao,
  verificarMedicoesExistentes,
  buscarPlanilhaPorObraId,
  executarEmTransacao,
  salvarPlanilhaBase,
  limparEstruturaObra,
  salvarEtapa,
  salvarServico,
  atualizarOrcamentoObra,
  garantirCicloInicial
};
