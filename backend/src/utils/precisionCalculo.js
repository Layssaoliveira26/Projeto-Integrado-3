const Decimal = require("decimal.js");

// Configura precisão interna alta para cálculos intermediários e modo de arredondamento bancário/financeiro (ROUND_HALF_UP)
const PrecisionDecimal = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -9,
  toExpPos: 28,
});

/**
 * Converte de forma segura uma entrada (número, texto ou Decimal) para uma instância Decimal.
 * @param {number|string|Decimal} valor
 * @param {string} [nomeCampo='Valor']
 * @returns {PrecisionDecimal}
 */
const paraDecimal = (valor, nomeCampo = "Valor") => {
  if (valor === null || valor === undefined || valor === "") {
    return new PrecisionDecimal(0);
  }

  try {
    const num = new PrecisionDecimal(valor);
    if (!num.isFinite()) {
      throw new Error();
    }
    return num;
  } catch {
    throw new Error(`${nomeCampo} inválido para cálculo numérico: "${valor}"`);
  }
};

/**
 * Soma dois valores com precisão decimal.
 */
const somar = (a, b, casas = 4) => {
  return paraDecimal(a).plus(paraDecimal(b)).toFixed(casas);
};

/**
 * Subtrai dois valores com precisão decimal (a - b).
 */
const subtrair = (a, b, casas = 4) => {
  return paraDecimal(a).minus(paraDecimal(b)).toFixed(casas);
};

/**
 * Multiplica dois valores com precisão decimal.
 */
const multiplicar = (a, b, casas = 4) => {
  return paraDecimal(a).times(paraDecimal(b)).toFixed(casas);
};

/**
 * Divide dois valores com precisão decimal (a / b). Retorna '0' se divisor for zero.
 */
const dividir = (a, b, casas = 4) => {
  const decB = paraDecimal(b);
  if (decB.isZero()) {
    return new PrecisionDecimal(0).toFixed(casas);
  }
  return paraDecimal(a).dividedBy(decB).toFixed(casas);
};

/**
 * Calcula o percentual de execução: (parte / total) * 100 com precisão decimal.
 */
const calcularPercentual = (parte, total, casas = 4) => {
  const decTotal = paraDecimal(total);
  if (decTotal.isZero()) {
    return new PrecisionDecimal(0).toFixed(casas);
  }
  return paraDecimal(parte).dividedBy(decTotal).times(100).toFixed(casas);
};

/**
 * Formata um valor para a quantidade de casas decimais especificada usando ROUND_HALF_UP.
 */
const formatarDecimal = (valor, casas = 4) => {
  return paraDecimal(valor).toFixed(casas);
};

/**
 * Realiza todos os cálculos orçamentários da medição de um serviço com alta precisão.
 * Preserva a precisão dos dados importados e evita erros de arredondamento cumulativo.
 *
 * @param {Object} params
 * @param {number|string} params.quantidadePeriodo Quantidade executada no período
 * @param {number|string} [params.quantidadeAnterior=0] Quantidade acumulada até o ciclo anterior
 * @param {number|string} [params.valorAnterior=0] Valor financeiro acumulado até o ciclo anterior
 * @param {number|string} params.quantidadeOrcada Quantidade total orçada na planilha-base
 * @param {number|string} params.precoUnitario Preço unitário orçado na planilha-base
 * @returns {Object} Objeto contendo os campos calculados como strings exatas e valores numéricos
 */
const calcularMedicaoServico = ({
  quantidadePeriodo,
  quantidadeAnterior = 0,
  valorAnterior = 0,
  quantidadeOrcada,
  precoUnitario,
}) => {
  const qtdPeriodo = paraDecimal(quantidadePeriodo, "Quantidade medida no período");
  const qtdAnterior = paraDecimal(quantidadeAnterior, "Quantidade acumulada anterior");
  const valAnterior = paraDecimal(valorAnterior, "Valor acumulado anterior");
  const qtdOrcada = paraDecimal(quantidadeOrcada, "Quantidade orçada");
  const precoUnit = paraDecimal(precoUnitario, "Preço unitário");

  // Quantidade acumulada atual = anterior + período
  const qtdAcumuladaAtual = qtdAnterior.plus(qtdPeriodo);

  // Saldo de quantidade = orçada - acumulada atual
  const saldoQtd = qtdOrcada.minus(qtdAcumuladaAtual);

  // Valor medido no período = quantidade no período * preço unitário
  const valMedidoPeriodo = qtdPeriodo.times(precoUnit);

  // Valor acumulado atual = valor anterior + valor do período
  const valAcumuladoAtual = valAnterior.plus(valMedidoPeriodo);

  // Percentual de execução = (quantidade acumulada atual / quantidade orçada) * 100
  const pctExecucao = qtdOrcada.isZero()
    ? new PrecisionDecimal(0)
    : qtdAcumuladaAtual.dividedBy(qtdOrcada).times(100);

  return {
    quantidade_medida_periodo: qtdPeriodo.toFixed(4),
    quantidade_acumulada_anterior: qtdAnterior.toFixed(4),
    quantidade_acumulada_atual: qtdAcumuladaAtual.toFixed(4),
    saldo_quantidade: saldoQtd.toFixed(4),
    valor_medido_periodo: valMedidoPeriodo.toFixed(4),
    valor_acumulado_anterior: valAnterior.toFixed(4),
    valor_acumulado_atual: valAcumuladoAtual.toFixed(4),
    percentual_execucao: pctExecucao.toFixed(4),

    // Propriedades auxiliares para análise de negócio
    superou_orcamento: saldoQtd.isNegative(),
  };
};

module.exports = {
  PrecisionDecimal,
  paraDecimal,
  somar,
  subtrair,
  multiplicar,
  dividir,
  calcularPercentual,
  formatarDecimal,
  calcularMedicaoServico,
};
