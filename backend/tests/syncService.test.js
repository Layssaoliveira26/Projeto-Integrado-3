const test = require("node:test");
const assert = require("node:assert/strict");

const obraService = require("../src/services/obraService");
const medicaoService = require("../src/services/medicaoService");
const syncRepository = require("../src/repositories/syncRepository");
const syncService = require("../src/services/syncService");

test("Etapa 3 - ordenarOperacoes respeita hierarquia de chaves estrangeiras (obras -> planilhas -> ciclos -> medicoes -> fotos)", () => {
  const desordenados = [
    { id: "f1", tabela_referencia: "fotografias", created_at: "2026-01-01T10:05:00Z" },
    { id: "m1", tabela_referencia: "medicoes", created_at: "2026-01-01T10:04:00Z" },
    { id: "o1", tabela_referencia: "obras", created_at: "2026-01-01T10:01:00Z" },
    { id: "p1", tabela_referencia: "planilhas_base", created_at: "2026-01-01T10:02:00Z" },
    { id: "c1", tabela_referencia: "ciclos_medicao", created_at: "2026-01-01T10:03:00Z" },
  ];

  const ordenados = syncService.ordenarOperacoes(desordenados);
  assert.deepEqual(
    ordenados.map((i) => i.tabela_referencia),
    ["obras", "planilhas_base", "ciclos_medicao", "medicoes", "fotografias"]
  );
});

test("Etapa 3 - processarPushLote processa itens validando usuarioId e isola falhas individuais (RF31 / RNF09 / RNF13)", async () => {
  const usuarioAutenticado = "user-uuid-123";

  // Mocks isolados
  const origCriarObra = obraService.criarObra;
  const origRegistrarMedicao = medicaoService.registrarOuAtualizarMedicao;
  const origUpsertFoto = syncRepository.upsertFotografia;

  try {
    obraService.criarObra = async (dados) => {
      assert.equal(dados.usuarioId, usuarioAutenticado);
      return { id: dados.id, nome: dados.nome };
    };

    medicaoService.registrarOuAtualizarMedicao = async (dados) => {
      if (dados.servico_id === "servico-invalido") {
        throw new Error("Serviço não encontrado.");
      }
      assert.equal(dados.usuario_id, usuarioAutenticado);
      return { id: dados.id, quantidade_medida_periodo: dados.quantidade_medida_periodo };
    };

    syncRepository.upsertFotografia = async (dados) => {
      assert.equal(dados.usuario_id, usuarioAutenticado);
      return { id: dados.id, sincronizado: true };
    };

    const lote = [
      {
        id: "fila-1",
        tabela_referencia: "medicoes",
        registro_id: "med-ok",
        operacao: "insert",
        payload: JSON.stringify({
          id: "med-ok",
          ciclo_id: "ciclo-1",
          servico_id: "servico-ok",
          quantidade_medida_periodo: "4.0000",
        }),
      },
      {
        id: "fila-2",
        tabela_referencia: "medicoes",
        registro_id: "med-erro",
        operacao: "insert",
        payload: JSON.stringify({
          id: "med-erro",
          ciclo_id: "ciclo-1",
          servico_id: "servico-invalido",
          quantidade_medida_periodo: "2.0000",
        }),
      },
      {
        id: "fila-3",
        tabela_referencia: "obras",
        registro_id: "obra-1",
        operacao: "insert",
        payload: JSON.stringify({
          id: "obra-1",
          nome: "Obra Offline",
          endereco: "Rua A, 100",
        }),
      },
      {
        id: "fila-4",
        tabela_referencia: "fotografias",
        registro_id: "foto-1",
        operacao: "insert",
        payload: JSON.stringify({
          id: "foto-1",
          obra_id: "obra-1",
          ciclo_id: "ciclo-1",
          servico_id: "servico-ok",
          caminho_local: "file:///foto.jpg",
        }),
      },
    ];

    const res = await syncService.processarPushLote(lote, usuarioAutenticado);

    // 3 itens devem sincronizar com sucesso e 1 deve ficar registrado em falhas sem abortar os demais
    assert.equal(res.sincronizados.length, 3);
    assert.equal(res.falhas.length, 1);
    assert.equal(res.falhas[0].fila_id, "fila-2");
    assert.match(res.falhas[0].erro, /Serviço não encontrado/);
  } finally {
    obraService.criarObra = origCriarObra;
    medicaoService.registrarOuAtualizarMedicao = origRegistrarMedicao;
    syncRepository.upsertFotografia = origUpsertFoto;
  }
});

test("Etapa 3 - Rejeita sincronização sem usuário autenticado (RNF09)", async () => {
  await assert.rejects(
    async () => {
      await syncService.processarPushLote([], null);
    },
    /Usuário autenticado é obrigatório/
  );

  await assert.rejects(
    async () => {
      await syncService.obterPullEstado(null);
    },
    /Usuário autenticado é obrigatório/
  );
});
