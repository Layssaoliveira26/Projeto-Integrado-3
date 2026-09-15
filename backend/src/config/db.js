// Configuração e gerenciamento centralizado do pool de conexões com o PostgreSQL
require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no cliente do PostgreSQL:", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};
