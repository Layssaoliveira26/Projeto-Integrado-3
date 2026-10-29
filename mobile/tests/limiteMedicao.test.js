const test = require("node:test");
const assert = require("node:assert/strict");

test("Validação de limite de 100% na medição", async (t) => {
  await t.test("Calcula maxPermitido sem permitir ultrapassar a quantidade orçada", () => {
    const calcularMaxPermitido = (quantidadePrevista, acumuladoAnterior, decimals = 1) => {
      if (!quantidadePrevista || quantidadePrevista <= 0) return 999999999;
      const rest = quantidadePrevista - acumuladoAnterior;
      return Math.max(0, Number(rest.toFixed(decimals)));
    };

    // Caso 1: Orçado 10, acumulado anterior 4 -> Máximo permitido 6
    assert.equal(calcularMaxPermitido(10, 4, 2), 6);

    // Caso 2: Orçado 10, acumulado anterior 10 -> Máximo permitido 0 (já atingiu 100%)
    assert.equal(calcularMaxPermitido(10, 10, 2), 0);

    // Caso 3: Acumulado anterior maior que orçado (anomalia legada) -> Máximo permitido 0
    assert.equal(calcularMaxPermitido(10, 15, 2), 0);
  });

  await t.test("Bloqueia quantidade que ultrapasse 100% do orçamento", () => {
    const validarExcesso = (quantidadeAtual, acumuladoAnterior, quantidadePrevista, decimals = 2) => {
      if (quantidadePrevista <= 0) return true;
      const total = Number((quantidadeAtual + acumuladoAnterior).toFixed(decimals));
      const meta = Number(quantidadePrevista.toFixed(decimals));
      return total <= meta;
    };

    // 6 + 4 = 10 <= 10 -> Válido
    assert.equal(validarExcesso(6, 4, 10), true);

    // 7 + 4 = 11 > 10 -> Bloqueado
    assert.equal(validarExcesso(7, 4, 10), false);

    // 400% (4 em meta de 1) -> Bloqueado
    assert.equal(validarExcesso(4, 0, 1), false);
  });

  await t.test("Trava exibição do percentual em no máximo 100%", () => {
    const formatarPercentualExibicao = (pct) => {
      return Math.min(100, Math.max(0, Math.round(pct || 0)));
    };

    assert.equal(formatarPercentualExibicao(400), 100);
    assert.equal(formatarPercentualExibicao(125.5), 100);
    assert.equal(formatarPercentualExibicao(99.4), 99);
    assert.equal(formatarPercentualExibicao(100), 100);
    assert.equal(formatarPercentualExibicao(0), 0);
    assert.equal(formatarPercentualExibicao(-5), 0);
  });
});
