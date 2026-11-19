const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const xlsx = require("../node_modules/xlsx");

const {
  extrairDadosPlanilha,
  converterNumeroPlanilha,
} = require("../src/utils/planilhaParser");
const {
  escaparHtml,
  gerarHtmlRelatorioFotografico,
} = require("../src/utils/relatorioFotograficoUtils");

test("extrairDadosPlanilha rejeita códigos de serviço duplicados e quantidades fracionárias em unidades inteiras", () => {
  const planilhaDuplicada = [
    ["ITEM", "CÓDIGO", "DESCRIÇÃO", "FONTE", "UND", "QUANTIDADE", "PREÇO UNITÁRIO R$", "PREÇO TOTAL R$"],
    ["1", "", "FUNDAÇÕES", "", "", "", "", "1.000,00"],
    ["1.1", "COD-01", "Serviço A", "SINAPI", "M2", "10,00", "50,00", "500,00"],
    ["1.2", "COD-01", "Serviço B com código repetido", "SINAPI", "M2", "10,00", "50,00", "500,00"],
  ];

  const wbDup = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wbDup, xlsx.utils.aoa_to_sheet(planilhaDuplicada), "orcamento");

  assert.throws(
    () => extrairDadosPlanilha(wbDup, "duplicada.xlsx"),
    /Código de serviço duplicado/i
  );

  const planilhaDecimalUn = [
    ["ITEM", "CÓDIGO", "DESCRIÇÃO", "FONTE", "UND", "QUANTIDADE", "PREÇO UNITÁRIO R$", "PREÇO TOTAL R$"],
    ["1", "", "PRELIMINARES", "", "", "", "", "750,00"],
    ["1.1", "COD-UN", "Placa de obra", "SINAPI", "UN", "1,5", "500,00", "750,00"],
  ];

  const wbUn = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wbUn, xlsx.utils.aoa_to_sheet(planilhaDecimalUn), "orcamento");

  assert.throws(
    () => extrairDadosPlanilha(wbUn, "decimal_un.xlsx"),
    /unidade inteira/i
  );

  assert.equal(converterNumeroPlanilha("1.250,75", "Preço"), 1250.75);
});

test("Medicao preserva no mínimo duas casas decimais para unidades contínuas sem arredondar saldo acima da meta", () => {
  const conteudoMedicao = fs.readFileSync(
    path.join(__dirname, "../src/screens/Medicao.js"),
    "utf-8"
  );

  assert.match(conteudoMedicao, /m:\s*\{\s*step:\s*0\.1,\s*decimals:\s*2/);
  assert.match(conteudoMedicao, /"m²":\s*\{\s*step:\s*0\.1,\s*decimals:\s*2/);
  assert.match(conteudoMedicao, /"m³":\s*\{\s*step:\s*0\.1,\s*decimals:\s*2/);
  assert.ok(
    conteudoMedicao.includes("calcularSaldoMaximoPermitido"),
    "Medicao.js deve truncar o saldo máximo disponível sem arredondar acima da meta"
  );
});

test("Menus e tela de acompanhamento expõem desarquivar obra, modo somente leitura e exclusão de fotografia", () => {
  const menuOpcoes = fs.readFileSync(
    path.join(__dirname, "../src/components/MenuOpcoesObra.js"),
    "utf-8"
  );
  const menuAcoes = fs.readFileSync(
    path.join(__dirname, "../src/components/MenuAcoesObra.js"),
    "utf-8"
  );
  const acompanhamento = fs.readFileSync(
    path.join(__dirname, "../src/screens/AcompanhamentoObraScreen.js"),
    "utf-8"
  );
  const modalFoto = fs.readFileSync(
    path.join(__dirname, "../src/components/ModalVisualizarFoto.js"),
    "utf-8"
  );

  assert.ok(menuOpcoes.includes("Desarquivar obra"), "MenuOpcoesObra deve expor Desarquivar obra para obras arquivadas");
  assert.ok(menuAcoes.includes("desarquivarObra"), "MenuAcoesObra deve acionar desarquivarObra");
  assert.ok(acompanhamento.includes("obraSomenteLeitura"), "AcompanhamentoObraScreen deve calcular obraSomenteLeitura");
  assert.ok(acompanhamento.includes("excluirFotografia"), "AcompanhamentoObraScreen deve integrar excluirFotografia");
  assert.ok(modalFoto.includes("Trash2"), "ModalVisualizarFoto deve exibir botão de exclusão de fotografia");
});

test("escaparHtml neutraliza marcações HTML em nomes e descrições no relatório fotográfico", () => {
  assert.equal(escaparHtml('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");

  const html = gerarHtmlRelatorioFotografico({
    obraNome: 'Obra <img src=x onerror="alert(1)">',
    obraEndereco: "Rua A & B",
    numeroCiclo: 1,
    etapas: [],
  });

  assert.ok(!html.includes('<img src=x onerror="alert(1)">'));
  assert.ok(html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"));
});
