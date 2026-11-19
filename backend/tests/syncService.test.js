const test = require("node:test");
const assert = require("node:assert/strict");

const { pool } = require("../src/config/db");
const obraRepository = require("../src/repositories/obraRepository");
const obraService = require("../src/services/obraService");
const medicaoService = require("../src/services/medicaoService");
const syncRepository = require("../src/repositories/syncRepository");
const syncService = require("../src/services/syncService");

test("ordenarOperacoes respeita hierarquia de chaves estrangeiras (obras -> planilhas -> ciclos -> medicoes -> fotos)", () => {
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

test("processarPushLote processa itens validando usuarioId e isola falhas individuais", async () => {
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

test("processarPushLote e obterPullEstado rejeitam sincronização sem usuário autenticado", async () => {
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

test("Excluir obra remove dependências na ordem correta dentro de uma transação", async () => {
  const connectOriginal = pool.connect;
  const queries = [];

  pool.connect = async () => ({
    query: async (sql, params) => {
      queries.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.includes("SELECT id FROM obras")) {
        return { rows: [{ id: "obra-1" }] };
      }
      if (sql.includes("DELETE FROM obras")) {
        return { rows: [{ id: "obra-1" }] };
      }
      return { rows: [] };
    },
    release: () => {},
  });

  try {
    const resultado = await obraRepository.deletar("obra-1", "usuario-1");

    assert.equal(resultado.id, "obra-1");
    assert.equal(queries[0].sql, "BEGIN");
    assert.ok(
      queries.findIndex((query) => query.sql.startsWith("DELETE FROM fotos_medicao")) <
        queries.findIndex((query) => query.sql.startsWith("DELETE FROM medicoes"))
    );
    assert.ok(
      queries.findIndex((query) => query.sql.startsWith("DELETE FROM servicos")) <
        queries.findIndex((query) => query.sql.startsWith("DELETE FROM etapas"))
    );
    assert.ok(
      queries.findIndex((query) => query.sql.startsWith("DELETE FROM etapas")) <
        queries.findIndex((query) => query.sql.startsWith("DELETE FROM obras"))
    );
    assert.equal(queries[queries.length - 1].sql, "COMMIT");
  } finally {
    pool.connect = connectOriginal;
  }
});

test("Excluir obra reverte a transação quando a limpeza de dependências falha", async () => {
  const connectOriginal = pool.connect;
  const queries = [];

  pool.connect = async () => ({
    query: async (sql) => {
      const normalizedSql = sql.replace(/\s+/g, " ").trim();
      queries.push(normalizedSql);
      if (sql.includes("SELECT id FROM obras")) {
        return { rows: [{ id: "obra-1" }] };
      }
      if (sql.includes("DELETE FROM etapas")) {
        throw new Error('violação da FK "etapas_obra_id_fkey"');
      }
      return { rows: [] };
    },
    release: () => {},
  });

  try {
    await assert.rejects(
      obraRepository.deletar("obra-1", "usuario-1"),
      /etapas_obra_id_fkey/
    );
    assert.ok(queries.includes("ROLLBACK"));
    assert.ok(!queries.includes("COMMIT"));
    assert.ok(!queries.some((sql) => sql.startsWith("DELETE FROM obras")));
  } finally {
    pool.connect = connectOriginal;
  }
});

test("ordenarOperacoes ordena múltiplos ciclos offline na sequência Medições Ciclo 1 -> Encerrar Ciclo 1 -> Medições Ciclo 2", async () => {
  const planilhaService = require("../src/services/planilhaService");
  const origImportarPlanilha = planilhaService.importarPlanilhaBase;

  let cicloInicialRecebido = null;
  try {
    planilhaService.importarPlanilhaBase = async (dados) => {
      cicloInicialRecebido = dados.cicloInicialId;
      return { sucesso: true };
    };

    const loteMultiCiclo = [
      {
        id: "m-ciclo2",
        tabela_referencia: "medicoes",
        registro_id: "med-2",
        operacao: "insert",
        created_at: "2026-01-01T10:05:00Z",
        payload: JSON.stringify({ ciclo_id: "ciclo-2", servico_id: "s1", quantidade_medida_periodo: "5" }),
      },
      {
        id: "encerrar-ciclo1",
        tabela_referencia: "ciclos_medicao",
        registro_id: "ciclo-1",
        operacao: "update",
        created_at: "2026-01-01T10:04:00Z",
        payload: JSON.stringify({ acao: "encerrar", ciclo_encerrado_id: "ciclo-1" }),
      },
      {
        id: "m-ciclo1",
        tabela_referencia: "medicoes",
        registro_id: "med-1",
        operacao: "insert",
        created_at: "2026-01-01T10:03:00Z",
        payload: JSON.stringify({ ciclo_id: "ciclo-1", servico_id: "s1", quantidade_medida_periodo: "10" }),
      },
      {
        id: "planilha-1",
        tabela_referencia: "planilhas_base",
        registro_id: "obra-1",
        operacao: "insert",
        created_at: "2026-01-01T10:02:00Z",
        payload: JSON.stringify({ obra_id: "obra-1", ciclo_inicial_id: "uuid-ciclo-1-offline", etapas: [] }),
      },
      {
        id: "obra-1",
        tabela_referencia: "obras",
        registro_id: "obra-1",
        operacao: "insert",
        created_at: "2026-01-01T10:01:00Z",
        payload: JSON.stringify({ id: "obra-1", nome: "Obra Offline" }),
      },
    ];

    const ordenados = syncService.ordenarOperacoes(loteMultiCiclo);
    assert.deepEqual(
      ordenados.map((i) => i.id),
      ["obra-1", "planilha-1", "m-ciclo1", "encerrar-ciclo1", "m-ciclo2"]
    );

    await syncService.processarItemFila(loteMultiCiclo[3], "user-123");
    assert.equal(cicloInicialRecebido, "uuid-ciclo-1-offline");
  } finally {
    planilhaService.importarPlanilhaBase = origImportarPlanilha;
  }
});

test("Segurança (IDOR): upsertFotografia rejeita fotografia para obra de outro usuário", async () => {
  const queryOriginal = pool.query;
  try {
    pool.query = async (sql) => {
      if (sql.includes("CREATE TABLE IF NOT EXISTS fotografias") || sql.includes("ALTER TABLE fotografias")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT usuario_id FROM obras")) {
        return { rows: [{ usuario_id: "outro-usuario" }] };
      }
      throw new Error(`Query inesperada: ${sql}`);
    };

    await assert.rejects(
      async () => {
        await syncRepository.upsertFotografia({
          id: "foto-idor-1",
          obra_id: "obra-alheia",
          ciclo_id: "ciclo-1",
          servico_id: "srv-1",
          usuario_id: "usuario-atacante",
          caminho_local: "file:///foto.jpg",
        });
      },
      /Sem permissão para sincronizar fotografia nesta obra/
    );
  } finally {
    pool.query = queryOriginal;
  }
});

test("Segurança (IDOR): upsertMedicaoSincronizadaDireta rejeita medição para obra de outro usuário", async () => {
  const queryOriginal = pool.query;
  try {
    pool.query = async (sql) => {
      if (sql.includes("FROM servicos s") && sql.includes("INNER JOIN obras o")) {
        return { rows: [{ id: "srv-1", obra_id: "obra-alheia", usuario_id: "outro-usuario" }] };
      }
      throw new Error(`Query inesperada: ${sql}`);
    };

    await assert.rejects(
      async () => {
        await syncRepository.upsertMedicaoSincronizadaDireta({
          id: "med-idor-1",
          ciclo_id: "ciclo-1",
          servico_id: "srv-1",
          usuario_id: "usuario-atacante",
          quantidade_medida_periodo: "5",
        });
      },
      /Sem permissão para sincronizar medição nesta obra/
    );
  } finally {
    pool.query = queryOriginal;
  }
});

test("processarItemFila atualiza dados cadastrais em obra arquivada e separa intenções de arquivar e encerrar", async () => {
  const origAtualizar = obraService.atualizarObra;
  const origArquivar = obraService.arquivarObra;
  const origEncerrar = obraService.encerrarObra;
  const origAtualizarCapa = syncRepository.atualizarImagemCapaObra;

  const chamadas = [];
  try {
    obraService.atualizarObra = async (id, usuarioId, dados) => {
      chamadas.push({ tipo: "atualizar", id, usuarioId, dados });
      return { id, ...dados, status: "arquivada" };
    };
    obraService.arquivarObra = async (id, usuarioId) => {
      chamadas.push({ tipo: "arquivar", id, usuarioId });
      return { id, status: "arquivada" };
    };
    obraService.encerrarObra = async (id, usuarioId) => {
      chamadas.push({ tipo: "encerrar", id, usuarioId });
      return { id, status: "encerrada" };
    };
    syncRepository.atualizarImagemCapaObra = async () => null;

    // Caso 1: editar dados de uma obra cujo status já é 'arquivada'
    await syncService.processarItemFila(
      {
        id: "fila-upd-1",
        tabela_referencia: "obras",
        registro_id: "obra-arq-1",
        operacao: "update",
        acao: "atualizar_dados",
        payload: JSON.stringify({
          id: "obra-arq-1",
          nome: "Obra Editada Mesmo Arquivada",
          endereco: "Rua B, 200",
          status: "arquivada",
          acao: "atualizar_dados",
        }),
      },
      "user-1"
    );

    assert.equal(chamadas.length, 1);
    assert.equal(chamadas[0].tipo, "atualizar");
    assert.equal(chamadas[0].dados.nome, "Obra Editada Mesmo Arquivada");

    // Caso 2: intenção explícita de encerrar
    await syncService.processarItemFila(
      {
        id: "fila-enc-1",
        tabela_referencia: "obras",
        registro_id: "obra-arq-1",
        operacao: "update",
        acao: "encerrar",
        payload: JSON.stringify({
          id: "obra-arq-1",
          status: "encerrada",
          acao: "encerrar",
        }),
      },
      "user-1"
    );

    assert.equal(chamadas.length, 2);
    assert.equal(chamadas[1].tipo, "encerrar");

    // Caso 3: payload legado sem acao com nome + status='arquivada' executa ambos
    await syncService.processarItemFila(
      {
        id: "fila-leg-1",
        tabela_referencia: "obras",
        registro_id: "obra-2",
        operacao: "update",
        payload: JSON.stringify({
          id: "obra-2",
          nome: "Obra Legada",
          endereco: "Rua C",
          status: "arquivada",
        }),
      },
      "user-1"
    );

    assert.equal(chamadas[2].tipo, "atualizar");
    assert.equal(chamadas[3].tipo, "arquivar");
  } finally {
    obraService.atualizarObra = origAtualizar;
    obraService.arquivarObra = origArquivar;
    obraService.encerrarObra = origEncerrar;
    syncRepository.atualizarImagemCapaObra = origAtualizarCapa;
  }
});

test("processarPushLote classifica erros permanentes e transitórios protegendo registros dependentes da mesma obra", async () => {
  const origCriarObra = obraService.criarObra;
  const origImportarPlanilha = require("../src/services/planilhaService").importarPlanilhaBase;
  const origRegistrarMedicao = medicaoService.registrarOuAtualizarMedicao;

  try {
    obraService.criarObra = async () => {
      const err = new Error("Conexão PostgreSQL indisponível");
      err.code = "08006";
      throw err;
    };

    require("../src/services/planilhaService").importarPlanilhaBase = async () => {
      const err = new Error("Obra não encontrada.");
      err.statusCode = 404;
      throw err;
    };

    medicaoService.registrarOuAtualizarMedicao = async () => {
      const err = new Error(
        "Para serviços com unidade inteira (UN), a quantidade medida não pode conter casas decimais fracionárias."
      );
      err.statusCode = 400;
      throw err;
    };

    const res = await syncService.processarPushLote(
      [
        {
          id: "f-obra",
          tabela_referencia: "obras",
          registro_id: "obra-x",
          operacao: "insert",
          payload: JSON.stringify({ id: "obra-x", nome: "Teste" }),
        },
        {
          id: "f-planilha",
          tabela_referencia: "planilhas_base",
          registro_id: "obra-x",
          operacao: "insert",
          payload: JSON.stringify({ obra_id: "obra-x", etapas: [] }),
        },
        {
          id: "f-med-400",
          tabela_referencia: "medicoes",
          registro_id: "med-bad",
          operacao: "insert",
          payload: JSON.stringify({
            ciclo_id: "ciclo-ok",
            servico_id: "srv-ok",
            quantidade_medida_periodo: "1.5",
          }),
        },
      ],
      "user-1"
    );

    assert.equal(res.falhas.length, 3);
    assert.equal(res.falhas[0].permanente, false);
    assert.equal(res.falhas[1].permanente, false);
    assert.equal(res.falhas[2].permanente, true);
  } finally {
    obraService.criarObra = origCriarObra;
    require("../src/services/planilhaService").importarPlanilhaBase = origImportarPlanilha;
    medicaoService.registrarOuAtualizarMedicao = origRegistrarMedicao;
  }
});

test("obterPullEstado realiza sincronização incremental (Delta Pull) com tombstones e sem trafegar arquivo_base64", async () => {
  const queryOriginal = pool.query;
  const sqls = [];
  syncRepository.resetarCacheVerificacaoTabelas();

  try {
    pool.query = async (sql, params) => {
      sqls.push({ sql: sql.replace(/\s+/g, " ").trim(), params });
      if (sql.includes("FROM registros_excluidos_sync")) {
        return {
          rows: [
            {
              tabela_referencia: "obras",
              registro_id: "obra-del-1",
              deleted_at: "2026-11-18T12:00:00.000Z",
            },
          ],
        };
      }
      if (sql.includes("FROM obras")) {
        return { rows: [{ id: "obra-1", nome: "Obra Delta" }] };
      }
      return { rows: [] };
    };

    const res = await syncService.obterPullEstado("user-delta", {
      since: "2026-11-18T10:00:00.000Z",
    });

    assert.equal(res.modo, "delta");
    assert.equal(res.obras.length, 1);
    assert.equal(res.excluidos.length, 1);
    assert.equal(res.excluidos[0].registro_id, "obra-del-1");
    assert.ok(res.timestamp);
    assert.ok(
      sqls.some((q) => q.sql.includes("updated_at > $2::timestamptz")),
      "Delta Pull deve filtrar registros por updated_at > since"
    );
    const queryFotos = sqls.find((q) => q.sql.includes("FROM fotografias f"));
    assert.ok(queryFotos);
    assert.ok(
      !queryFotos.sql.includes("SELECT f.*"),
      "Pull não deve trazer SELECT f.* para evitar trafegar arquivo_base64"
    );
    assert.ok(queryFotos.sql.includes("possui_arquivo_nuvem"));
  } finally {
    pool.query = queryOriginal;
    syncRepository.resetarCacheVerificacaoTabelas();
  }
});

test("encerrarCicloIdempotente preserva chave estrangeira de ciclos com medições e evita fallback indevido para o Ciclo 1", async () => {
  const connectOriginal = pool.connect;
  const queryOriginal = pool.query;
  const queriesTx = [];

  pool.connect = async () => ({
    query: async (sql) => {
      const norm = sql.replace(/\s+/g, " ").trim();
      queriesTx.push(norm);
      if (norm.includes("FROM ciclos_medicao c")) {
        return { rows: [{ id: "c1", obra_id: "o1", numero_ciclo: 1, usuario_id: "u1" }] };
      }
      if (norm.includes("INSERT INTO ciclos_medicao")) {
        return { rows: [{ id: "c2", obra_id: "o1", numero_ciclo: 2, status: "aberto" }] };
      }
      return { rows: [] };
    },
    release: () => {},
  });

  pool.query = async (sql) => {
    if (sql.includes("FROM servicos s")) {
      return { rows: [{ id: "s1", obra_id: "o1", usuario_id: "u1" }] };
    }
    return { rows: [] };
  };

  try {
    const ciclo2 = await syncRepository.encerrarCicloIdempotente({
      cicloEncerradoId: "c1",
      obraId: "o1",
      novoCiclo: { id: "c2", numero_ciclo: 2 },
      usuarioId: "u1",
    });
    assert.equal(ciclo2.numero_ciclo, 2);

    const insertCicloSql = queriesTx.find((q) =>
      q.startsWith("INSERT INTO ciclos_medicao")
    );
    assert.ok(
      insertCicloSql.includes("WHEN EXISTS (SELECT 1 FROM medicoes WHERE ciclo_id = ciclos_medicao.id)"),
      "Deve proteger ID de ciclo que já possui medições/fotos vinculadas"
    );

    await assert.rejects(
      async () => {
        await syncRepository.upsertMedicaoSincronizadaDireta({
          id: "m1",
          ciclo_id: "c-inexistente",
          servico_id: "s1",
          usuario_id: "u1",
          quantidade_medida_periodo: "3",
        });
      },
      /Ciclo de medição correspondente não encontrado/
    );
  } finally {
    pool.connect = connectOriginal;
    pool.query = queryOriginal;
  }
});

test("salvarArquivoFoto e obterArquivoFoto validam propriedade da obra contra acesso indevido entre usuários", async () => {
  const queryOriginal = pool.query;
  syncRepository.resetarCacheVerificacaoTabelas();

  let bancoFoto = {
    id: "foto-1",
    obra_usuario_id: "dono-1",
    arquivo_base64: null,
    url_nuvem: null,
  };

  pool.query = async (sql, params) => {
    if (sql.includes("CREATE TABLE IF NOT EXISTS fotografias") || sql.includes("ALTER TABLE fotografias")) {
      return { rows: [] };
    }
    if (sql.includes("SELECT f.id") && sql.includes("FROM fotografias f")) {
      return { rows: [bancoFoto] };
    }
    if (sql.includes("UPDATE fotografias")) {
      bancoFoto = {
        ...bancoFoto,
        arquivo_base64: params[0],
        url_nuvem: params[1],
        updated_at: "2026-11-18T12:00:00Z",
      };
      return {
        rows: [
          {
            id: bancoFoto.id,
            url_nuvem: bancoFoto.url_nuvem,
            updated_at: bancoFoto.updated_at,
          },
        ],
      };
    }
    return { rows: [] };
  };

  try {
    await assert.rejects(
      async () => {
        await syncService.salvarArquivoFoto("foto-1", "invasor", "data:image/jpeg;base64,ABC");
      },
      /Sem permissão para enviar arquivo desta fotografia/
    );

    const salvo = await syncService.salvarArquivoFoto(
      "foto-1",
      "dono-1",
      "data:image/jpeg;base64,ABC123"
    );
    assert.equal(salvo.url_nuvem, "/sync/fotos/foto-1/arquivo");

    await assert.rejects(
      async () => {
        await syncService.obterArquivoFoto("foto-1", "invasor");
      },
      /Sem permissão para acessar arquivo desta fotografia/
    );

    const baixado = await syncService.obterArquivoFoto("foto-1", "dono-1");
    assert.equal(baixado.base64, "data:image/jpeg;base64,ABC123");
    assert.equal(baixado.url_nuvem, "/sync/fotos/foto-1/arquivo");
  } finally {
    pool.query = queryOriginal;
    syncRepository.resetarCacheVerificacaoTabelas();
  }
});

test("ordenarOperacoes desempata encerramento de ciclo e medições subsequentes registradas no mesmo milissegundo", async () => {
  const mesmoMs = "2026-11-19T00:00:00.000Z";

  // 1) Sem ordem_fila, mas com ciclo_id apontando para novo_ciclo.id (e medição anterior no Ciclo 1)
  const itensSemOrdem = [
    {
      id: "fila-med-c2",
      tabela_referencia: "medicoes",
      registro_id: "med-c2",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({
        id: "med-c2",
        ciclo_id: "ciclo-2",
        numero_ciclo: 2,
        servico_id: "srv-2",
        quantidade_medida_periodo: "12.5",
      }),
    },
    {
      id: "fila-ciclo-enc",
      tabela_referencia: "ciclos_medicao",
      registro_id: "ciclo-1",
      operacao: "update",
      created_at: mesmoMs,
      payload: JSON.stringify({
        acao: "encerrar",
        ciclo_encerrado_id: "ciclo-1",
        obra_id: "obra-1",
        novo_ciclo: { id: "ciclo-2", obra_id: "obra-1", numero_ciclo: 2 },
      }),
    },
    {
      id: "fila-med-c1",
      tabela_referencia: "medicoes",
      registro_id: "med-c1",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({
        id: "med-c1",
        ciclo_id: "ciclo-1",
        numero_ciclo: 1,
        servico_id: "srv-1",
        quantidade_medida_periodo: "4",
      }),
    },
  ];

  const ordenados = syncService.ordenarOperacoes(itensSemOrdem);
  assert.deepEqual(
    ordenados.map((i) => i.id),
    ["fila-med-c1", "fila-ciclo-enc", "fila-med-c2"]
  );

  // 2) Com ordem_fila do SQLite, ordem_fila tem precedência no desempate no mesmo ms
  const comOrdem = syncService.ordenarOperacoes([
    { ...itensSemOrdem[0], ordem_fila: 3 },
    { ...itensSemOrdem[1], ordem_fila: 2 },
    { ...itensSemOrdem[2], ordem_fila: 1 },
  ]);
  assert.deepEqual(
    comOrdem.map((i) => i.id),
    ["fila-med-c1", "fila-ciclo-enc", "fila-med-c2"]
  );

  // 3) upsertMedicaoSincronizadaDireta não deve cair no Ciclo 1 aberto se numero_ciclo > 1
  const queryOriginal = pool.query;
  const sqls = [];
  pool.query = async (sql) => {
    sqls.push(sql);
    if (sql.includes("FROM servicos s")) {
      return { rows: [{ id: "srv-2", obra_id: "obra-1", usuario_id: "u1" }] };
    }
    return { rows: [] };
  };

  try {
    await assert.rejects(
      async () => {
        await syncRepository.upsertMedicaoSincronizadaDireta({
          id: "med-c2",
          ciclo_id: "ciclo-2-inexistente",
          numero_ciclo: 2,
          servico_id: "srv-2",
          usuario_id: "u1",
          quantidade_medida_periodo: "12.5",
        });
      },
      /Ciclo de medição correspondente não encontrado/
    );
    assert.equal(
      sqls.some((s) => s.includes("status = 'aberto' ORDER BY numero_ciclo DESC")),
      false,
      "Não deve consultar último ciclo aberto como fallback quando numero_ciclo > 1"
    );
  } finally {
    pool.query = queryOriginal;
  }
});

test("processarItemFila sincroniza histórico de prazos com isolamento por usuário sem duplicar registros", async () => {
  const queryOriginal = pool.query;
  const atualizarOriginal = obraService.atualizarObra;
  const chamadasHistorico = [];
  let pularAutoRecebido = null;

  obraService.atualizarObra = async (id, usuarioId, dados) => {
    pularAutoRecebido = dados.pularHistoricoAutomatico;
    return { id, ...dados };
  };

  pool.query = async (sql, params) => {
    if (sql.includes("FROM obras WHERE id = $1")) {
      return { rows: [{ usuario_id: "user-dono" }] };
    }
    if (sql.includes("INSERT INTO historico_datas_obra")) {
      chamadasHistorico.push(params);
      return {
        rows: [
          {
            id: params[0],
            obra_id: params[1],
            data_anterior: params[3],
            data_conclusao: params[4],
            dias_adicionados: params[5],
          },
        ],
      };
    }
    return { rows: [] };
  };

  try {
    await syncService.processarItemFila(
      {
        id: "fila-obra-1",
        tabela_referencia: "obras",
        registro_id: "obra-1",
        operacao: "update",
        acao: "atualizar_dados",
        payload: JSON.stringify({
          nome: "Obra Atualizada",
          endereco: "Rua 1",
          data_inicio: "2026-10-01",
          data_conclusao: "2027-01-15",
          historico_sincronizado_separado: true,
        }),
      },
      "user-dono"
    );
    assert.equal(pularAutoRecebido, true);

    const histSalvo = await syncService.processarItemFila(
      {
        id: "fila-hist-1",
        tabela_referencia: "historico_datas_obra",
        registro_id: "hist-1",
        operacao: "insert",
        payload: JSON.stringify({
          id: "hist-1",
          obra_id: "obra-1",
          data_anterior: "2026-12-01",
          data_conclusao: "2027-01-15",
          dias_adicionados: 45,
          created_at: "2026-11-19T00:00:00.000Z",
        }),
      },
      "user-dono"
    );
    assert.equal(histSalvo.id, "hist-1");
    assert.equal(chamadasHistorico.length, 1);

    await assert.rejects(
      async () => {
        await syncService.processarItemFila(
          {
            id: "fila-hist-idor",
            tabela_referencia: "historico_datas_obra",
            registro_id: "hist-2",
            operacao: "insert",
            payload: JSON.stringify({
              id: "hist-2",
              obra_id: "obra-1",
              data_anterior: "2026-12-01",
              data_conclusao: "2027-02-01",
              dias_adicionados: 62,
            }),
          },
          "invasor"
        );
      },
      /Sem permissão/
    );
  } finally {
    pool.query = queryOriginal;
    obraService.atualizarObra = atualizarOriginal;
  }
});

test("ordenarOperacoes mantém ordem transitiva determinística em todas as permutações de múltiplos ciclos", () => {
  const gerarPermutacoes = (arr) => {
    if (arr.length <= 1) return [arr];
    const resultado = [];
    for (let i = 0; i < arr.length; i++) {
      const atual = arr[i];
      const resto = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const perm of gerarPermutacoes(resto)) {
        resultado.push([atual, ...perm]);
      }
    }
    return resultado;
  };

  const mesmoMs = "2026-11-19T10:00:00.000Z";

  // 1) Todas as 6 permutações com payload mínimo (sem numero_ciclo nas medições e sem novo_ciclo)
  const baseMinima = [
    {
      id: "med-c1",
      tabela_referencia: "medicoes",
      registro_id: "m1",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({ ciclo_id: "ciclo-1", servico_id: "s1", quantidade_medida_periodo: "10" }),
    },
    {
      id: "enc-c1",
      tabela_referencia: "ciclos_medicao",
      registro_id: "ciclo-1",
      operacao: "update",
      created_at: mesmoMs,
      payload: JSON.stringify({ acao: "encerrar", ciclo_encerrado_id: "ciclo-1" }),
    },
    {
      id: "med-c2",
      tabela_referencia: "medicoes",
      registro_id: "m2",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({ ciclo_id: "ciclo-2", servico_id: "s1", quantidade_medida_periodo: "5" }),
    },
  ];

  const perms3 = gerarPermutacoes(baseMinima);
  assert.equal(perms3.length, 6);
  for (const perm of perms3) {
    const ordenados = syncService.ordenarOperacoes(perm);
    assert.deepEqual(
      ordenados.map((i) => i.id),
      ["med-c1", "enc-c1", "med-c2"],
      `Falha de transitividade na permutação [${perm.map((p) => p.id).join(", ")}]`
    );
  }

  // 2) Todas as 120 permutações (5!) de cadeia de 3 ciclos no mesmo ms
  const cadeiaTresCiclos = [
    {
      id: "med-c1",
      tabela_referencia: "medicoes",
      registro_id: "m1",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({ ciclo_id: "c1", servico_id: "s1", quantidade_medida_periodo: "2" }),
    },
    {
      id: "enc-c1",
      tabela_referencia: "ciclos_medicao",
      registro_id: "c1",
      operacao: "update",
      created_at: mesmoMs,
      payload: JSON.stringify({
        acao: "encerrar",
        ciclo_encerrado_id: "c1",
        novo_ciclo: { id: "c2" },
      }),
    },
    {
      id: "med-c2",
      tabela_referencia: "medicoes",
      registro_id: "m2",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({ ciclo_id: "c2", servico_id: "s1", quantidade_medida_periodo: "3" }),
    },
    {
      id: "enc-c2",
      tabela_referencia: "ciclos_medicao",
      registro_id: "c2",
      operacao: "update",
      created_at: mesmoMs,
      payload: JSON.stringify({
        acao: "encerrar",
        ciclo_encerrado_id: "c2",
        novo_ciclo: { id: "c3" },
      }),
    },
    {
      id: "med-c3",
      tabela_referencia: "medicoes",
      registro_id: "m3",
      operacao: "insert",
      created_at: mesmoMs,
      payload: JSON.stringify({ ciclo_id: "c3", servico_id: "s1", quantidade_medida_periodo: "4" }),
    },
  ];

  const perms5 = gerarPermutacoes(cadeiaTresCiclos);
  assert.equal(perms5.length, 120);
  for (const perm of perms5) {
    const ordenados = syncService.ordenarOperacoes(perm);
    assert.deepEqual(
      ordenados.map((i) => i.id),
      ["med-c1", "enc-c1", "med-c2", "enc-c2", "med-c3"]
    );
  }
});

test("processarPushLote propaga falhas reais ao salvar imagem de capa ou alterar status mantendo idempotência", async () => {
  const origCriar = obraService.criarObra;
  const origAtualizar = obraService.atualizarObra;
  const origArquivar = obraService.arquivarObra;
  const origEncerrar = obraService.encerrarObra;
  const origCapa = syncRepository.atualizarImagemCapaObra;

  try {
    obraService.criarObra = async (dados) => ({ id: dados.id, nome: dados.nome, status: "ativa" });
    obraService.atualizarObra = async (id, _u, dados) => ({ id, ...dados, status: "ativa" });

    syncRepository.atualizarImagemCapaObra = async (id) => {
      if (id === "obra-falha-capa-ins" || id === "obra-falha-capa-upd") {
        const err = new Error("Falha de escrita ao salvar imagem_capa no banco");
        err.code = "08006";
        throw err;
      }
      return { id, imagem_capa: "ok" };
    };

    obraService.arquivarObra = async (id) => {
      if (id === "obra-ja-arquivada") {
        throw new Error("Esta obra já está arquivada.");
      }
      throw new Error("Erro ao persistir arquivamento da obra");
    };

    obraService.encerrarObra = async (id) => {
      if (id === "obra-ja-encerrada") {
        throw new Error("Esta obra já está encerrada.");
      }
      throw new Error("Erro ao persistir encerramento da obra");
    };

    const lote = [
      {
        id: "f-capa-ins",
        tabela_referencia: "obras",
        registro_id: "obra-falha-capa-ins",
        operacao: "insert",
        payload: JSON.stringify({
          id: "obra-falha-capa-ins",
          nome: "Obra 1",
          imagem_capa: "data:image/jpeg;base64,AAA",
        }),
      },
      {
        id: "f-arq-ins",
        tabela_referencia: "obras",
        registro_id: "obra-falha-arq-ins",
        operacao: "insert",
        payload: JSON.stringify({
          id: "obra-falha-arq-ins",
          nome: "Obra 2",
          status: "arquivada",
        }),
      },
      {
        id: "f-capa-upd",
        tabela_referencia: "obras",
        registro_id: "obra-falha-capa-upd",
        operacao: "update",
        acao: "atualizar_dados",
        payload: JSON.stringify({
          nome: "Obra 3",
          imagem_capa: "data:image/jpeg;base64,BBB",
        }),
      },
      {
        id: "f-enc-upd",
        tabela_referencia: "obras",
        registro_id: "obra-falha-enc-upd",
        operacao: "update",
        payload: JSON.stringify({
          nome: "Obra 4",
          status: "encerrada",
        }),
      },
      {
        id: "f-idemp-arq",
        tabela_referencia: "obras",
        registro_id: "obra-ja-arquivada",
        operacao: "insert",
        payload: JSON.stringify({
          id: "obra-ja-arquivada",
          nome: "Obra Idempotente Arq",
          status: "arquivada",
        }),
      },
      {
        id: "f-idemp-enc",
        tabela_referencia: "obras",
        registro_id: "obra-ja-encerrada",
        operacao: "update",
        payload: JSON.stringify({
          nome: "Obra Idempotente Enc",
          status: "encerrada",
        }),
      },
    ];

    const res = await syncService.processarPushLote(lote, "user-1");

    assert.equal(res.falhas.length, 4, "Os 4 erros reais de capa/status devem ser reportados em falhas");
    assert.deepEqual(
      res.falhas.map((f) => f.fila_id),
      ["f-capa-ins", "f-arq-ins", "f-capa-upd", "f-enc-upd"]
    );
    assert.equal(res.sincronizados.length, 2, "Casos genuinamente idempotentes continuam sincronizados");
    assert.deepEqual(
      res.sincronizados.map((s) => s.fila_id),
      ["f-idemp-arq", "f-idemp-enc"]
    );
  } finally {
    obraService.criarObra = origCriar;
    obraService.atualizarObra = origAtualizar;
    obraService.arquivarObra = origArquivar;
    obraService.encerrarObra = origEncerrar;
    syncRepository.atualizarImagemCapaObra = origCapa;
  }
});

