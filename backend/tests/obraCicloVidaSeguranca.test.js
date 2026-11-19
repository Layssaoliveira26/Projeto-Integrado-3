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

test("obraRepository.criar bloqueia sobrescrita de obra pertencente a outro usuário com status 403", async () => {
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

test("obraService.desarquivarObra reativa obra arquivada, limpa data_arquivamento e bloqueia obra encerrada", async () => {
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

test("medicaoService bloqueia novas medições diretas em obras arquivadas ou encerradas", async () => {
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

test("syncService processa ação desarquivar e upsertMedicaoSincronizadaDireta rejeita valores não numéricos ou decimais em unidade inteira", async () => {
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

test("obraController retorna 400 para UUID inválido e authService rejeita senha não textual sem erro interno", async () => {
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

test("padronizarUnidadeMedida normaliza notações planas de planilha (M2, M3, UND, M2XMES) para o padrão técnico oficial", () => {
  const { padronizarUnidadeMedida, ehUnidadeInteira } = require("../src/utils/unidadesMedida");

  assert.equal(padronizarUnidadeMedida("M2"), "m²");
  assert.equal(padronizarUnidadeMedida("M²"), "m²");
  assert.equal(padronizarUnidadeMedida("M3"), "m³");
  assert.equal(padronizarUnidadeMedida("M³"), "m³");
  assert.equal(padronizarUnidadeMedida("UND"), "un");
  assert.equal(padronizarUnidadeMedida("KG"), "kg");
  assert.equal(padronizarUnidadeMedida("M"), "m");
  assert.equal(padronizarUnidadeMedida("M2XMES"), "m²×mês");
  assert.equal(ehUnidadeInteira("UND"), true);
  assert.equal(ehUnidadeInteira("m²"), false);
});

test("obraController preserva HTTP 500 em erros internos de banco sem vazar detalhes sensíveis", async () => {
  pool.query = async () => {
    const err = new Error("FATAL: terminating connection due to administrator command");
    err.code = "57P01";
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

  await obraController.criar(
    {
      body: { nome: "Obra Válida", endereco: "Rua Válida, 10" },
      user: { id: "a1b2c3d4-0000-0000-0000-000000000001" },
    },
    resMock
  );

  assert.equal(statusCapturado, 500);
  assert.equal(corpoCapturado.erro, "Erro interno no servidor.");
  assert.doesNotMatch(corpoCapturado.erro, /FATAL/i);
});

test("estruturaService retorna quantidade_orcada e preco_unitario para preservar orçamento na reidratação", async () => {
  const estruturaService = require("../src/services/estruturaService");

  pool.query = async (sql) => {
    if (sql.includes("FROM ciclos_medicao")) {
      return {
        rows: [{ id: "ciclo-1", numero_ciclo: 1, status: "aberto" }],
      };
    }
    if (sql.includes("FROM obras o") && sql.includes("JOIN servicos s")) {
      return {
        rows: [
          {
            obra_id: "obra-1",
            obra_nome: "Obra Reativada",
            obra_status: "ativa",
            obra_endereco: "Av. Central, 100",
            etapa_id: "etapa-1",
            etapa_nome: " Alvenaria ",
            etapa_ordem: 1,
            servico_id: "srv-1",
            codigo_servico: "SIN-01",
            servico_descricao: "Alvenaria de vedação",
            fonte_origem: "SINAPI",
            unidade_medida: "M2",
            quantidade_orcada: "48.5000",
            preco_unitario: "100.0000",
            servico_preco_total: "4850.0000",
            valor_acumulado_atual: "0",
            percentual_execucao: "0",
          },
        ],
      };
    }
    return { rows: [] };
  };

  const est = await estruturaService.obterEstruturaAcompanhamento("obra-1");
  assert.ok(est);
  assert.equal(est.etapas.length, 1);
  const srv = est.etapas[0].servicos[0];
  assert.equal(srv.unidade_medida, "m²");
  assert.equal(srv.quantidade_orcada, 48.5);
  assert.equal(srv.preco_unitario, 100);
  assert.equal(srv.preco_total_orcado, 4850);
});
