const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const obraController = require("../src/controllers/obraController");

const usuarioId = "a1b2c3d4-0000-0000-0000-000000000001";
const obraId = "b2c3d4e5-0000-0000-0000-000000000002";
const endereco = "Rua da Construção, 123";
const obra = { id: obraId, usuario_id: usuarioId, nome: "Obra teste", endereco };
const queryOriginal = pool.query;

test.afterEach(() => {
  pool.query = queryOriginal;
});

const executarController = async (controller, req) => {
  const resposta = {
    statusCode: null,
    body: null,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await controller(req, resposta);
  return resposta;
};

test("POST /obras persiste e retorna o endereço enviado", async () => {
  let queryRecebida;
  pool.query = async (sql, values) => {
    queryRecebida = { sql, values };
    return { rows: [obra] };
  };

  const resposta = await executarController(obraController.criar, {
    body: { nome: "Obra teste", endereco },
    user: { id: usuarioId },
  });

  assert.match(queryRecebida.sql, /INSERT INTO obras \(id, usuario_id, nome, endereco\)/);
  assert.deepEqual(queryRecebida.values.slice(1), [
    usuarioId,
    "Obra teste",
    endereco,
  ]);
  assert.equal(resposta.statusCode, 201);
  assert.equal(resposta.body.endereco, endereco);
});

test("PUT /obras/:id atualiza e retorna o endereço enviado", async () => {
  const queriesRecebidas = [];
  pool.query = async (sql, values) => {
    queriesRecebidas.push({ sql, values });
    return { rows: [obra] };
  };

  const resposta = await executarController(obraController.atualizar, {
    params: { id: obraId },
    body: { nome: "Obra teste", endereco },
    user: { id: usuarioId },
  });

  assert.equal(queriesRecebidas.length, 2);
  assert.match(queriesRecebidas[1].sql, /SET nome = \$1, endereco = \$2/);
  assert.deepEqual(queriesRecebidas[1].values, [
    "Obra teste",
    endereco,
    obraId,
    usuarioId,
  ]);
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.body.endereco, endereco);
});

test("GET /obras retorna o endereço na listagem", async () => {
  pool.query = async () => ({ rows: [obra] });

  const resposta = await executarController(obraController.listar, {
    query: {},
    user: { id: usuarioId },
  });

  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.body[0].endereco, endereco);
});

test("POST e PUT rejeitam endereço ausente ou em branco", async () => {
  let consultas = 0;
  pool.query = async () => {
    consultas += 1;
    return { rows: [obra] };
  };

  const criarResposta = await executarController(obraController.criar, {
    body: { nome: "Obra teste", endereco: "  " },
    user: { id: usuarioId },
  });
  const atualizarResposta = await executarController(obraController.atualizar, {
    params: { id: obraId },
    body: { nome: "Obra teste" },
    user: { id: usuarioId },
  });

  assert.equal(criarResposta.statusCode, 400);
  assert.equal(atualizarResposta.statusCode, 400);
  assert.match(criarResposta.body.erro, /endereço.*obrigatório/i);
  assert.match(atualizarResposta.body.erro, /endereço.*obrigatório/i);
  assert.equal(consultas, 0);
});
