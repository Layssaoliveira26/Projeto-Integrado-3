const crypto = require("crypto");
const { query } = require("../config/db");

const criar = async ({ nome, usuarioId }) => {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO obras (id, usuario_id, nome)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const values = [id, usuarioId, nome];
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

const atualizar = async (id, usuarioId, { nome }) => {
  const sql = `
    UPDATE obras 
    SET nome = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND usuario_id = $3
    RETURNING *;
  `;
  const values = [nome, id, usuarioId];
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

module.exports = {
  criar,
  buscarPorId,
  listarPorUsuario,
  atualizar,
  deletar,
  mudarStatus
};
