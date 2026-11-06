const crypto = require("crypto");
const { query } = require("../config/db");

const criar = async ({ nome, endereco, data_inicio, data_conclusao, descricao, usuarioId }) => {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO obras (id, usuario_id, nome, endereco, data_inicio, data_conclusao, descricao)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    id,
    usuarioId,
    nome,
    endereco,
    data_inicio || null,
    data_conclusao || null,
    descricao || null,
  ];
  const { rows } = await query(sql, values);
  return rows[0];
};

const buscarPorId = async (id, usuarioId) => {
  const sql = `
    SELECT * FROM obras 
    WHERE id = $1 AND usuario_id = $2
  `;
  const { rows } = await query(sql, [id, usuarioId]);
  return rows[0] || null;
};

const listarPorUsuario = async (usuarioId, incluirArquivadas = false) => {
  let sql = `
    SELECT * FROM obras 
    WHERE usuario_id = $1
  `;
  const values = [usuarioId];

  if (!incluirArquivadas) {
    sql += ` AND status = 'ativa'`;
  }
  
  sql += ` ORDER BY created_at DESC`;

  const { rows } = await query(sql, values);
  return rows;
};

const atualizar = async (id, usuarioId, { nome, endereco, data_inicio, data_conclusao, descricao }) => {
  const sql = `
    UPDATE obras 
    SET nome = $1, endereco = $2, data_inicio = $3, data_conclusao = $4, descricao = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND usuario_id = $7
    RETURNING *;
  `;
  const values = [
    nome,
    endereco,
    data_inicio || null,
    data_conclusao || null,
    descricao || null,
    id,
    usuarioId,
  ];
  const { rows } = await query(sql, values);
  return rows[0] || null;
};

const deletar = async (id, usuarioId) => {
  const sql = `
    DELETE FROM obras 
    WHERE id = $1 AND usuario_id = $2
    RETURNING *;
  `;
  const { rows } = await query(sql, [id, usuarioId]);
  return rows[0] || null;
};

const mudarStatus = async (id, usuarioId, status) => {
  const sql = `
    UPDATE obras 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND usuario_id = $3
    RETURNING *;
  `;
  const values = [status, id, usuarioId];
  const { rows } = await query(sql, values);
  return rows[0] || null;
};

const registrarHistoricoConclusao = async ({
  obraId,
  usuarioId,
  dataAnterior,
  dataConclusao,
  diasAdicionados,
  motivo,
}) => {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO historico_datas_obra (id, obra_id, usuario_id, data_anterior, data_conclusao, dias_adicionados, motivo)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    id,
    obraId,
    usuarioId,
    dataAnterior,
    dataConclusao,
    diasAdicionados,
    motivo || null,
  ];
  const { rows } = await query(sql, values);
  return rows[0];
};

const listarHistoricoConclusao = async (obraId) => {
  const sql = `
    SELECT 
      id,
      obra_id,
      usuario_id,
      TO_CHAR(data_anterior, 'DD/MM/YYYY') as data_anterior,
      TO_CHAR(data_conclusao, 'DD/MM/YYYY') as data_conclusao,
      dias_adicionados,
      CONCAT(dias_adicionados, ' dias') as tempo_adicionado,
      motivo,
      created_at
    FROM historico_datas_obra
    WHERE obra_id = $1
    ORDER BY created_at DESC;
  `;
  try {
    const { rows } = await query(sql, [obraId]);
    return rows;
  } catch (err) {
    if (err.code === "42P01") {
      return [];
    }
    throw err;
  }
};

module.exports = {
  criar,
  buscarPorId,
  listarPorUsuario,
  atualizar,
  deletar,
  mudarStatus,
  registrarHistoricoConclusao,
  listarHistoricoConclusao,
};
