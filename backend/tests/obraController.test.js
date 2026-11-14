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

  assert.match(queryRecebida.sql, /INSERT INTO obras \(id, usuario_id, nome, endereco/);
  assert.deepEqual(queryRecebida.values.slice(1, 4), [
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
    null,
    null,
    null,
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

test("GET /obras/:id retorna detalhes da obra com sucesso", async () => {
  let queryRecebida;
  pool.query = async (sql, values) => {
    queryRecebida = { sql, values };
    return { rows: [obra] };
  };

  const resposta = await executarController(obraController.obterPorId, {
    params: { id: obraId },
    user: { id: usuarioId },
  });

  assert.match(queryRecebida.sql, /SELECT \* FROM obras/);
  assert.deepEqual(queryRecebida.values, [obraId, usuarioId]);
  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.body.id, obraId);
  assert.equal(resposta.body.nome, "Obra teste");
  assert.equal(resposta.body.endereco, endereco);
});

test("GET /obras/:id retorna 404 quando obra não existe", async () => {
  pool.query = async () => ({ rows: [] });

  const resposta = await executarController(obraController.obterPorId, {
    params: { id: obraId },
    user: { id: usuarioId },
  });

  assert.equal(resposta.statusCode, 404);
  assert.match(resposta.body.erro, /não encontrada/i);
});

test("PUT /obras/:id atualiza datas e descrição normalizadas", async () => {
  const queriesRecebidas = [];
  pool.query = async (sql, values) => {
    queriesRecebidas.push({ sql, values });
    return { rows: [obra] };
  };

  const resposta = await executarController(obraController.atualizar, {
    params: { id: obraId },
    body: {
      nome: "Obra teste",
      endereco,
      data_inicio: "15/08/2026",
      data_conclusao: "20/12/2026",
      descricao: "Observações da obra",
    },
    user: { id: usuarioId },
  });

  assert.equal(queriesRecebidas.length, 2);
  assert.deepEqual(queriesRecebidas[1].values, [
    "Obra teste",
    endereco,
    "2026-08-15",
    "2026-12-20",
    "Observações da obra",
    obraId,
    usuarioId,
  ]);
  assert.equal(resposta.statusCode, 200);
});

test("GET /obras/:id/historico-conclusao retorna histórico de alterações", async () => {
  const itemHistorico = {
    id: "hist-123",
    obra_id: obraId,
    usuario_id: usuarioId,
    data_anterior: "02/10/2027",
    data_conclusao: "25/10/2027",
    dias_adicionados: 23,
    tempo_adicionado: "23 dias",
    motivo: "Atraso de materiais",
    created_at: new Date("2027-09-17T16:02:00Z").toISOString(),
  };

  const queries = [];
  pool.query = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes("FROM obras")) {
      return { rows: [obra] };
    }
    return { rows: [itemHistorico] };
  };

  const resposta = await executarController(obraController.obterHistoricoConclusao, {
    params: { id: obraId },
    user: { id: usuarioId },
  });

  assert.equal(resposta.statusCode, 200);
  assert.equal(resposta.body.historico.length, 1);
  assert.equal(resposta.body.historico[0].dias_adicionados, 23);
  assert.ok(resposta.body.ultima_atualizacao);
});

test("POST /obras/:id/historico-conclusao registra alteração e atualiza obra", async () => {
  const itemCriado = {
    id: "hist-456",
    obra_id: obraId,
    usuario_id: usuarioId,
    data_anterior: "2027-10-02",
    data_conclusao: "2027-10-25",
    dias_adicionados: 23,
  };

  const queries = [];
  pool.query = async (sql, values) => {
    queries.push({ sql, values });
    if (sql.includes("FROM obras")) {
      return { rows: [{ ...obra, data_conclusao: "2027-10-02" }] };
    }
    if (sql.includes("INSERT INTO historico_datas_obra")) {
      return { rows: [itemCriado] };
    }
    return { rows: [obra] };
  };

  const resposta = await executarController(obraController.adicionarHistoricoConclusao, {
    params: { id: obraId },
    body: {
      data_anterior: "02/10/2027",
      data_conclusao: "25/10/2027",
      motivo: "Ajuste de cronograma",
    },
    user: { id: usuarioId },
  });

  assert.equal(resposta.statusCode, 201);
  assert.equal(resposta.body.dias_adicionados, 23);
});
