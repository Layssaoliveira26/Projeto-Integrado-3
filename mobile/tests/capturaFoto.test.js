const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("US24 - SQLite Schema possui todos os campos obrigatórios para fotos", () => {
  const caminhoDb = path.join(__dirname, "../src/database/index.js");
  const conteudo = fs.readFileSync(caminhoDb, "utf-8");

  assert.ok(conteudo.includes("CREATE TABLE IF NOT EXISTS fotografias"), "Deve criar a tabela fotografias");
  assert.ok(conteudo.includes("id TEXT PRIMARY KEY NOT NULL"), "Deve conter campo id");
  assert.ok(conteudo.includes("obra_id TEXT"), "Deve conter campo obra_id");
  assert.ok(conteudo.includes("ciclo_id TEXT"), "Deve conter campo ciclo_id");
  assert.ok(conteudo.includes("servico_id TEXT"), "Deve conter campo servico_id");
  assert.ok(conteudo.includes("usuario_id TEXT"), "Deve conter campo usuario_id");
  assert.ok(conteudo.includes("caminho_local TEXT"), "Deve conter campo caminho_local");
  assert.ok(conteudo.includes("caminho_comprimido TEXT"), "Deve conter campo caminho_comprimido");
  assert.ok(conteudo.includes("latitude REAL"), "Deve conter campo latitude");
  assert.ok(conteudo.includes("longitude REAL"), "Deve conter campo longitude");
  assert.ok(conteudo.includes("possui_localizacao INTEGER"), "Deve conter campo possui_localizacao");
  assert.ok(conteudo.includes("data_hora_captura TEXT"), "Deve conter campo data_hora_captura");
  assert.ok(conteudo.includes("sincronizado INTEGER DEFAULT 0"), "Deve conter flag de sincronização");
});

test("US24 - fotografiaRepository possui queries SQL válidas para salvar e listar", () => {
  const caminhoRepo = path.join(__dirname, "../src/repositories/fotografiaRepository.js");
  const conteudo = fs.readFileSync(caminhoRepo, "utf-8");

  assert.ok(conteudo.includes("INSERT INTO fotografias"), "Deve conter inserção no SQLite");
  assert.ok(conteudo.includes("SELECT * FROM fotografias"), "Deve conter listagem geral");
  assert.ok(conteudo.includes("WHERE servico_id = ?"), "Deve permitir filtrar por servico_id");
  // Garante que os logs residuais foram limpos (Item 3 do review)
  assert.ok(!conteudo.includes("=== REGISTROS GRAVADOS NO SQLITE ==="), "Não deve conter dump de debug no console");
});

test("US24 - CapturaFotoScreen persiste foto em diretório de documentos permanente", () => {
  const caminhoScreen = path.join(__dirname, "../src/screens/CapturaFotoScreen.js");
  const conteudo = fs.readFileSync(caminhoScreen, "utf-8");

  // Garante persistência em FileSystem.documentDirectory (Item 2 do review)
  assert.ok(conteudo.includes("FileSystem.documentDirectory"), "Deve usar documentDirectory para persistência");
  assert.ok(conteudo.includes("caminho_local: destPath"), "caminho_local deve salvar o caminho permanente em documentDirectory");
  assert.ok(conteudo.includes("caminho_comprimido: destPath"), "caminho_comprimido deve salvar o caminho permanente em documentDirectory");

  // Garante tratamento de erros com Alert (Item 4 do review)
  assert.ok(conteudo.includes("Alert.alert"), "Deve exibir feedback de erro para o usuário via Alert");

  // Garante reuso do FeedbackModal (Item 5 do review)
  assert.ok(conteudo.includes("FeedbackModal"), "Deve reutilizar o FeedbackModal do design system");
});

test("US24 - EtapaCard e AcompanhamentoObraScreen repassam obraId corretamente", () => {
  const caminhoEtapaCard = path.join(__dirname, "../src/components/EtapaCard.js");
  const conteudoEtapa = fs.readFileSync(caminhoEtapaCard, "utf-8");

  assert.ok(conteudoEtapa.includes("obraId"), "EtapaCard deve receber obraId como prop");
  assert.ok(conteudoEtapa.includes("obraId: idObraEfetivo"), "EtapaCard deve repassar obraId na navegação");
  assert.ok(conteudoEtapa.includes("CapturaFoto"), "EtapaCard deve ter rota de navegação para CapturaFoto");

  const caminhoAcomp = path.join(__dirname, "../src/screens/AcompanhamentoObraScreen.js");
  const conteudoAcomp = fs.readFileSync(caminhoAcomp, "utf-8");
  assert.ok(conteudoAcomp.includes("obraId={"), "AcompanhamentoObraScreen deve passar obraId para EtapaCard");
});

test("US24 - Limpeza de dependência não utilizada do package.json", () => {
  const caminhoPkg = path.join(__dirname, "../package.json");
  const pkg = JSON.parse(fs.readFileSync(caminhoPkg, "utf-8"));

  assert.equal(
    pkg.dependencies["@react-native-async-storage/async-storage"],
    undefined,
    "@react-native-async-storage/async-storage não deve estar no package.json"
  );
  assert.ok(pkg.dependencies["expo-image-manipulator"], "expo-image-manipulator deve estar presente para redimensionar fotos");
});
