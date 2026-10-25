const { test } = require("node:test");
const assert = require("node:assert/strict");
const xlsx = require("xlsx");
const planilhaFinalService = require("../src/services/planilhaFinalService");

// Mock de dados representativos
const mockDadosPlanilhaFinal = {
  obra: {
    id: "obra-uuid-123",
    nome: "Residencial Bela Vista",
    endereco: "Rua das Flores, 100",
    status: "ativa",
  },
  ciclo: {
    id: "ciclo-uuid-456",
    numero_ciclo: 2,
    status: "aberto",
    data_inicio: "2026-10-01",
    data_encerramento: null,
  },
  totais: {
    total_orcado: 10000.0,
    total_anterior: 2000.0,
    total_periodo: 3000.0,
    total_acumulado: 5000.0,
    total_saldo: 5000.0,
    percentual_execucao: 50.0,
  },
  etapas: [
    {
      id: "etapa-uuid-1",
      nome: "SERVIÇOS PRELIMINARES",
      ordem: 1,
      total_orcado: 4000.0,
      total_anterior: 1000.0,
      total_periodo: 1000.0,
      total_acumulado: 2000.0,
      total_saldo: 2000.0,
      percentual_execucao: 50.0,
      servicos: [
        {
          id: "servico-uuid-1",
          codigo_servico: "00004813",
          descricao: "PLACA DE OBRA EM CHAPA GALVANIZADA",
          fonte_origem: "SINAPI",
          unidade_medida: "M2",
          quantidade_orcada: 10.0,
          preco_unitario: 250.0,
          preco_total: 2500.0,
          quantidade_anterior: 2.0,
          valor_anterior: 500.0,
          quantidade_periodo: 3.0,
          valor_periodo: 750.0,
          quantidade_acumulada: 5.0,
          valor_acumulado: 1250.0,
          saldo_quantidade: 5.0,
          saldo_valor: 1250.0,
          percentual_execucao: 50.0,
        },
        {
          id: "servico-uuid-2",
          codigo_servico: "C2849",
          descricao: "INSTALAÇÕES PROVISÓRIAS DE ESGOTO",
          fonte_origem: "SEINFRA",
          unidade_medida: "UN",
          quantidade_orcada: 1.0,
          preco_unitario: 1500.0,
          preco_total: 1500.0,
          quantidade_anterior: 0.0,
          valor_anterior: 0.0,
          quantidade_periodo: 0.5,
          valor_periodo: 750.0,
          quantidade_acumulada: 0.5,
          valor_acumulado: 750.0,
          saldo_quantidade: 0.5,
          saldo_valor: 750.0,
          percentual_execucao: 50.0,
        },
      ],
    },
  ],
};

test("US22 - gerarExcelPlanilhaFinal gera arquivo .xlsx válido com todas as colunas exigidas", () => {
  const buffer = planilhaFinalService.gerarExcelPlanilhaFinal(mockDadosPlanilhaFinal);

  assert.ok(Buffer.isBuffer(buffer), "O retorno deve ser um Buffer de bytes do Excel");
  assert.ok(buffer.length > 0, "O buffer gerado não pode ser vazio");

  // Lê de volta usando a biblioteca xlsx para validar estrutura
  const workbook = xlsx.read(buffer, { type: "buffer" });
  assert.ok(workbook.SheetNames.includes("Medição Final"), "Deve conter a aba Medição Final");

  const sheet = workbook.Sheets["Medição Final"];
  const dados = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  assert.ok(dados[0][0].includes("SISTEMA METRIA"), "Deve conter identificação institucional");
  assert.ok(dados[1][0].includes("Residencial Bela Vista"), "Deve conter o nome da obra");
  assert.ok(dados[3][0].includes("Ciclo 2"), "Deve conter a referência ao ciclo");

  const linhaColunas = dados.find(
    (row) => Array.isArray(row) && row[0] === "ITEM" && row[1] === "CÓDIGO"
  );
  assert.ok(linhaColunas, "Deve conter a linha de cabeçalho das colunas");

  const colunasEsperadas = [
    "ITEM",
    "CÓDIGO",
    "DESCRIÇÃO",
    "FONTE",
    "UND",
    "QTD ORÇADA",
    "UNITÁRIO (R$)",
    "TOTAL ORÇADO (R$)",
    "QTD ANTERIOR",
    "VALOR ANTERIOR (R$)",
    "QTD PERÍODO",
    "VALOR PERÍODO (R$)",
    "QTD ACUMULADA",
    "VALOR ACUMULADO (R$)",
    "SALDO QTD",
    "SALDO VALOR (R$)",
    "% EXECUÇÃO",
  ];

  colunasEsperadas.forEach((col, index) => {
    assert.equal(linhaColunas[index], col, `Coluna no índice ${index} deve ser ${col}`);
  });

  // 3. Validação dos serviços com dados calculados
  const linhaServico = dados.find(
    (row) => Array.isArray(row) && row[1] === "00004813"
  );
  assert.ok(linhaServico, "Deve conter a linha do serviço 00004813");
  assert.equal(linhaServico[0], "1.1", "Item do serviço deve ser 1.1");
  assert.equal(linhaServico[2], "PLACA DE OBRA EM CHAPA GALVANIZADA");
  assert.equal(linhaServico[4], "M2");
  assert.equal(linhaServico[5], 10.0); // Qtd orçada
  assert.equal(linhaServico[7], 2500.0); // Total orçado
  assert.equal(linhaServico[8], 2.0); // Qtd anterior
  assert.equal(linhaServico[9], 500.0); // Valor anterior
  assert.equal(linhaServico[10], 3.0); // Qtd período
  assert.equal(linhaServico[11], 750.0); // Valor período
  assert.equal(linhaServico[12], 5.0); // Qtd acumulada
  assert.equal(linhaServico[13], 1250.0); // Valor acumulado
  assert.equal(linhaServico[14], 5.0); // Saldo qtd
  assert.equal(linhaServico[15], 1250.0); // Saldo valor
  assert.equal(linhaServico[16], "50,00%"); // % Execução

  // 4. Validação da linha de total geral
  const linhaTotalGeral = dados.find(
    (row) => Array.isArray(row) && row[0] === "TOTAL GERAL DA OBRA"
  );
  assert.ok(linhaTotalGeral, "Deve conter a linha de TOTAL GERAL DA OBRA");
  assert.equal(linhaTotalGeral[7], 10000.0); // Total orçado
  assert.equal(linhaTotalGeral[9], 2000.0); // Total anterior
  assert.equal(linhaTotalGeral[11], 3000.0); // Total período
  assert.equal(linhaTotalGeral[13], 5000.0); // Total acumulado
  assert.equal(linhaTotalGeral[15], 5000.0); // Total saldo
});
