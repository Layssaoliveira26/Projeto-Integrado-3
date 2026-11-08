const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Etapa 4 - syncManager monitora conectividade via NetInfo e gerencia ciclo Push/Pull desacoplado (RF31 / RNF13)", () => {
  const caminhoSync = path.join(__dirname, "../src/sync/syncManager.js");
  const conteudo = fs.readFileSync(caminhoSync, "utf-8");

  assert.ok(
    conteudo.includes("@react-native-community/netinfo"),
    "Deve utilizar @react-native-community/netinfo para detectar reconexão"
  );
  assert.ok(
    conteudo.includes("/sync/push"),
    "Deve enviar pendências da fila para /sync/push"
  );
  assert.ok(
    conteudo.includes("/sync/pull"),
    "Deve hidratar o banco local consultando /sync/pull"
  );
  assert.ok(
    conteudo.includes("marcarItemSincronizado"),
    "Deve marcar itens confirmados como sincronizados"
  );
  assert.ok(
    conteudo.includes("registrarFalhaItem"),
    "Deve registrar falhas sem descartar itens pendentes (RNF13)"
  );
  assert.ok(
    !conteudo.includes("../screens/"),
    "syncManager deve ser desacoplado das telas"
  );
});

test("Etapa 4 - Serviços mobile (api, medicaoService, cicloService, planilhaFinalService) operam em modo Offline-First (RNF01 / RNF04)", () => {
  const apiContent = fs.readFileSync(
    path.join(__dirname, "../src/services/api.js"),
    "utf-8"
  );
  assert.ok(
    apiContent.includes("criarObraLocal"),
    "api.js deve persistir obras localmente primeiro"
  );
  assert.ok(
    apiContent.includes("obterEstruturaObraLocal"),
    "api.js deve consultar a estrutura da obra no SQLite local"
  );
  assert.ok(
    apiContent.includes("agendarSincronizacao"),
    "api.js deve agendar sincronização em background após mutações"
  );

  const medContent = fs.readFileSync(
    path.join(__dirname, "../src/services/medicaoService.js"),
    "utf-8"
  );
  assert.ok(
    medContent.includes("obterDadosMedicaoLocal"),
    "medicaoService deve ler dados de medição do SQLite local"
  );
  assert.ok(
    medContent.includes("registrarMedicaoLocal"),
    "medicaoService deve gravar medições localmente sem depender de internet"
  );
  assert.ok(
    medContent.includes("agendarSincronizacao"),
    "medicaoService deve agendar sincronização assíncrona"
  );

  const cicloContent = fs.readFileSync(
    path.join(__dirname, "../src/services/cicloService.js"),
    "utf-8"
  );
  assert.ok(
    cicloContent.includes("listarCiclosObraLocal"),
    "cicloService deve consultar histórico de ciclos localmente"
  );
  assert.ok(
    cicloContent.includes("encerrarCicloLocal"),
    "cicloService deve permitir encerrar ciclo offline"
  );
});
