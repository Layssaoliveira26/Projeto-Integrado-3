const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const fs = require("fs");
const xlsx = require("xlsx");

const {
  extrairDadosPlanilha,
  normalizarTexto,
} = require("../src/utils/planilhaParser");

test("US09 - Arquivo do modelo padrão existe e é um Excel válido", () => {
  const caminhoModelo = path.join(__dirname, "../assets/planilha_padrao.xlsx");
  assert.equal(fs.existsSync(caminhoModelo), true, "planilha_padrao.xlsx deve existir em mobile/assets");

  const stat = fs.statSync(caminhoModelo);
  assert.ok(stat.size > 0, "O arquivo do modelo padrão não pode estar vazio");

  const buffer = fs.readFileSync(caminhoModelo);
  const wb = xlsx.read(buffer, { type: "buffer" });
  assert.ok(wb.SheetNames.length > 0, "O modelo deve conter pelo menos uma planilha");
  assert.ok(wb.Sheets[wb.SheetNames[0]], "A primeira aba do modelo deve ser acessível");
});

test("US09 [Checklist 1] - Modelo padrão contém todos os campos obrigatórios", () => {
  const caminhoModelo = path.join(__dirname, "../assets/planilha_padrao.xlsx");
  const buffer = fs.readFileSync(caminhoModelo);
  const wb = xlsx.read(buffer, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];

  const dadosMatriz = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  // Localiza a linha de cabeçalho
  let linhaCabecalho = null;
  for (const linha of dadosMatriz) {
    if (!Array.isArray(linha) || linha.length < 8) continue;
    const col0 = normalizarTexto(linha[0]);
    const col2 = normalizarTexto(linha[2]);
    if (col0 === "ITEM" && col2 === "DESCRICAO") {
      linhaCabecalho = linha;
      break;
    }
  }

  assert.ok(linhaCabecalho, "O modelo deve conter uma linha de cabeçalho com os campos padrão");

  const colunasNormalizadas = linhaCabecalho.map(normalizarTexto);


  assert.equal(colunasNormalizadas[0], "ITEM", "Deve conter coluna ITEM");
  assert.ok(colunasNormalizadas[1].includes("CODIGO"), "Deve conter coluna CÓDIGO");
  assert.equal(colunasNormalizadas[2], "DESCRICAO", "Deve conter coluna DESCRIÇÃO");
  assert.equal(colunasNormalizadas[3], "FONTE", "Deve conter coluna FONTE");
  assert.ok(colunasNormalizadas[4].includes("UND"), "Deve conter coluna UND/UNIDADE");
  assert.ok(colunasNormalizadas[5].includes("QUANTIDADE"), "Deve conter coluna QUANTIDADE");
  assert.ok(colunasNormalizadas[6].includes("PRECO") && colunasNormalizadas[6].includes("UNITARIO"), "Deve conter coluna PREÇO UNITÁRIO");
  assert.ok(colunasNormalizadas[7].includes("PRECO") && colunasNormalizadas[7].includes("TOTAL"), "Deve conter coluna PREÇO TOTAL");
});

test("US09 [Checklist 2] - Modelo preenchido é aceito pela importação sem mapeamento manual", () => {
  const caminhoModelo = path.join(__dirname, "../assets/planilha_padrao.xlsx");
  const buffer = fs.readFileSync(caminhoModelo);
  const wb = xlsx.read(buffer, { type: "buffer" });

  const resultado = extrairDadosPlanilha(wb, "modelo_planilha_obras.xlsx");

  assert.equal(resultado.valido, true, "O modelo padrão deve ser válido");
  assert.ok(resultado.totalLinhas > 0, "Deve conter linhas de dados");
  assert.ok(resultado.payload.etapas.length > 0, "Deve conter etapas mapeadas automaticamente");

  const primeiraEtapa = resultado.payload.etapas[0];
  assert.ok(primeiraEtapa.nome, "Etapa deve conter nome");
  assert.ok(primeiraEtapa.servicos.length > 0, "Etapa deve conter serviços associados");

  const primeiroServico = primeiraEtapa.servicos[0];
  assert.ok(primeiroServico.codigo_servico, "Serviço deve conter código");
  assert.ok(primeiroServico.descricao, "Serviço deve conter descrição");
  assert.ok(primeiroServico.unidade_medida, "Serviço deve conter unidade de medida");
  assert.ok(primeiroServico.quantidade_orcada !== undefined, "Serviço deve conter quantidade orçada");
  assert.ok(primeiroServico.preco_unitario !== undefined, "Serviço deve conter preço unitário");
  assert.ok(primeiroServico.preco_total !== undefined, "Serviço deve conter preço total");
});
