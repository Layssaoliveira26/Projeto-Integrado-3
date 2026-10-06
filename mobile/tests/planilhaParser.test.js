const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const xlsx = require("../node_modules/xlsx");

const {
  extrairDadosPlanilha,
  classificarLinha,
  normalizarTexto,
  formatarTamanho,
} = require("../src/utils/planilhaParser");

test("normalizarTexto remove acentuação, quebras de linha e padroniza para maiúsculas", () => {
  assert.equal(normalizarTexto("  cabeçalho\nprincipal "), "CABECALHO PRINCIPAL");
  assert.equal(normalizarTexto("PREÇO\nUNITÁRIO R$"), "PRECO UNITARIO R$");
  assert.equal(normalizarTexto("DESCRIÇÃO"), "DESCRICAO");
  assert.equal(normalizarTexto("CÓDIGO"), "CODIGO");
  assert.equal(normalizarTexto(null), "");
});

test("formatarTamanho exibe bytes formatados em KB e MB", () => {
  assert.equal(formatarTamanho(0), "0 KB");
  assert.equal(formatarTamanho(1024), "1 KB");
  assert.equal(formatarTamanho(15360), "15 KB");
  assert.equal(formatarTamanho(2097152), "2 MB");
});

test("classificarLinha: diferencia colunas de etapas e serviços segundo o modelo padrão", () => {
  // Linha de Etapa: possui ITEM e DESCRIÇÃO (ou nome na coluna CÓDIGO por mesclagem), e opcional PREÇO TOTAL
  const etapa = classificarLinha({
    item: "1",
    codigo: "",
    descricao: "SERVIÇOS PRELIMINARES",
    fonte: "",
    und: "",
    quantidade: "",
    precoUnitario: "",
    precoTotal: "3.500,00",
    rawRow: ["1", "", "SERVIÇOS PRELIMINARES", "", "", "", "", "3.500,00"],
  });
  assert.equal(etapa, "ETAPA");

  // Linha de Etapa mesclada (onde o texto fica na primeira célula mesclada B4)
  const etapaMesclada = classificarLinha({
    item: "1",
    codigo: "Etapa 1 da obra(ex: SERVIÇOS PRELIMINARES)",
    descricao: "",
    fonte: "",
    und: "",
    quantidade: "",
    precoUnitario: "",
    precoTotal: "",
    rawRow: ["1", "Etapa 1 da obra(ex: SERVIÇOS PRELIMINARES)", "", "", "", "", "", ""],
  });
  assert.equal(etapaMesclada, "ETAPA");

  // Linha de Serviço: possui colunas exclusivas de serviço (código, fonte, und, quantidade, preço unitário)
  const servicoComCamposExclusivos = classificarLinha({
    item: "1.1",
    codigo: "00004813",
    descricao: "PLACA DE OBRA EM CHAPA GALVANIZADA",
    fonte: "SINAPI",
    und: "M2",
    quantidade: "12",
    precoUnitario: "250,00",
    precoTotal: "3.000,00",
    rawRow: ["1.1", "00004813", "PLACA DE OBRA EM CHAPA GALVANIZADA", "SINAPI", "M2", "12", "250,00", "3.000,00"],
  });
  assert.equal(servicoComCamposExclusivos, "SERVICO");

  // Linha de Serviço pelo item de subnível (ex: 1.1) mesmo que colunas numéricas ainda não estejam preenchidas (placeholder)
  const servicoPlaceholder = classificarLinha({
    item: "1.1",
    codigo: "",
    descricao: "serviço 1 da etapa 1",
    fonte: "",
    und: "",
    quantidade: "",
    precoUnitario: "",
    precoTotal: "",
    rawRow: ["1.1", "", "serviço 1 da etapa 1", "", "", "", "", ""],
  });
  assert.equal(servicoPlaceholder, "SERVICO");

  // Linhas de rodapé e totais devem ser ignoradas (retornar null)
  const linhaBdi = classificarLinha({
    rawRow: ["", "", "", "", "", "VALOR BDI TOTAL:", "", ""],
  });
  assert.equal(linhaBdi, null);

  const linhaOrcamento = classificarLinha({
    rawRow: ["", "", "", "", "", "VALOR ORÇAMENTO:", "", "4.442,36"],
  });
  assert.equal(linhaOrcamento, null);

  const linhaValorTotal = classificarLinha({
    rawRow: ["", "", "", "", "", "VALOR TOTAL:", "", "4.442,36"],
  });
  assert.equal(linhaValorTotal, null);

  const linhaAssinatura = classificarLinha({
    rawRow: ["\n\n\nAssinatura", "", "", "", "", "", "", ""],
  });
  assert.equal(linhaAssinatura, null);
});

test("extrairDadosPlanilha processa com sucesso o arquivo mobile/assets/planilha_padrao.xlsx", () => {
  const caminhoPlanilha = path.join(__dirname, "../assets/planilha_padrao.xlsx");
  const buffer = fs.readFileSync(caminhoPlanilha);
  const wb = xlsx.read(buffer, { type: "buffer" });

  const resultado = extrairDadosPlanilha(wb, "planilha_padrao.xlsx");

  assert.equal(resultado.valido, true);
  assert.equal(resultado.totalColunas, 8);
  assert.equal(resultado.totalLinhas, 10); // Conta até a última linha com dados, não 1000
  assert.equal(resultado.totalServicos, 2);
  assert.equal(resultado.payload.nome_arquivo, "planilha_padrao.xlsx");
  assert.equal(resultado.payload.etapas.length, 1);

  const etapa = resultado.payload.etapas[0];
  assert.equal(etapa.item, "1");
  assert.equal(etapa.nome, "Etapa 1 da obra(ex: SERVIÇOS PRELIMINARES)");
  assert.equal(etapa.servicos.length, 2);

  const servico1 = etapa.servicos[0];
  assert.equal(servico1.item, "1.1");
  assert.equal(servico1.codigo_servico, "1.1");
  assert.equal(servico1.descricao, "serviço 1 da etapa 1");

  const servico2 = etapa.servicos[1];
  assert.equal(servico2.item, "1.2");
  assert.equal(servico2.codigo_servico, "1.2");
  assert.equal(servico2.descricao, "serviço 2 da etapa 1");
});

test("extrairDadosPlanilha processa planilha preenchida com múltiplas etapas e serviços", () => {
  const dadosPlanilha = [
    ["cabeçalho institucional", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", ""],
    ["ITEM", "CÓDIGO", "DESCRIÇÃO", "FONTE", "UND", "QUANTIDADE", "PREÇO\nUNITÁRIO R$", "PREÇO\nTOTAL R$"],
    ["1", "", "SERVIÇOS PRELIMINARES", "", "", "", "", "3.202,36"],
    ["1.1", "00004813", "PLACA DE OBRA EM CHAPA GALVANIZADA", "SINAPI", "M2", "12,00", "250,00", "3.000,00"],
    ["1.2", "C2849", "INSTALAÇÕES PROVISÓRIAS DE ESGOTO", "SEINFRA", "UN", "1,00", "202,36", "202,36"],
    ["2", "", "MOVIMENTO DE TERRA", "", "", "", "", "1.240,00"],
    ["2.1", "93358", "ESCAVAÇÃO MANUAL DE VALA", "SINAPI", "M3", "15,50", "80,00", "1.240,00"],
    ["", "", "", "", "", "VALOR BDI TOTAL:", "", ""],
    ["", "", "", "", "", "VALOR ORÇAMENTO:", "", "4.442,36"],
    ["", "", "", "", "", "VALOR TOTAL:", "", "4.442,36"],
    ["Assinatura do Engenheiro", "", "", "", "", "", "", ""]
  ];

  const ws = xlsx.utils.aoa_to_sheet(dadosPlanilha);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "orcamento");

  const resultado = extrairDadosPlanilha(wb, "orcamento_obra.xlsx");

  assert.equal(resultado.valido, true);
  assert.equal(resultado.totalServicos, 3);
  assert.equal(resultado.payload.etapas.length, 2);

  // Etapa 1
  const et1 = resultado.payload.etapas[0];
  assert.equal(et1.item, "1");
  assert.equal(et1.nome, "SERVIÇOS PRELIMINARES");
  assert.equal(et1.preco_total, "3.202,36");
  assert.equal(et1.servicos.length, 2);

  assert.equal(et1.servicos[0].codigo_servico, "00004813");
  assert.equal(et1.servicos[0].descricao, "PLACA DE OBRA EM CHAPA GALVANIZADA");
  assert.equal(et1.servicos[0].fonte_origem, "SINAPI");
  assert.equal(et1.servicos[0].unidade_medida, "M2");
  assert.equal(et1.servicos[0].quantidade_orcada, "12,00");
  assert.equal(et1.servicos[0].preco_unitario, "250,00");
  assert.equal(et1.servicos[0].preco_total, "3.000,00");

  assert.equal(et1.servicos[1].codigo_servico, "C2849");
  assert.equal(et1.servicos[1].descricao, "INSTALAÇÕES PROVISÓRIAS DE ESGOTO");
  assert.equal(et1.servicos[1].fonte_origem, "SEINFRA");
  assert.equal(et1.servicos[1].unidade_medida, "UN");
  assert.equal(et1.servicos[1].quantidade_orcada, "1,00");
  assert.equal(et1.servicos[1].preco_unitario, "202,36");
  assert.equal(et1.servicos[1].preco_total, "202,36");

  // Etapa 2
  const et2 = resultado.payload.etapas[1];
  assert.equal(et2.item, "2");
  assert.equal(et2.nome, "MOVIMENTO DE TERRA");
  assert.equal(et2.preco_total, "1.240,00");
  assert.equal(et2.servicos.length, 1);

  assert.equal(et2.servicos[0].codigo_servico, "93358");
  assert.equal(et2.servicos[0].descricao, "ESCAVAÇÃO MANUAL DE VALA");
  assert.equal(et2.servicos[0].fonte_origem, "SINAPI");
  assert.equal(et2.servicos[0].unidade_medida, "M3");
  assert.equal(et2.servicos[0].quantidade_orcada, "15,50");
  assert.equal(et2.servicos[0].preco_unitario, "80,00");
  assert.equal(et2.servicos[0].preco_total, "1.240,00");
});

test("extrairDadosPlanilha rejeita com erro INCOMPATIVEL quando cabeçalho não segue o padrão", () => {
  const dadosInvalidos = [
    ["ColA", "ColB", "ColC"],
    ["1", "Texto", "100"]
  ];

  const ws = xlsx.utils.aoa_to_sheet(dadosInvalidos);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "Aba");

  assert.throws(
    () => extrairDadosPlanilha(wb, "invalido.xlsx"),
    (err) => {
      assert.equal(err.code, "INCOMPATIVEL");
      assert.match(err.message, /Cabeçalho da planilha padrão não encontrado/);
      return true;
    }
  );
});

test("extrairDadosPlanilha aceita cabeçalhos e descrições com quebras de linha variadas (CRLF, LF, CR)", () => {
  const dadosComQuebras = [
    ["cabeçalho\r\n"],
    ["\n"],
    ["ITEM\r", "CÓDIGO\n", "DESCRIÇÃO\r\n", "FONTE", "UND\n", "QUANTIDADE\r", "PREÇO\r\nUNITÁRIO R$", "PREÇO\nTOTAL R$"],
    ["1", "Etapa 1\nPreliminar", "", "", "", "", "", "1.000,00"],
    ["1.1", "001", "Serviço com\r\nquebra de linha\nno texto", "SINAPI", "UN", "2", "500,00", "1.000,00"]
  ];

  const ws = xlsx.utils.aoa_to_sheet(dadosComQuebras);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, "orcamento");

  const res = extrairDadosPlanilha(wb, "teste_quebras.xlsx");
  assert.equal(res.valido, true);
  assert.equal(res.totalServicos, 1);
  assert.equal(res.payload.etapas[0].nome, "Etapa 1\nPreliminar");
  assert.equal(res.payload.etapas[0].servicos[0].descricao, "Serviço com\r\nquebra de linha\nno texto");
});
