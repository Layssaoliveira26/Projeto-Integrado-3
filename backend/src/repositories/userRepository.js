// Repositório responsável pelo isolamento das operações de persistência e consulta da tabela de usuários no PostgreSQL
const crypto = require("crypto");
const { query } = require("../config/db");

const buscarPorEmail = async (email) => {
  const sql = `
    SELECT id, nome, email, senha_hash, created_at, updated_at
    FROM usuarios
    WHERE email = $1
  `;
  const { rows } = await query(sql, [email.toLowerCase().trim()]);
  return rows[0] || null;
};

const criar = async ({ nome, email, senhaHash }) => {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO usuarios (id, nome, email, senha_hash)
    VALUES ($1, $2, $3, $4)
    RETURNING id, nome, email, created_at, updated_at
  `;
  const values = [id, nome.trim(), email.toLowerCase().trim(), senhaHash];
  const { rows } = await query(sql, values);
  return rows[0];
};

const buscarPorId = async (id) => {
  const sql = `
    SELECT id, nome, email, created_at, updated_at
    FROM usuarios
    WHERE id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
};

module.exports = {
  buscarPorEmail,
  criar,
  buscarPorId,
};
