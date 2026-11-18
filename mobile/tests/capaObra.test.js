const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("Capa da Obra - database/index.js define e migra coluna imagem_capa na tabela obras", () => {
  const caminhoDb = path.join(__dirname, "../src/database/index.js");
  const conteudo = fs.readFileSync(caminhoDb, "utf-8");

  assert.ok(conteudo.includes("imagem_capa TEXT"), "Schema de obras deve declarar imagem_capa TEXT");
  assert.ok(
    conteudo.includes("ALTER TABLE obras ADD COLUMN imagem_capa TEXT;"),
    "colMigrations deve adicionar imagem_capa em bancos existentes"
  );
});

test("Capa da Obra - obraLocalRepository persiste imagem_capa preservando valor local no Pull Sync", () => {
  const caminhoRepo = path.join(__dirname, "../src/repositories/obraLocalRepository.js");
  const conteudo = fs.readFileSync(caminhoRepo, "utf-8");

  assert.ok(conteudo.includes("imagem_capa"), "obraLocalRepository deve manipular imagem_capa");
  assert.ok(
    conteudo.includes("COALESCE(excluded.imagem_capa, obras.imagem_capa)"),
    "upsertObraSincronizada deve preservar imagem_capa local quando servidor não enviar"
  );
  assert.ok(!conteudo.includes("expo-image-picker"), "Repositório local deve permanecer puro sem UI/picker");
  assert.ok(!conteudo.includes("expo-file-system"), "Repositório local deve permanecer puro sem FileSystem");
});

test("Capa da Obra - NovaObra utiliza upload real e modal padronizado sem alert() nativo", () => {
  const caminhoNova = path.join(__dirname, "../src/screens/NovaObra.js");
  const conteudo = fs.readFileSync(caminhoNova, "utf-8");

  assert.ok(conteudo.includes("selecionarEPersistirImagemCapa"), "NovaObra deve usar selecionarEPersistirImagemCapa");
  assert.ok(!/\balert\s*\(/.test(conteudo), "NovaObra não deve usar alert() global de browser");
  assert.ok(conteudo.includes("imagem_capa:"), "NovaObra deve enviar imagem_capa ao criarObra");
  assert.ok(
    conteudo.includes('const [mensagemErroModal, setMensagemErroModal] = useState("")'),
    "NovaObra deve declarar o estado exibido pelo modal de erro"
  );
  assert.ok(conteudo.includes("*Nome:"), "NovaObra deve exibir o campo obrigatório de nome");
  assert.ok(conteudo.includes("*Endereço:"), "NovaObra deve exibir o campo obrigatório de endereço");
  assert.ok(conteudo.includes("*Data de início:"), "NovaObra deve exibir a data de início");
  assert.ok(conteudo.includes("*Data de conclusão:"), "NovaObra deve exibir a data de conclusão");
  assert.ok(
    conteudo.includes("onPress={handleSelecionarImagemCapa}"),
    "NovaObra deve permitir enviar uma imagem de capa"
  );
  assert.ok(
    conteudo.includes('navigation?.navigate?.("Home")'),
    "Após cadastrar, NovaObra deve voltar à Home quando não houver tela anterior"
  );
  assert.ok(
    !conteudo.includes('"ImportarPlanilha"'),
    "O cadastro da obra não deve abrir a importação automaticamente"
  );
});

test("Capa da Obra - EditarObra restaura imagem_capa salva e permite atualizar capa real", () => {
  const caminhoEditar = path.join(__dirname, "../src/screens/EditarObra.js");
  const conteudo = fs.readFileSync(caminhoEditar, "utf-8");

  assert.ok(conteudo.includes("selecionarEPersistirImagemCapa"), "EditarObra deve usar selecionarEPersistirImagemCapa");
  assert.ok(conteudo.includes("obra.imagem_capa || null"), "EditarObra deve restaurar imagem_capa existente");
  assert.ok(conteudo.includes("imagem_capa:"), "EditarObra deve enviar imagem_capa ao atualizarObra");
});

