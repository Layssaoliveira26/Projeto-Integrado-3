const test = require("node:test");
const assert = require("node:assert/strict");
const {
  PrecisionDecimal,
  paraDecimal,
  somar,
  subtrair,
  multiplicar,
  dividir,
  calcularPercentual,
  formatarDecimal,
  calcularMedicaoServico,
} = require("../src/utils/precisionCalculo");

test("Aritmética básica elimina imprecisões do ponto flutuante IEEE 754", () => {
  // Em JS puro: 0.1 + 0.2 === 0.30000000000000004
  assert.equal(somar(0.1, 0.2), "0.3000");

  // Em JS puro: 1.4 * 3 === 4.200000000000001
  assert.equal(multiplicar(1.4, 3), "4.2000");

  // Em JS puro: 100.05 - 100 === 0.04999999999999716
  assert.equal(subtrair(100.05, 100), "0.0500");

  // Divisão exata e dízimas com arredondamento HALF_UP
  assert.equal(dividir(10, 3, 4), "3.3333");
  assert.equal(dividir(2, 3, 4), "0.6667"); // 0.66666... arredonda para 0.6667
});

test("Divisão por zero retorna '0' sem lançar exceção", () => {
  assert.equal(dividir(50, 0), "0.0000");
  assert.equal(calcularPercentual(50, 0), "0.0000");
});

test("calcularPercentual calcula com exatidão decimal", () => {
  assert.equal(calcularPercentual(25, 100), "25.0000");
  assert.equal(calcularPercentual(1, 3), "33.3333");
  assert.equal(calcularPercentual(12.5, 50), "25.0000");
  assert.equal(calcularPercentual(150, 100), "150.0000");
});

test("calcularMedicaoServico - primeira medição do serviço", () => {
  const resultado = calcularMedicaoServico({
    quantidadePeriodo: "4.5000",
    quantidadeAnterior: "0.0000",
    valorAnterior: "0.0000",
    quantidadeOrcada: "10.0000",
    precoUnitario: "250.3500",
  });

  assert.equal(resultado.quantidade_medida_periodo, "4.5000");
  assert.equal(resultado.quantidade_acumulada_anterior, "0.0000");
  assert.equal(resultado.quantidade_acumulada_atual, "4.5000");
  assert.equal(resultado.saldo_quantidade, "5.5000");
  // 4.5 * 250.35 = 1126.575 -> 1126.5750
  assert.equal(resultado.valor_medido_periodo, "1126.5750");
  assert.equal(resultado.valor_acumulado_anterior, "0.0000");
  assert.equal(resultado.valor_acumulado_atual, "1126.5750");
  // (4.5 / 10) * 100 = 45%
  assert.equal(resultado.percentual_execucao, "45.0000");
  assert.equal(resultado.superou_orcamento, false);
});

test("calcularMedicaoServico - segunda medição acumulativa preserva precisão", () => {
  const resultado = calcularMedicaoServico({
    quantidadePeriodo: "3.2500",
    quantidadeAnterior: "4.5000",
    valorAnterior: "1126.5750",
    quantidadeOrcada: "10.0000",
    precoUnitario: "250.3500",
  });

  assert.equal(resultado.quantidade_medida_periodo, "3.2500");
  assert.equal(resultado.quantidade_acumulada_anterior, "4.5000");
  assert.equal(resultado.quantidade_acumulada_atual, "7.7500");
  assert.equal(resultado.saldo_quantidade, "2.2500");
  // 3.25 * 250.35 = 813.6375
  assert.equal(resultado.valor_medido_periodo, "813.6375");
  assert.equal(resultado.valor_acumulado_anterior, "1126.5750");
  // 1126.5750 + 813.6375 = 1940.2125
  assert.equal(resultado.valor_acumulado_atual, "1940.2125");
  // 7.75 / 10 * 100 = 77.5%
  assert.equal(resultado.percentual_execucao, "77.5000");
  assert.equal(resultado.superou_orcamento, false);
});

test("calcularMedicaoServico - medição excedendo a quantidade orçada (saldo negativo)", () => {
  const resultado = calcularMedicaoServico({
    quantidadePeriodo: "5.0000",
    quantidadeAnterior: "8.0000",
    valorAnterior: "2000.0000",
    quantidadeOrcada: "10.0000",
    precoUnitario: "250.0000",
  });

  assert.equal(resultado.quantidade_acumulada_atual, "13.0000");
  assert.equal(resultado.saldo_quantidade, "-3.0000");
  assert.equal(resultado.percentual_execucao, "130.0000");
  assert.equal(resultado.superou_orcamento, true);
});

test("paraDecimal rejeita valores não numéricos", () => {
  assert.throws(() => paraDecimal("abc", "Campo Teste"), /Campo Teste inválido/);
  assert.throws(() => paraDecimal(NaN, "Campo Teste"), /Campo Teste inválido/);
  assert.throws(() => paraDecimal(Infinity, "Campo Teste"), /Campo Teste inválido/);
});
