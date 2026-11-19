const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

function criarSqliteEmMemoria() {
  const nativeDb = new DatabaseSync(":memory:");
  let txDepth = 0;

  const sanitize = (params = []) =>
    (params || []).map((v) => (v === undefined ? null : v));

  return {
    nativeDb,
    txCalls: 0,
    async execAsync(sql) {
      nativeDb.exec(sql);
    },
    async runAsync(sql, params = []) {
      const stmt = nativeDb.prepare(sql);
      return stmt.run(...sanitize(params));
    },
    async getFirstAsync(sql, params = []) {
      const stmt = nativeDb.prepare(sql);
      return stmt.get(...sanitize(params)) || null;
    },
    async getAllAsync(sql, params = []) {
      const stmt = nativeDb.prepare(sql);
      return stmt.all(...sanitize(params));
    },
    async withTransactionAsync(fn) {
      this.txCalls += 1;
      txDepth += 1;
      const isOuter = txDepth === 1;
      if (isOuter) nativeDb.exec("BEGIN");
      try {
        const res = await fn();
        if (isOuter) nativeDb.exec("COMMIT");
        return res;
      } catch (err) {
        if (isOuter) {
          try {
            nativeDb.exec("ROLLBACK");
          } catch {}
        }
        throw err;
      } finally {
        txDepth -= 1;
      }
    },
  };
}

function transformarEsmParaCjs(codigo) {
  let out = codigo;
  out = out.replace(
    /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
    'const $1 = require("$2");'
  );
  out = out.replace(
    /import\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
    'const $1 = require("$2").default || require("$2");'
  );
  out = out.replace(
    /import\s+\{([\s\S]*?)\}\s+from\s+["']([^"']+)["'];?/g,
    (_, imports, mod) => `const {${imports.replace(/\bas\b/g, ":")}} = require("${mod}");`
  );
  out = out.replace(/export\s+const\s+(\w+)\s*=/g, "const $1 = exports.$1 =");
  out = out.replace(/export\s+function\s+(\w+)/g, "function $1");
  const fnExports = [...codigo.matchAll(/export\s+function\s+(\w+)/g)].map(
    (m) => m[1]
  );
  if (/export\s+default\s+\{/.test(out)) {
    out = out.replace(
      /export\s+default\s+\{([\s\S]*?)\};?\s*$/,
      (_, body) =>
        `Object.assign(module.exports, {${body}});\nmodule.exports.default = module.exports;`
    );
  } else {
    out = out.replace(
      /export\s+default\s+([^;]+);?/g,
      "module.exports.default = $1;"
    );
  }
  if (fnExports.length > 0) {
    out += `\n${fnExports.map((n) => `exports.${n} = ${n};`).join("\n")}\n`;
  }
  return out;
}

function carregarAmbienteSyncTeste() {
  const db = criarSqliteEmMemoria();

  // Extrai e aplica os DDL reais de mobile/src/database/index.js no SQLite em memória
  const dbIndexRaw = fs.readFileSync(
    path.join(__dirname, "../src/database/index.js"),
    "utf-8"
  );
  const dbIndexCode = transformarEsmParaCjs(
    dbIndexRaw.replace(
      'const SQLite = require("expo-sqlite");',
      'const SQLite = { openDatabaseAsync: async () => __TEST_DB__ };'
    )
  );

  let estadoRede = { isConnected: true, isInternetReachable: true };
  let listenerRede = null;
  let usuarioAtual = { id: "user-1", nome: "Engenheiro", email: "eng@obra.com" };
  let tokenAtual = "jwt-teste-123";

  const mockNetInfo = {
    default: {
      fetch: async () => estadoRede,
      addEventListener: (cb) => {
        listenerRede = cb;
        return () => {
          listenerRede = null;
        };
      },
    },
  };

  const mockStorage = {
    obterToken: async () => tokenAtual,
    obterUsuarioLocal: async () => usuarioAtual,
  };

  const cacheModulos = new Map();
  const baseSrc = path.join(__dirname, "../src");

  const compilarModulo = (absPath) => {
    if (cacheModulos.has(absPath)) return cacheModulos.get(absPath).exports;
    const raw = fs.readFileSync(absPath, "utf-8");
    const cjs = transformarEsmParaCjs(raw);
    const mod = { exports: {} };
    cacheModulos.set(absPath, mod);

    const localRequire = (specifier) => {
      if (specifier === "expo-sqlite") {
        return { openDatabaseAsync: async () => db };
      }
      if (specifier === "@react-native-community/netinfo") {
        return mockNetInfo;
      }
      if (specifier === "react-native") {
        return { Platform: { OS: "web" } };
      }
      if (specifier === "expo-file-system/legacy" || specifier === "expo-file-system") {
        throw new Error("Mock Web sem FS nativo");
      }
      if (specifier.endsWith("/storage") || specifier.endsWith("/storage.js")) {
        return mockStorage;
      }
      if (specifier.startsWith(".")) {
        const resolved = path.resolve(path.dirname(absPath), specifier);
        const comExt = fs.existsSync(resolved)
          ? resolved
          : fs.existsSync(`${resolved}.js`)
            ? `${resolved}.js`
            : path.join(resolved, "index.js");
        return compilarModulo(comExt);
      }
      return require(specifier);
    };

    const fn = new vm.Script(
      `(function(exports, require, module, __filename, __dirname, __TEST_DB__) {\n${cjs}\n})`,
      { filename: absPath }
    ).runInThisContext();
    fn(mod.exports, localRequire, mod, absPath, path.dirname(absPath), db);
    return mod.exports;
  };

  const dbMod = {
    SCHEMA_FOTOGRAFIAS_SQL: "",
    SCHEMA_OFFLINE_FIRST_SQL: "",
    getDbConnection: async () => db,
    initDb: async () => {},
  };
  // Executa initDb real do arquivo database/index.js usando __TEST_DB__
  const dbIndexMod = { exports: {} };
  new vm.Script(
    `(function(exports, require, module, __TEST_DB__) {\n${dbIndexCode}\n})`,
    { filename: path.join(baseSrc, "database/index.js") }
  ).runInThisContext()(
    dbIndexMod.exports,
    (s) => (s === "expo-sqlite" ? { openDatabaseAsync: async () => db } : require(s)),
    dbIndexMod,
    db
  );
  cacheModulos.set(path.join(baseSrc, "database/index.js"), dbIndexMod);

  return {
    db,
    initDb: dbIndexMod.exports.initDb,
    setNetState: (novo) => {
      estadoRede = novo;
      if (listenerRede) listenerRede(novo);
    },
    setUsuario: (u) => {
      usuarioAtual = u;
    },
    setToken: (t) => {
      tokenAtual = t;
    },
    syncQueueRepository: compilarModulo(
      path.join(baseSrc, "repositories/syncQueueRepository.js")
    ),
    obraLocalRepository: compilarModulo(
      path.join(baseSrc, "repositories/obraLocalRepository.js")
    ),
    cicloLocalRepository: compilarModulo(
      path.join(baseSrc, "repositories/cicloLocalRepository.js")
    ),
    medicaoLocalRepository: compilarModulo(
      path.join(baseSrc, "repositories/medicaoLocalRepository.js")
    ),
    fotografiaRepository: compilarModulo(
      path.join(baseSrc, "repositories/fotografiaRepository.js")
    ),
    syncManager: compilarModulo(path.join(baseSrc, "sync/syncManager.js")),
  };
}

test("Fila de sincronização preserva itens em envio contra cancelamento indevido ou perda de edição concorrente", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const {
    db,
    syncQueueRepository,
    obraLocalRepository,
  } = env;

  const obra = await obraLocalRepository.criarObraLocal(
    {
      id: "obra-voo-1",
      usuarioId: "user-1",
      nome: "Obra Em Voo",
      endereco: "Rua 1",
    },
    db
  );

  // Marca o insert como 'enviando' (simulando requisição HTTP em andamento)
  const pendentesAntes = await syncQueueRepository.listarItensPendentes(db, {
    usuarioId: "user-1",
  });
  assert.equal(pendentesAntes.length, 1);
  await syncQueueRepository.marcarItensEnviando([pendentesAntes[0].id], db);

  // Usuário exclui a obra enquanto o insert ainda está em voo
  await obraLocalRepository.deletarObraLocal(obra.id, db);

  const filaAposDelete = await db.getAllAsync(
    `SELECT * FROM fila_sincronizacao WHERE registro_id = ? ORDER BY created_at ASC, rowid ASC;`,
    [obra.id]
  );

  assert.equal(filaAposDelete.length, 2);
  assert.equal(filaAposDelete[0].operacao, "insert");
  assert.equal(filaAposDelete[0].status, "enviando");
  assert.equal(filaAposDelete[1].operacao, "delete");
  assert.equal(filaAposDelete[1].status, "pendente");

  // Mesmo após o insert terminar como sincronizado, possuiOutraPendenciaAtiva vê o delete pendente
  await syncQueueRepository.marcarItemSincronizado(filaAposDelete[0].id, db);
  const aindaTemPendencia =
    await syncQueueRepository.possuiOutraPendenciaAtiva("obras", obra.id, db);
  assert.equal(aindaTemPendencia, true);
});

test("Coalescência da fila separa atualização cadastral de mudanças de status e registra histórico de prazo offline", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const { db, obraLocalRepository, syncQueueRepository } = env;

  // Simula obra já sincronizada vinda do Pull
  await obraLocalRepository.upsertObraSincronizada(
    {
      id: "obra-synced-1",
      usuario_id: "user-1",
      nome: "Obra Original",
      endereco: "Av. Central",
      data_inicio: "2026-01-01",
      data_conclusao: "2026-06-01",
      status: "ativa",
    },
    db
  );

  // 1) Atualiza dados cadastrais e prorroga data_conclusao offline
  await obraLocalRepository.atualizarObraLocal(
    "obra-synced-1",
    {
      nome: "Obra Renomeada Offline",
      endereco: "Av. Central, 500",
      data_inicio: "2026-01-01",
      data_conclusao: "2026-07-01",
      descricao: "Prorrogada",
    },
    db
  );

  // 2) Encerra a obra offline em seguida
  await obraLocalRepository.encerrarObraLocal("obra-synced-1", db);

  const pendentes = await syncQueueRepository.listarItensPendentes(db, {
    usuarioId: "user-1",
  });
  const pendentesObra = pendentes.filter(
    (p) => p.tabela_referencia === "obras"
  );
  const pendentesHistorico = pendentes.filter(
    (p) => p.tabela_referencia === "historico_datas_obra"
  );

  // As duas intenções distintas de obras devem coexistir na fila na ordem certa
  assert.equal(pendentesObra.length, 2);
  assert.equal(pendentesObra[0].acao, "atualizar_dados");
  assert.equal(pendentesObra[0].payloadObj.nome, "Obra Renomeada Offline");
  assert.equal(pendentesObra[1].acao, "encerrar");
  assert.equal(pendentesObra[1].payloadObj.status, "encerrada");
  assert.equal(pendentesHistorico.length, 1);

  // Histórico de conclusão deve estar disponível localmente mesmo offline
  const hist = await obraLocalRepository.listarHistoricoConclusaoLocal(
    "obra-synced-1",
    db
  );
  assert.equal(hist.historico.length, 1);
  assert.equal(hist.historico[0].dias_adicionados, 30);
});

test("Fila de sincronização isola contadores por usuário e interrompe retentativas em erros permanentes", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const { db, syncQueueRepository } = env;

  await syncQueueRepository.enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: "o-user-a",
      operacao: "insert",
      usuarioId: "user-A",
      payload: { id: "o-user-a", nome: "Obra A", usuario_id: "user-A" },
    },
    db
  );
  await syncQueueRepository.enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: "o-user-b",
      operacao: "insert",
      usuarioId: "user-B",
      payload: { id: "o-user-b", nome: "Obra B", usuario_id: "user-B" },
    },
    db
  );

  const pendentesA = await syncQueueRepository.listarItensPendentes(db, {
    usuarioId: "user-A",
  });
  assert.equal(pendentesA.length, 1);
  assert.equal(pendentesA[0].registro_id, "o-user-a");

  // Erro permanente retira o item do loop automático e do resumo de retentativas
  await syncQueueRepository.registrarFalhaItem(
    pendentesA[0].id,
    "Validação 400",
    db,
    { permanente: true }
  );

  const pendentesAAposErroPerm = await syncQueueRepository.listarItensPendentes(
    db,
    { usuarioId: "user-A" }
  );
  assert.equal(pendentesAAposErroPerm.length, 0);

  const resumoA = await syncQueueRepository.obterResumoFila(db, "user-A");
  assert.equal(resumoA.errosPermanentes, 1);
  assert.equal(resumoA.totalNaoSincronizados, 0);
});

test("syncManager pagina lotes grandes, reexecuta pendências pós-lock e aplica Delta Pull transacional com tombstones", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const {
    db,
    syncQueueRepository,
    obraLocalRepository,
    syncManager,
  } = env;

  // Enfileira 45 obras para validar paginação (40 + 5) e ausência de payloadObj duplicado
  for (let i = 1; i <= 45; i++) {
    await obraLocalRepository.criarObraLocal(
      {
        id: `obra-pag-${i}`,
        usuarioId: "user-1",
        nome: `Obra ${i}`,
        endereco: "Rua Teste",
      },
      db
    );
  }

  const lotesEnviados = [];
  const urlsPull = [];
  let agendouDurantePush = false;

  syncManager.configurarClienteHttpSync(async (endpoint, opcoes = {}) => {
    if (endpoint === "/sync/push") {
      const body = JSON.parse(opcoes.body);
      lotesEnviados.push(body.itens);

      // Verifica que payloadObj duplicado foi removido
      assert.ok(
        body.itens.every((it) => !("payloadObj" in it)),
        "Não deve trafegar payloadObj duplicado"
      );

      // Enquanto o 1o lote está em andamento (isSyncing === true), simula nova edição offline
      if (!agendouDurantePush) {
        agendouDurantePush = true;
        await obraLocalRepository.criarObraLocal(
          {
            id: "obra-durante-mutex",
            usuarioId: "user-1",
            nome: "Obra Criada Durante Sync",
            endereco: "Rua Concurrent",
          },
          db
        );
        syncManager.agendarSincronizacao();
      }

      return {
        sincronizados: body.itens.map((it) => ({
          fila_id: it.id,
          tabela_referencia: it.tabela_referencia,
          registro_id: it.registro_id,
          operacao: it.operacao,
          resultado: { id: it.registro_id },
        })),
        falhas: [],
      };
    }

    if (endpoint.startsWith("/sync/pull")) {
      urlsPull.push(endpoint);
      if (urlsPull.length === 1) {
        return {
          modo: "full",
          timestamp: "2026-11-18T10:00:00.000Z",
          obras: [
            {
              id: "obra-remota-1",
              usuario_id: "user-1",
              nome: "Obra Nuvem",
              endereco: "Av Nuvem",
              status: "ativa",
            },
          ],
          etapas: [],
          servicos: [],
          ciclos: [],
          medicoes: [],
          fotografias: [],
          historico_datas_obra: [],
          excluidos: [],
        };
      }
      return {
        modo: "delta",
        timestamp: "2026-11-18T10:05:00.000Z",
        obras: [],
        etapas: [],
        servicos: [],
        ciclos: [],
        medicoes: [],
        fotografias: [],
        historico_datas_obra: [],
        excluidos: [
          {
            tabela_referencia: "obras",
            registro_id: "obra-remota-1",
            deleted_at: "2026-11-18T10:04:00.000Z",
          },
        ],
      };
    }

    return {};
  });

  await syncManager.sincronizarTudo({ incluirPull: true });

  // Aguarda re-disparo pós-mutex disparar (50ms) e terminar
  await new Promise((r) => setTimeout(r, 250));

  // Os 45 itens foram enviados em 40 + 5, e o item criado durante o mutex (obra-durante-mutex) também foi enviado!
  const totalEnviado = lotesEnviados.reduce((acc, l) => acc + l.length, 0);
  assert.equal(lotesEnviados[0].length, 40);
  assert.equal(totalEnviado, 46);
  assert.ok(db.txCalls >= 1, "Hidratação do Pull deve rodar em transação única");

  // Obra remota deve existir após o 1o pull
  const obraRemotaAntes = await obraLocalRepository.obterObraLocalPorId(
    "obra-remota-1",
    db
  );
  assert.ok(obraRemotaAntes);

  // 2o pull deve enviar ?since=2026-11-18T10:00:00.000Z e aplicar tombstone removendo obra-remota-1
  await syncManager.sincronizarTudo({ incluirPull: true });
  assert.equal(
    urlsPull[1],
    "/sync/pull?since=2026-11-18T10%3A00%3A00.000Z"
  );
  const obraRemotaDepois = await obraLocalRepository.obterObraLocalPorId(
    "obra-remota-1",
    db
  );
  assert.equal(obraRemotaDepois, null);
});

test("Pipeline de mídia envia binários de fotografias separadamente e baixa imagens sob demanda", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const { db, fotografiaRepository, syncManager } = env;

  // Foto 1: criada localmente em data URI aguardando upload de binário (metadado já sincronizado)
  await fotografiaRepository.salvarFotografia(
    {
      id: "foto-up-1",
      obra_id: "obra-1",
      ciclo_id: "ciclo-1",
      servico_id: "srv-1",
      usuario_id: "user-1",
      caminho_local: "data:image/jpeg;base64,LOCALDATA",
      caminho_comprimido: "data:image/jpeg;base64,LOCALDATA",
      latitude: -5.1,
      longitude: -39.2,
      possui_localizacao: 1,
      data_hora_captura: "2026-11-18T11:00:00.000Z",
    },
    db
  );
  // Marca o item da fila de metadados como sincronizado
  await db.runAsync(`UPDATE fila_sincronizacao SET status = 'sincronizado';`);

  // Foto 2: vinda de outro aparelho pelo Pull (tem url_nuvem, mas caminho_local é file:// de outro aparelho)
  await fotografiaRepository.upsertFotografiaSincronizada(
    {
      id: "foto-down-2",
      obra_id: "obra-1",
      ciclo_id: "ciclo-1",
      servico_id: "srv-1",
      usuario_id: "user-1",
      caminho_local: "file:///outro-celular/foto.jpg",
      caminho_comprimido: "file:///outro-celular/foto.jpg",
      url_nuvem: "/sync/fotos/foto-down-2/arquivo",
      possui_localizacao: 0,
      data_hora_captura: "2026-11-18T11:05:00.000Z",
    },
    db
  );

  const requisicoesMidia = [];
  syncManager.configurarClienteHttpSync(async (endpoint, opcoes = {}) => {
    requisicoesMidia.push({ endpoint, method: opcoes.method });
    if (
      endpoint === "/sync/fotos/foto-up-1/arquivo" &&
      opcoes.method === "POST"
    ) {
      const parsed = JSON.parse(opcoes.body);
      assert.equal(parsed.base64, "data:image/jpeg;base64,LOCALDATA");
      return { id: "foto-up-1", url_nuvem: "/sync/fotos/foto-up-1/arquivo" };
    }
    if (
      endpoint === "/sync/fotos/foto-down-2/arquivo" &&
      opcoes.method === "GET"
    ) {
      return {
        id: "foto-down-2",
        base64: "data:image/jpeg;base64,NUVEMDATA",
      };
    }
    return {};
  });

  const resMidia = await syncManager.sincronizarMidiasPendentes(db, "user-1", {
    baixarFaltantes: true,
  });

  assert.equal(resMidia.enviados, 1);
  assert.equal(resMidia.baixados, 1);

  const foto1Atualizada = await db.getFirstAsync(
    `SELECT * FROM fotografias WHERE id = 'foto-up-1';`
  );
  assert.equal(foto1Atualizada.url_nuvem, "/sync/fotos/foto-up-1/arquivo");

  const foto2Atualizada = await db.getFirstAsync(
    `SELECT * FROM fotografias WHERE id = 'foto-down-2';`
  );
  assert.equal(
    foto2Atualizada.caminho_local,
    "data:image/jpeg;base64,NUVEMDATA"
  );
});

test("Banner de sincronização - Pull silencioso mantém isSendingPush=false e confirmação não reaparece ao trocar de tela", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();
  const { syncManager } = env;

  const estadosDurantePull = [];
  const unsub = syncManager.inscreverStatusSync((st) => {
    estadosDurantePull.push({ ...st });
  });

  syncManager.configurarClienteHttpSync(async (endpoint) => {
    if (endpoint.startsWith("/sync/pull")) {
      return {
        modo: "delta",
        timestamp: "2026-11-18T12:00:00.000Z",
        obras: [],
        etapas: [],
        servicos: [],
        ciclos: [],
        medicoes: [],
        fotografias: [],
        historico_datas_obra: [],
        excluidos: [],
      };
    }
    return {};
  });

  // 1) Pull de rotina com 0 pendências: isSendingPush e isManualSync permanecem false
  await syncManager.sincronizarTudo({ incluirPull: true });
  unsub();

  assert.ok(estadosDurantePull.some((e) => e.isSyncing === true));
  assert.ok(
    estadosDurantePull.every((e) => e.isSendingPush === false && e.isManualSync === false),
    "Pull silencioso sem pendências não deve ativar isSendingPush nem isManualSync"
  );

  // 2) Garante que SyncStatusBanner não guarda estado local que reexibe banner verde ao montar nova tela
  const bannerContent = fs.readFileSync(
    path.join(__dirname, "../src/components/SyncStatusBanner.js"),
    "utf-8"
  );
  assert.ok(
    !bannerContent.includes("setExibirConfirmacaoRecente"),
    "Confirmação recente deve ficar centralizada no SyncContext e não no estado local do banner"
  );
  assert.ok(
    bannerContent.includes("mostrarPendenciaVisivel"),
    "SyncStatusBanner deve respeitar mostrarPendenciaVisivel para evitar piscar em saves online rápidos"
  );

  const syncContextContent = fs.readFileSync(
    path.join(__dirname, "../src/context/SyncContext.js"),
    "utf-8"
  );
  assert.ok(
    syncContextContent.includes("TOLERANCIA_PENDENCIA_ONLINE_MS"),
    "SyncContext deve aplicar tolerância antes de exibir banner de pendência quando online"
  );
  assert.ok(
    syncContextContent.includes("estavaDessincronizadoRef"),
    "SyncContext deve exibir confirmação verde apenas ao se recuperar de dessincronização real"
  );
});

test("syncManager encerra retentativas em foto órfã (404), sincroniza histórico offline e evita colisão de IDs no Pull", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const {
    db,
    obraLocalRepository,
    medicaoLocalRepository,
    fotografiaRepository,
    syncQueueRepository,
    syncManager,
  } = env;

  // 1) Criação + dupla edição de data de conclusão offline gera 2 itens de historico_datas_obra na fila
  const obra = await obraLocalRepository.criarObraLocal(
    {
      usuarioId: "user-1",
      nome: "Obra Prazos",
      endereco: "Rua 10",
      data_inicio: "2026-10-01",
      data_conclusao: "2026-12-01",
    },
    db
  );
  await obraLocalRepository.atualizarObraLocal(
    obra.id,
    {
      nome: "Obra Prazos",
      endereco: "Rua 10",
      data_inicio: "2026-10-01",
      data_conclusao: "2027-01-10",
    },
    db
  );
  await obraLocalRepository.atualizarObraLocal(
    obra.id,
    {
      nome: "Obra Prazos",
      endereco: "Rua 10",
      data_inicio: "2026-10-01",
      data_conclusao: "2027-02-01",
    },
    db
  );

  const itensHist = await db.getAllAsync(
    `SELECT * FROM fila_sincronizacao WHERE tabela_referencia = 'historico_datas_obra' ORDER BY rowid ASC;`
  );
  assert.equal(itensHist.length, 2, "Ambas as transições de prazo devem ser enfileiradas");

  const itensPendentes = await syncQueueRepository.listarItensPendentes(db, {
    usuarioId: "user-1",
  });
  assert.ok(
    itensPendentes.every((i) => typeof i.ordem_fila === "number"),
    "listarItensPendentes deve expor ordem_fila monotônica do SQLite"
  );

  // 2) Colisão preventiva de PK medicoes.id no upsertMedicaoSincronizada
  await medicaoLocalRepository.upsertMedicaoSincronizada(
    {
      id: "uuid-med-conflito",
      ciclo_id: "ciclo-2",
      servico_id: "srv-1",
      usuario_id: "user-1",
      quantidade_medida_periodo: 0,
    },
    db
  );
  await medicaoLocalRepository.upsertMedicaoSincronizada(
    {
      id: "uuid-med-conflito",
      ciclo_id: "ciclo-1",
      servico_id: "srv-1",
      usuario_id: "user-1",
      quantidade_medida_periodo: 5,
    },
    db
  );
  const medEmCiclo1 = await db.getFirstAsync(
    `SELECT * FROM medicoes WHERE id = 'uuid-med-conflito';`
  );
  assert.equal(medEmCiclo1.ciclo_id, "ciclo-1");

  // 3) Foto órfã recebendo 404 é marcada como sync_status='error' e não entra em loop no 2o ciclo
  await db.runAsync(
    `INSERT INTO fotografias (id, obra_id, ciclo_id, servico_id, usuario_id, caminho_local, caminho_comprimido, data_hora_captura, sincronizado, sync_status)
     VALUES ('foto-orfa-404', ?, 'ciclo-1', 'srv-1', 'user-1', 'data:image/jpeg;base64,ORFA', 'data:image/jpeg;base64,ORFA', '2026-11-18T12:00:00Z', 0, 'synced');`,
    [obra.id]
  );

  let tentativasUploadOrfa = 0;
  syncManager.configurarClienteHttpSync(async (endpoint, opcoes = {}) => {
    if (
      endpoint === "/sync/fotos/foto-orfa-404/arquivo" &&
      opcoes.method === "POST"
    ) {
      tentativasUploadOrfa += 1;
      const err = new Error("Fotografia não encontrada.");
      err.status = 404;
      throw err;
    }
    return {};
  });

  await syncManager.sincronizarMidiasPendentes(db, "user-1", {
    baixarFaltantes: false,
  });
  await syncManager.sincronizarMidiasPendentes(db, "user-1", {
    baixarFaltantes: false,
  });

  assert.equal(
    tentativasUploadOrfa,
    1,
    "Foto que retornou HTTP 404 não deve continuar sendo reenviada em loop"
  );
  const fotoErro = await db.getFirstAsync(
    `SELECT sync_status FROM fotografias WHERE id = 'foto-orfa-404';`
  );
  assert.equal(fotoErro.sync_status, "error");
});

test("Inicialização do banco SQLite serializa chamadas concorrentes sem sobrepor transações", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const { db, syncManager } = env;

  // Instrumenta withTransactionAsync estrito (como expo-sqlite real): lança erro se houver transação concorrente
  const withTxOriginal = db.withTransactionAsync.bind(db);
  let txEmAndamento = false;
  let errosTxConcorrente = 0;
  db.withTransactionAsync = async (fn) => {
    if (txEmAndamento) {
      errosTxConcorrente += 1;
      throw new Error("cannot start a transaction within a transaction");
    }
    txEmAndamento = true;
    try {
      return await withTxOriginal(async () => {
        await new Promise((r) => setTimeout(r, 15));
        return await fn();
      });
    } finally {
      txEmAndamento = false;
    }
  };

  let pullsExecutados = 0;
  syncManager.configurarClienteHttpSync(async (endpoint) => {
    if (endpoint.startsWith("/sync/pull")) {
      pullsExecutados += 1;
      await new Promise((r) => setTimeout(r, 15));
      return {
        modo: "full",
        timestamp: "2026-11-19T00:00:00.000Z",
        obras: [
          {
            id: "obra-mutex-boot",
            usuario_id: "user-1",
            nome: "Obra Mutex Boot",
            status: "ativa",
          },
        ],
        etapas: [],
        servicos: [],
        ciclos: [],
        medicoes: [],
        fotografias: [],
        historico_datas_obra: [],
        excluidos: [],
      };
    }
    return {};
  });

  // Simula AuthContext + SyncContext + Home disparando simultaneamente antes dos awaits internos
  await Promise.all([
    syncManager.sincronizarTudo({ incluirPull: true }),
    syncManager.sincronizarTudo({ incluirPull: true }),
    syncManager.sincronizarTudo({ incluirPull: true }),
  ]);

  // Aguarda eventual re-execução agendada (50ms) terminar sem erros concorrentes
  await new Promise((r) => setTimeout(r, 150));

  assert.equal(
    errosTxConcorrente,
    0,
    "Nunca deve abrir duas withTransactionAsync simultâneas na mesma conexão SQLite"
  );
  assert.ok(pullsExecutados >= 1);
  assert.ok(pullsExecutados <= 2);

  syncManager.resetarEstadoSyncSessao();
});

test("Isolamento multiusuário impede vazamento de fila e mídias entre contas distintas ou sessões inválidas", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();

  const {
    db,
    syncQueueRepository,
    fotografiaRepository,
    obraLocalRepository,
    syncManager,
  } = env;

  const agora = "2026-11-19T10:00:00.000Z";

  // Insere diretamente itens na fila com usuario_id NULL, '', 'local_user', 'user-A' e 'user-B'
  const cenariosFila = [
    { id: "q-null", reg: "obra-null", user: null },
    { id: "q-empty", reg: "obra-empty", user: "" },
    { id: "q-local", reg: "obra-local", user: "local_user" },
    { id: "q-user-a", reg: "obra-a", user: "user-A" },
    { id: "q-user-b", reg: "obra-b", user: "user-B" },
  ];

  for (const c of cenariosFila) {
    await db.runAsync(
      `INSERT INTO fila_sincronizacao (
        id, tabela_referencia, registro_id, operacao, acao, usuario_id, payload, status, tentativas, erro_permanente, created_at, updated_at
      ) VALUES (?, 'obras', ?, 'insert', 'criar', ?, ?, 'pendente', 0, 0, ?, ?);`,
      [c.id, c.reg, c.user, JSON.stringify({ id: c.reg, nome: c.reg }), agora, agora]
    );
  }

  // Insere fotografias pendentes com usuario_id NULL, 'local_user', 'user-A' e 'user-B'
  for (const f of cenariosFila) {
    await db.runAsync(
      `INSERT INTO fotografias (
        id, obra_id, ciclo_id, servico_id, usuario_id, caminho_local, caminho_comprimido, data_hora_captura, sincronizado, sync_status
      ) VALUES (?, ?, 'ciclo-1', 'srv-1', ?, 'data:image/jpeg;base64,AA', 'data:image/jpeg;base64,AA', ?, 0, 'synced');`,
      [`foto-${f.id}`, f.reg, f.user, agora]
    );
  }

  // Obras locais com usuario_id '' e 'local_user' não devem aparecer nem contar para user-B
  await db.runAsync(
    `INSERT INTO obras (id, usuario_id, nome, endereco, status, sync_status, created_at, updated_at)
     VALUES ('obra-sem-dono', '', 'Sem Dono', 'Rua X', 'ativa', 'pending', ?, ?),
            ('obra-local-user', 'local_user', 'Local User', 'Rua Y', 'ativa', 'pending', ?, ?),
            ('obra-b', 'user-B', 'Obra B', 'Rua B', 'ativa', 'pending', ?, ?);`,
    [agora, agora, agora, agora, agora, agora]
  );

  // 1) Consultas sem usuário válido (null, '', 'local_user') não retornam pendências órfãs
  for (const invalido of [null, "", "   ", "local_user"]) {
    const listaInv = await syncQueueRepository.listarItensPendentes(db, {
      usuarioId: invalido,
    });
    assert.equal(listaInv.length, 0);
    const resumoInv = await syncQueueRepository.obterResumoFila(db, invalido);
    assert.equal(resumoInv.totalNaoSincronizados, 0);
  }

  // 2) Consultas autenticadas como user-B enxergam exclusivamente registros de user-B
  const pendentesB = await syncQueueRepository.listarItensPendentes(db, {
    usuarioId: "user-B",
  });
  assert.deepEqual(
    pendentesB.map((i) => i.id),
    ["q-user-b"]
  );

  const resumoB = await syncQueueRepository.obterResumoFila(db, "user-B");
  assert.equal(resumoB.pendentes, 1);
  assert.equal(resumoB.totalNaoSincronizados, 1);

  const fotosUploadB =
    await fotografiaRepository.listarFotografiasPendentesUploadBinario(
      "user-B",
      db
    );
  assert.deepEqual(
    fotosUploadB.map((f) => f.id),
    ["foto-q-user-b"]
  );

  const obrasVisiveisB = await obraLocalRepository.listarObrasLocais(
    "user-B",
    true,
    db
  );
  assert.deepEqual(
    obrasVisiveisB.map((o) => o.id),
    ["obra-b"]
  );
  assert.equal(
    await obraLocalRepository.contarObrasLocaisPorUsuario("user-B", db),
    1
  );

  // 3) Ao rodar sincronizarTudo autenticado como user-B, o Push e o upload de mídia só enviam itens de user-B
  env.setUsuario({ id: "user-B", nome: "Usuária B", email: "b@obra.com" });
  env.setToken("jwt-user-b");

  const itensEnviadosNoPush = [];
  const fotosEnviadasNoUpload = [];

  syncManager.configurarClienteHttpSync(async (endpoint, opcoes = {}) => {
    if (endpoint === "/sync/push") {
      const body = JSON.parse(opcoes.body);
      itensEnviadosNoPush.push(...body.itens);
      return {
        sincronizados: body.itens.map((it) => ({
          fila_id: it.id,
          tabela_referencia: it.tabela_referencia,
          registro_id: it.registro_id,
          operacao: it.operacao,
          resultado: { id: it.registro_id },
        })),
        falhas: [],
      };
    }
    if (endpoint.startsWith("/sync/fotos/") && opcoes.method === "POST") {
      fotosEnviadasNoUpload.push(endpoint);
      return { url_nuvem: endpoint };
    }
    return {};
  });

  await syncManager.sincronizarTudo({ incluirPull: false });

  assert.deepEqual(
    itensEnviadosNoPush.map((i) => i.id),
    ["q-user-b"],
    "Nunca deve enviar itens sem dono, local_user ou de outra conta usando o token de user-B"
  );
  assert.deepEqual(fotosEnviadasNoUpload, ["/sync/fotos/foto-q-user-b/arquivo"]);

  // Itens das outras origens permanecem intocados no SQLite local
  const restantesOutrasOrigens = await db.getAllAsync(
    `SELECT id FROM fila_sincronizacao WHERE status = 'pendente' ORDER BY rowid ASC;`
  );
  assert.deepEqual(
    restantesOutrasOrigens.map((r) => r.id),
    ["q-null", "q-empty", "q-local", "q-user-a"]
  );

  syncManager.resetarEstadoSyncSessao();
});

test("excluirFotografia resolve usuario_id pela obra quando fotografia legada não possui usuario_id preenchido", async () => {
  const env = carregarAmbienteSyncTeste();
  await env.initDb();
  const { db, fotografiaRepository, syncQueueRepository } = env;

  const agora = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO obras (id, usuario_id, nome, endereco, status, sync_status, created_at, updated_at)
     VALUES ('obra-foto-legada', 'user-dono-foto', 'Obra Foto Legada', 'Rua Z', 'ativa', 'synced', ?, ?);`,
    [agora, agora]
  );

  await db.runAsync(
    `INSERT INTO fotografias (
      id, obra_id, ciclo_id, servico_id, usuario_id, caminho_local, caminho_comprimido, data_hora_captura, sincronizado, sync_status
    ) VALUES ('foto-legada-1', 'obra-foto-legada', 'ciclo-1', 'srv-1', NULL, 'file:///legada.jpg', 'file:///legada.jpg', ?, 1, 'synced');`,
    [agora]
  );

  await fotografiaRepository.excluirFotografia("foto-legada-1", db);

  const pendentesDono = await syncQueueRepository.listarItensPendentes(db, {
    usuarioId: "user-dono-foto",
  });
  assert.equal(pendentesDono.length, 1);
  assert.equal(pendentesDono[0].tabela_referencia, "fotografias");
  assert.equal(pendentesDono[0].operacao, "delete");
  assert.equal(pendentesDono[0].registro_id, "foto-legada-1");
  assert.equal(pendentesDono[0].usuario_id, "user-dono-foto");
});
