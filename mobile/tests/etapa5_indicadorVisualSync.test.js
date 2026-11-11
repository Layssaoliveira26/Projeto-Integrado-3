const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Etapa 5 - SyncContext adapta estado reativo do syncManager para o React", () => {
  const caminhoCtx = path.join(__dirname, "../src/context/SyncContext.js");
  const conteudo = fs.readFileSync(caminhoCtx, "utf-8");

  assert.ok(conteudo.includes("SyncProvider"), "Deve exportar SyncProvider");
  assert.ok(conteudo.includes("useSync"), "Deve exportar hook useSync");
  assert.ok(conteudo.includes("sincronizarAgora"), "Deve expor função manual sincronizarAgora");
  assert.ok(conteudo.includes("iniciarMonitoramentoRede"), "Deve iniciar o monitoramento de rede ao montar");
});

test("Etapa 5 - SyncStatusBanner exibe estados de offline, pendente, sincronizando e falha com retentativa", () => {
  const caminhoBanner = path.join(__dirname, "../src/components/SyncStatusBanner.js");
  const conteudo = fs.readFileSync(caminhoBanner, "utf-8");

  assert.ok(conteudo.includes("useSync"), "SyncStatusBanner deve consumir o hook useSync");
  assert.ok(conteudo.includes("Modo offline ativo"), "Deve informar modo offline");
  assert.ok(conteudo.includes("Sincronizando dados..."), "Deve informar sincronização em progresso");
  assert.ok(conteudo.includes("Falha ao sincronizar"), "Deve informar falhas no processo de sincronização");
  assert.ok(conteudo.includes("pendente(s) de sincronização"), "Deve informar quando houver dados pendentes");
  assert.ok(conteudo.includes("sincronizarAgora"), "Deve permitir retentativa manual ao tocar no alerta");
});

test("Etapa 5 - App, Home, AcompanhamentoObra e Medicao integram SyncProvider e SyncStatusBanner sem acoplar SQLite", () => {
  const appContent = fs.readFileSync(path.join(__dirname, "../App.js"), "utf-8");
  assert.ok(appContent.includes("SyncProvider"), "App.js deve envolver a navegação com SyncProvider");

  const telas = ["Home.js", "AcompanhamentoObraScreen.js", "Medicao.js"];
  for (const tela of telas) {
    const conteudo = fs.readFileSync(path.join(__dirname, "../src/screens", tela), "utf-8");
    assert.ok(conteudo.includes("SyncStatusBanner"), `${tela} deve renderizar o SyncStatusBanner`);
    assert.ok(!conteudo.includes("expo-sqlite"), `${tela} deve permanecer desacoplada do SQLite`);
  }
});

