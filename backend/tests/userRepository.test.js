const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const userRepository = require("../src/repositories/userRepository");

const queryOriginal = pool.query;

test.afterEach(() => {
  pool.query = queryOriginal;
  userRepository.resetarCacheColunaFotoUrl();
});

test("garantirColunaFotoUrl executa ALTER TABLE idempotente antes da primeira consulta e reutiliza cache", async () => {
  const chamadas = [];
  pool.query = async (sql, values) => {
    chamadas.push({ sql: sql.trim(), values });
    if (sql.includes("ALTER TABLE usuarios")) {
      return { rows: [] };
    }
    return {
      rows: [
        {
          id: "u-1",
          nome: "Engenheiro Teste",
          email: "eng@teste.com",
          foto_url: null,
        },
      ],
    };
  };

  userRepository.resetarCacheColunaFotoUrl();

  const usuario1 = await userRepository.buscarPorEmail("eng@teste.com");
  const usuario2 = await userRepository.buscarPorId("u-1");

  assert.equal(usuario1.id, "u-1");
  assert.equal(usuario2.id, "u-1");
  assert.equal(chamadas.length, 3);
  assert.match(chamadas[0].sql, /ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS foto_url TEXT/i);
  assert.match(chamadas[1].sql, /SELECT id, nome, email, senha_hash, foto_url/i);
  assert.match(chamadas[2].sql, /SELECT id, nome, email, foto_url/i);
});

