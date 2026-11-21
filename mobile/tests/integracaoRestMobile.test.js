const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { DatabaseSync } = require("node:sqlite");

function criarSqliteEmMemoria() {
  const nativeDb = new DatabaseSync(":memory:");
  const sanitize = (params = []) =>
    (params || []).map((v) => (v === undefined ? null : v));

  return {
    nativeDb,
    async execAsync(sql) {
      nativeDb.exec(sql);
    },
    async runAsync(sql, params = []) {
      return nativeDb.prepare(sql).run(...sanitize(params));
    },
    async getFirstAsync(sql, params = []) {
      return nativeDb.prepare(sql).get(...sanitize(params)) || null;
    },
    async getAllAsync(sql, params = []) {
      return nativeDb.prepare(sql).all(...sanitize(params));
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
    /import\s+(\w+)\s*,\s*\{([\s\S]*?)\}\s+from\s+["']([^"']+)["'];?/g,
    (_, def, named, mod) =>
      `const ${def} = require("${mod}").default || require("${mod}");\nconst {${named.replace(/\bas\b/g, ":")}} = require("${mod}");`
  );
  out = out.replace(
    /import\s+(\w+)\s+from\s+["']([^"']+)["'];?/g,
    'const $1 = require("$2").default || require("$2");'
  );
  out = out.replace(
    /import\s+\{([\s\S]*?)\}\s+from\s+["']([^"']+)["'];?/g,
    (_, imports, mod) =>
      `const {${imports.replace(/\bas\b/g, ":")}} = require("${mod}");`
  );
  out = out.replace(/export\s+const\s+(\w+)\s*=/g, "const $1 = exports.$1 =");
  out = out.replace(
    /export\s+async\s+function\s+(\w+)/g,
    "async function $1"
  );
  out = out.replace(/export\s+function\s+(\w+)/g, "function $1");
  const fnExports = [
    ...codigo.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g),
  ].map((m) => m[1]);
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

function carregarAmbienteApiRest() {
  const db = criarSqliteEmMemoria();
  const baseSrc = path.join(__dirname, "../src");
  const cacheModulos = new Map();

  let online = true;
  let usuarioAtual = { id: "user-1", nome: "Eng. Fiscal" };
  let tokenAtual = "jwt-valido";
  let handlerFetch = async () => ({ status: 200, body: {} });

  const dbIndexRaw = fs.readFileSync(
    path.join(baseSrc, "database/index.js"),
    "utf-8"
  );
  const dbIndexCode = transformarEsmParaCjs(
    dbIndexRaw.replace(
      'const SQLite = require("expo-sqlite");',
      "const SQLite = { openDatabaseAsync: async () => __TEST_DB__ };"
    )
  );
  const dbIndexMod = { exports: {} };
  new vm.Script(
    `(function(exports, require, module, __TEST_DB__) {\n${dbIndexCode}\n})`,
    { filename: path.join(baseSrc, "database/index.js") }
  ).runInThisContext()(
    dbIndexMod.exports,
    (s) =>
      s === "expo-sqlite" ? { openDatabaseAsync: async () => db } : require(s),
    dbIndexMod,
    db
  );
  cacheModulos.set(path.join(baseSrc, "database/index.js"), dbIndexMod);

  const mockSyncManager = {
    configurarClienteHttpSync: () => {},
    agendarSincronizacao: () => {},
    sincronizarTudo: async () => {},
    obterEstadoAtualSync: () => ({ isOnline: online }),
    atualizarContadoresFila: async () => {},
  };

  const compilar = (absPath) => {
    if (cacheModulos.has(absPath)) return cacheModulos.get(absPath).exports;
    const raw = fs.readFileSync(absPath, "utf-8");
    const cjs = transformarEsmParaCjs(raw);
    const mod = { exports: {} };
    cacheModulos.set(absPath, mod);

    const localRequire = (spec) => {
      if (spec.includes("../utils/img/")) return 1;
      if (spec === "react-native") {
        return { Platform: { OS: "android" }, Linking: {}, Alert: { alert: () => {} } };
      }
      if (spec === "expo-constants") return { default: {} };
      if (spec.endsWith("/storage") || spec.endsWith("/storage.js")) {
        return {
          obterToken: async () => tokenAtual,
          obterUsuarioLocal: async () => usuarioAtual,
        };
      }
      if (spec.endsWith("/syncManager") || spec.endsWith("/syncManager.js")) {
        return mockSyncManager;
      }
      if (spec.startsWith(".")) {
        const resolved = path.resolve(path.dirname(absPath), spec);
        const comExt = fs.existsSync(resolved)
          ? resolved
          : fs.existsSync(`${resolved}.js`)
            ? `${resolved}.js`
            : path.join(resolved, "index.js");
        return compilar(comExt);
      }
      return require(spec);
    };

    const fnFetch = async (url, opts = {}) => {
      const res = await handlerFetch(url, opts);
      if (res.networkError) {
        throw new TypeError("Network request failed");
      }
      return {
        ok: res.status >= 200 && res.status < 300,
        status: res.status,
        json: async () => res.body ?? {},
      };
    };

    new vm.Script(
      `(function(exports, require, module, __filename, __dirname, fetch) {\n${cjs}\n})`,
      { filename: absPath }
    ).runInThisContext()(
      mod.exports,
      localRequire,
      mod,
      absPath,
      path.dirname(absPath),
      fnFetch
    );
    return mod.exports;
  };

  return {
    db,
    initDb: dbIndexMod.exports.initDb,
    setOnline: (val) => {
      online = val;
    },
    setFetch: (fn) => {
      handlerFetch = fn;
    },
    obraLocalRepository: compilar(
      path.join(baseSrc, "repositories/obraLocalRepository.js")
    ),
    syncQueueRepository: compilar(
      path.join(baseSrc, "repositories/syncQueueRepository.js")
    ),
    api: compilar(path.join(baseSrc, "services/api.js")),
  };
}

test("api.js consome diretamente GET, POST, PUT, PATCH e DELETE de obras com fallback Offline-First", () => {
  const apiContent = fs.readFileSync(
    path.join(__dirname, "../src/services/api.js"),
    "utf-8"
  );

  // Verbos HTTP exigidos pela Etapa 2 (GET, POST, PUT, PATCH e DELETE)
  assert.match(apiContent, /method:\s*"GET"/, "Deve expor requisições GET");
  assert.match(apiContent, /method:\s*"POST"/, "Deve expor requisições POST");
  assert.match(apiContent, /method:\s*"PUT"/, "Deve expor requisições PUT");
  assert.match(apiContent, /method:\s*"PATCH"/, "Deve expor requisições PATCH");
  assert.match(apiContent, /method:\s*"DELETE"/, "Deve expor requisições DELETE");

  // Chamadas REST diretas sobre o recurso /obras quando online
  assert.ok(
    apiContent.includes('requisicao("/obras"') &&
      apiContent.includes('method: "POST"'),
    "criarObra deve enviar POST /obras diretamente quando online"
  );
  assert.ok(
    apiContent.includes("requisicao(`/obras/${id}`") &&
      apiContent.includes('method: "PUT"'),
    "atualizarObra deve enviar PUT /obras/:id diretamente quando online"
  );
  assert.ok(
    apiContent.includes("requisicao(`/obras/${id}/arquivar`") &&
      apiContent.includes("requisicao(`/obras/${id}/desarquivar`") &&
      apiContent.includes("requisicao(`/obras/${id}/encerrar`"),
    "mudanças de status devem enviar PATCH /obras/:id/(arquivar|desarquivar|encerrar)"
  );
  assert.ok(
    apiContent.includes('requisicao(`/obras/${id}`, { method: "DELETE" })'),
    "deletarObra deve enviar DELETE /obras/:id diretamente quando online"
  );

  // Preservação do fallback Offline-First para a fila local
  assert.ok(
    apiContent.includes("enfileirarMutacaoObraFallback"),
    "Deve enfileirar mutação localmente caso a chamada REST falhe por falta de rede"
  );
});

test("deletarObra limpa updates pendentes órfãos de obras na fila ao excluir diretamente via REST", async () => {
  const env = carregarAmbienteApiRest();
  await env.initDb();

  await env.obraLocalRepository.upsertObraSincronizada(
    {
      id: "obra-sync-del",
      usuario_id: "user-1",
      nome: "Obra Sincronizada",
      endereco: "Rua 1",
      data_inicio: "2026-09-01T00:00:00.000Z",
      data_conclusao: "2026-12-15T00:00:00.000Z",
      status: "ativa",
    },
    env.db
  );

  // Edita offline gerando update pendente na fila para tabela_referencia = 'obras'
  env.setOnline(false);
  await env.api.atualizarObra("obra-sync-del", {
    nome: "Obra Editada Offline",
    endereco: "Rua 1",
    data_inicio: "01/09/2026",
    data_conclusao: "15/12/2026",
  });

  const antes = await env.db.getAllAsync(
    `SELECT * FROM fila_sincronizacao WHERE registro_id = 'obra-sync-del' AND status = 'pendente';`
  );
  assert.equal(antes.length, 1);
  assert.equal(antes[0].operacao, "update");

  // Reconecta e exclui imediatamente antes do push em background rodar
  env.setOnline(true);
  const chamadas = [];
  env.setFetch(async (url, opts) => {
    chamadas.push({ url, method: opts.method || "GET" });
    return { status: 200, body: { mensagem: "Obra deletada com sucesso." } };
  });

  await env.api.deletarObra("obra-sync-del");

  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].method, "DELETE");
  assert.ok(chamadas[0].url.endsWith("/obras/obra-sync-del"));

  const depois = await env.db.getAllAsync(
    `SELECT * FROM fila_sincronizacao WHERE registro_id = 'obra-sync-del' AND status IN ('pendente', 'erro');`
  );
  assert.equal(
    depois.length,
    0,
    "Nenhum update órfão deve restar na fila após DELETE REST bem-sucedido"
  );
});

test("atualizarObra normaliza datas ISO do PostgreSQL e aguarda hidratação do histórico antes de retornar", async () => {
  const env = carregarAmbienteApiRest();
  await env.initDb();

  await env.obraLocalRepository.upsertObraSincronizada(
    {
      id: "obra-hist-1",
      usuario_id: "user-1",
      nome: "Obra Original",
      endereco: "Av. A",
      data_inicio: "2026-09-01T00:00:00.000Z",
      data_conclusao: "2026-12-15T00:00:00.000Z",
      status: "ativa",
    },
    env.db
  );

  const chamadas = [];
  env.setFetch(async (url, opts) => {
    const metodo = opts.method || "GET";
    chamadas.push({ url, method: metodo });
    if (metodo === "PUT") {
      const body = JSON.parse(opts.body);
      return {
        status: 200,
        body: {
          id: "obra-hist-1",
          usuario_id: "user-1",
          nome: body.nome,
          endereco: body.endereco,
          data_inicio: `${body.data_inicio}T00:00:00.000Z`,
          data_conclusao: `${body.data_conclusao}T00:00:00.000Z`,
          status: "ativa",
        },
      };
    }
    if (url.endsWith("/obras/obra-hist-1/historico-conclusao")) {
      await new Promise((r) => setTimeout(r, 30));
      return {
        status: 200,
        body: {
          ultima_atualizacao: "21/11/2026 às 14:30",
          historico: [
            {
              id: "hist-srv-1",
              obra_id: "obra-hist-1",
              usuario_id: "user-1",
              data_anterior: "15/12/2026",
              data_conclusao: "30/12/2026",
              dias_adicionados: 15,
              created_at: "2026-11-21T17:30:00.000Z",
            },
          ],
        },
      };
    }
    return { status: 200, body: {} };
  });

  // 1) Editar apenas o nome mantendo a mesma data (15/12/2026) NÃO deve buscar /historico-conclusao
  await env.api.atualizarObra("obra-hist-1", {
    nome: "Obra Renomeada",
    endereco: "Av. A",
    data_inicio: "01/09/2026",
    data_conclusao: "15/12/2026",
  });
  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].method, "PUT");

  // 2) Alterar data_conclusao deve aguardar hidratação do histórico antes de resolver atualizarObra
  chamadas.length = 0;
  await env.api.atualizarObra("obra-hist-1", {
    nome: "Obra Renomeada",
    endereco: "Av. A",
    data_inicio: "01/09/2026",
    data_conclusao: "30/12/2026",
  });

  assert.equal(chamadas.length, 2);
  const histLocalImediato =
    await env.obraLocalRepository.listarHistoricoConclusaoLocal(
      "obra-hist-1",
      env.db
    );
  assert.equal(histLocalImediato.historico.length, 1);
  assert.equal(histLocalImediato.historico[0].id, "hist-srv-1");
  assert.equal(histLocalImediato.historico[0].dias_adicionados, 15);
});

test("README.md existe na raiz com a estrutura e ordem exigidas pela disciplina", () => {
  const readmePath = path.join(__dirname, "../../README.md");
  assert.ok(fs.existsSync(readmePath), "README.md em maiúsculo deve existir na raiz");

  const conteudo = fs.readFileSync(readmePath, "utf-8");
  const secoesObrigatorias = [
    "## Identificação da Equipe",
    "### Descrição do projeto",
    "### API REST",
    "### Aplicação mobile",
    "### Organização Git",
  ];

  let ultimaPosicao = -1;
  for (const secao of secoesObrigatorias) {
    const idx = conteudo.indexOf(secao);
    assert.ok(idx !== -1, `Seção obrigatória ausente no README.md: ${secao}`);
    assert.ok(
      idx > ultimaPosicao,
      `Seção fora da ordem exigida pelo modelo: ${secao}`
    );
    ultimaPosicao = idx;
  }
});
