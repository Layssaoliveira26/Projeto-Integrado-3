const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Etapa 1 - database/index.js inicializa todas as tabelas necessárias para o modo Offline-First (RNF02)", () => {
  const caminhoDb = path.join(__dirname, "../src/database/index.js");
  const conteudo = fs.readFileSync(caminhoDb, "utf-8");

  const tabelasEsperadas = [
    "CREATE TABLE IF NOT EXISTS usuarios",
    "CREATE TABLE IF NOT EXISTS obras",
    "CREATE TABLE IF NOT EXISTS planilhas_base",
    "CREATE TABLE IF NOT EXISTS etapas",
    "CREATE TABLE IF NOT EXISTS servicos",
    "CREATE TABLE IF NOT EXISTS ciclos_medicao",
    "CREATE TABLE IF NOT EXISTS medicoes",
    "CREATE TABLE IF NOT EXISTS fotografias",
    "CREATE TABLE IF NOT EXISTS fila_sincronizacao",
  ];

  for (const tabela of tabelasEsperadas) {
    assert.ok(conteudo.includes(tabela), `Deve declarar ${tabela} no schema SQLite`);
  }

  assert.ok(conteudo.includes("ultimo_erro TEXT"), "fila_sincronizacao deve registrar ultimo_erro para diagnóstico (RF31)");
  assert.ok(conteudo.includes("sync_status TEXT"), "Tabelas devem possuir controle de sync_status");
});

test("Etapa 1 - syncQueueRepository mantém responsabilidade única e coalescência na fila (RNF13)", async () => {
  const caminhoQueue = path.join(__dirname, "../src/repositories/syncQueueRepository.js");
  const conteudo = fs.readFileSync(caminhoQueue, "utf-8");

  // Garante baixo acoplamento: não deve importar telas nem serviços HTTP
  assert.ok(!conteudo.includes("../screens/"), "syncQueueRepository não deve depender de telas");
  assert.ok(!conteudo.includes("fetch("), "syncQueueRepository não deve realizar chamadas HTTP diretas");

  // Verifica presença das operações essenciais do Outbox Pattern
  assert.ok(conteudo.includes("enfileirarOperacao"), "Deve exportar enfileirarOperacao");
  assert.ok(conteudo.includes("listarItensPendentes"), "Deve exportar listarItensPendentes");
  assert.ok(conteudo.includes("marcarItemSincronizado"), "Deve exportar marcarItemSincronizado");
  assert.ok(conteudo.includes("registrarFalhaItem"), "Deve exportar registrarFalhaItem");
  assert.ok(conteudo.includes("obterResumoFila"), "Deve exportar obterResumoFila");
  assert.ok(conteudo.includes("cancelado_antes_do_envio"), "Deve tratar coalescência de insert seguido de delete");
  assert.ok(conteudo.includes("atualizado_no_insert"), "Deve tratar coalescência de insert seguido de update");
});

test("Etapa 1 - AuthContext e storage persistem perfil localmente para funcionamento sem internet (RNF01 / RNF09)", () => {
  const caminhoStorage = path.join(__dirname, "../src/services/storage.js");
  const conteudoStorage = fs.readFileSync(caminhoStorage, "utf-8");

  assert.ok(conteudoStorage.includes("salvarUsuarioLocal"), "storage.js deve exportar salvarUsuarioLocal");
  assert.ok(conteudoStorage.includes("obterUsuarioLocal"), "storage.js deve exportar obterUsuarioLocal");
  assert.ok(conteudoStorage.includes("removerUsuarioLocal"), "storage.js deve exportar removerUsuarioLocal");

  const caminhoAuth = path.join(__dirname, "../src/context/AuthContext.js");
  const conteudoAuth = fs.readFileSync(caminhoAuth, "utf-8");

  assert.ok(conteudoAuth.includes("obterUsuarioLocal"), "AuthContext deve restaurar o usuário salvo localmente ao abrir o app");
  assert.ok(conteudoAuth.includes("salvarUsuarioLocal"), "AuthContext deve atualizar o cache local do usuário ao autenticar");
});

