const crypto = require("crypto");
const { query } = require("../config/db");

const buscarPorEmail = async (email) => {
  const sql = `
    SELECT id, nome, email, senha_hash, foto_url, created_at, updated_at
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
    RETURNING id, nome, email, foto_url, created_at, updated_at
  `;
  const values = [id, nome.trim(), email.toLowerCase().trim(), senhaHash];
  const { rows } = await query(sql, values);
  return rows[0];
};

const buscarPorId = async (id) => {
  const sql = `
    SELECT id, nome, email, foto_url, created_at, updated_at
    FROM usuarios
    WHERE id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
};

const buscarPorIdComSenha = async (id) => {
  const sql = `
    SELECT id, nome, email, senha_hash, foto_url, created_at, updated_at
    FROM usuarios
    WHERE id = $1
  `;
  const { rows } = await query(sql, [id]);
  return rows[0] || null;
};

const atualizarPerfil = async (id, { nome, email, senhaHash, fotoUrl }) => {
  const campos = [];
  const valores = [];
  let idx = 1;

  if (nome !== undefined) {
    campos.push(`nome = $${idx++}`);
    valores.push(nome);
  }
  if (email !== undefined) {
    campos.push(`email = $${idx++}`);
    valores.push(email);
  }
  if (senhaHash !== undefined) {
    campos.push(`senha_hash = $${idx++}`);
    valores.push(senhaHash);
  }
  if (fotoUrl !== undefined) {
    campos.push(`foto_url = $${idx++}`);
    valores.push(fotoUrl);
  }

  if (campos.length === 0) {
    return buscarPorId(id);
  }

  campos.push(`updated_at = CURRENT_TIMESTAMP`);
  valores.push(id);

  const sql = `
    UPDATE usuarios
    SET ${campos.join(", ")}
    WHERE id = $${idx}
    RETURNING id, nome, email, foto_url, created_at, updated_at
  `;

  const { rows } = await query(sql, valores);
  return rows[0] || null;
};

module.exports = {
  buscarPorEmail,
  criar,
  buscarPorId,
  buscarPorIdComSenha,
  atualizarPerfil,
};