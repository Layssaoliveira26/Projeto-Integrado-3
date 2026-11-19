const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const obraRepository = require("../src/repositories/obraRepository");
const obraService = require("../src/services/obraService");
const obraController = require("../src/controllers/obraController");
const medicaoRepository = require("../src/repositories/medicaoRepository");
const medicaoService = require("../src/services/medicaoService");
const syncRepository = require("../src/repositories/syncRepository");
const syncService = require("../src/services/syncService");
const authService = require("../src/services/authService");

const queryOriginal = pool.query;

test.afterEach(() => {
  pool.query = queryOriginal;
});

test("Segurança (P-01): obraRepository.criar bloqueia sobrescrita de obra pertencente a outro usuário com 403", async () => {
  pool.query = async () => ({ rows: [] });

  await assert.rejects(
    async () => {
      await obraRepository.criar({
        id: "b2c3d4e5-0000-0000-0000-000000000002",
        nome: "Tentativa IDOR",
        endereco: "Rua Invasor, 999",
        usuarioId: "a1b2c3d4-0000-0000-0000-000000000099",
      });
    },
    (err) => {
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /Sem permissão/i);
      return true;
    }
  );
});

test("Ciclo de vida (P-02): desarquivarObra reativa obra arquivada, limpa data_arquivamento e bloqueia obra encerrada", async () => {
  let statusAtual = "arquivada";
  let sqlMudarStatus = "";

  pool.query = async (sql, params) => {
    if (sql.includes("SELECT * FROM obras")) {
      return {
        rows: [
          {
            id: params[0],
            usuario_id: params[1],
            nome: "Obra Arquivada",
            status: statusAtual,
            data_arquivamento: "2026-11-19T10:00:00.000Z",
          },
        ],
      };
    }
    if (sql.includes("UPDATE obras")) {
      sqlMudarStatus = sql;
      statusAtual = params[0];
      return {
        rows: [
          {
            id: params[1],
            usuario_id: params[2],
            status: statusAtual,
            data_arquivamento: null,
          },
        ],
      };
    }
    return { rows: [] };
  };

  const reativada = await obraService.desarquivarObra("obra-1", "user-1");
  assert.equal(reativada.status, "ativa");
  assert.equal(reativada.data_arquivamento, null);
  assert.match(sqlMudarStatus, /data_arquivamento = CASE/);

  statusAtual = "encerrada";
  await assert.rejects(
    () => obraService.desarquivarObra("obra-1", "user-1"),
    /encerrada/i
  );
  await assert.rejects(
    () => obraService.arquivarObra("obra-1", "user-1"),
    /encerrada/i
  );
});

test("Ciclo de vida (P-02): medicaoService bloqueia novas medições diretas em obras arquivadas ou encerradas", async () => {
  const origBuscarCiclo = medicaoRepository.buscarCicloPorId;
  try {
    medicaoRepository.buscarCicloPorId = async () => ({
      id: "ciclo-1",
      obra_id: "obra-1",
      numero_ciclo: 1,
      status: "aberto",
      obra_usuario_id: "user-1",
      obra_status: "arquivada",
    });

    await assert.rejects(
      () =>
        medicaoService.registrarOuAtualizarMedicao({
          ciclo_id: "ciclo-1",
          servico_id: "srv-1",
          usuario_id: "user-1",
          quantidade_medida_periodo: "2",
        }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /obra arquivada/i);
        return true;
      }
    );
  } finally {
    medicaoRepository.buscarCicloPorId = origBuscarCiclo;
  }
});

test("Sync & Validação (P-02, P-05): processarItemFila suporta acao desarquivar e upsertMedicaoSincronizadaDireta rejeita NaN e decimal em UN", async () => {
  const origDesarquivar = obraService.desarquivarObra;
  try {
    obraService.desarquivarObra = async (id, usuarioId) => ({
      id,
      usuario_id: usuarioId,
      status: "ativa",
      data_arquivamento: null,
    });

    const resultado = await syncService.processarItemFila(
      {
        id: "fila-desarq-1",
        tabela_referencia: "obras",
        registro_id: "obra-arq-1",
        operacao: "update",
        acao: "desarquivar",
        payload: JSON.stringify({
          id: "obra-arq-1",
          status: "ativa",
          acao: "desarquivar",
        }),
      },
      "user-1"
    );
    assert.equal(resultado.status, "ativa");
  } finally {
    obraService.desarquivarObra = origDesarquivar;
  }

  pool.query = async (sql) => {
    if (sql.includes("FROM servicos s")) {
      return {
        rows: [
          {
            id: "srv-un",
            obra_id: "obra-1",
            unidade_medida: "UN",
            usuario_id: "user-1",
          },
        ],
      };
    }
    return { rows: [] };
  };

  await assert.rejects(
    () =>
      syncRepository.upsertMedicaoSincronizadaDireta({
        id: "med-nan",
        ciclo_id: "ciclo-1",
        servico_id: "srv-un",
        usuario_id: "user-1",
        quantidade_medida_periodo: "texto-invalido",
      }),
    /Quantidade medida inválida/i
  );

  await assert.rejects(
    () =>
      syncRepository.upsertMedicaoSincronizadaDireta({
        id: "med-frac-un",
        ciclo_id: "ciclo-1",
        servico_id: "srv-un",
        usuario_id: "user-1",
        quantidade_medida_periodo: "1.5",
      }),
    /unidade inteira/i
  );
});

test("Hardening HTTP (P-10): obraController converte código Postgres 22P02 em 400 e authService rejeita senha não-string sem erro 500", async () => {
  pool.query = async () => {
    const err = new Error("invalid input syntax for type uuid");
    err.code = "22P02";
    throw err;
  };

  let statusCapturado = null;
  let corpoCapturado = null;
  const resMock = {
    status(code) {
      statusCapturado = code;
      return this;
    },
    json(body) {
      corpoCapturado = body;
      return this;
    },
  };

  await obraController.obterPorId(
    { params: { id: "nao-uuid" }, user: { id: "user-1" } },
    resMock
  );

  assert.equal(statusCapturado, 400);
  assert.match(corpoCapturado.erro, /formato inválido/i);

  await assert.rejects(
    () => authService.login({ email: "teste@teste.com", senha: 12345678 }),
    (err) => {
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});
