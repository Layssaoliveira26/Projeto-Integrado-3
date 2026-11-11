// mobile/src/utils/calculoMedicaoLocal.js
// Utilitário puro (sem dependências de banco ou rede) para cálculo local de medições em campo

const UNIDADES_INTEIRAS = [
  "un",
  "und",
  "unid",
  "unidade",
  "unidades",
  "cj",
  "conjunto",
  "pt",
  "ponto",
  "vb",
  "verba",
  "pc",
  "pç",
  "peca",
  "peça",
];

export const ehUnidadeInteira = (unidade) => {
  const limpa = String(unidade || "").trim().toLowerCase();
  return UNIDADES_INTEIRAS.includes(limpa);
};

export const paraNumeroSeguro = (valor, nomeCampo = "Valor") => {
  if (valor === null || valor === undefined || valor === "") {
    return 0;
  }
  const limpo =
    typeof valor === "string" ? valor.trim().replace(",", ".") : valor;
  const num = Number(limpo);
  if (!Number.isFinite(num)) {
    throw new Error(`${nomeCampo} inválido para cálculo numérico: "${valor}"`);
  }
  return num;
};

export const arredondar4 = (num) => {
  return Math.round((Number(num) + Number.EPSILON) * 10000) / 10000;
};

/**
 * Executa os cálculos orçamentários de uma medição localmente no dispositivo.
 * Produz exatamente a mesma estrutura esperada pelo backend e pelas telas.
 */
export const calcularMedicaoLocal = ({
  quantidadePeriodo,
  quantidadeAnterior = 0,
  valorAnterior = 0,
  quantidadeOrcada = 0,
  precoUnitario = 0,
  unidadeMedida = "un",
}) => {
  const qtdPeriodo = paraNumeroSeguro(
    quantidadePeriodo,
    "Quantidade medida no período"
  );
  if (qtdPeriodo < 0) {
    throw new Error("A quantidade medida no período não pode ser negativa.");
  }

  if (ehUnidadeInteira(unidadeMedida) && !Number.isInteger(qtdPeriodo)) {
    throw new Error(
      `Para serviços com unidade inteira (${unidadeMedida}), a quantidade medida não pode conter casas decimais fracionárias.`
    );
  }

  const qtdAnt = paraNumeroSeguro(quantidadeAnterior, "Quantidade anterior");
  const valAnt = paraNumeroSeguro(valorAnterior, "Valor anterior");
  const qtdOrc = paraNumeroSeguro(quantidadeOrcada, "Quantidade orçada");
  const precoUnit = paraNumeroSeguro(precoUnitario, "Preço unitário");

  const qtdAcumuladaAtual = arredondar4(qtdAnt + qtdPeriodo);
  const saldoQtd = arredondar4(qtdOrc - qtdAcumuladaAtual);
  const valMedidoPeriodo = arredondar4(qtdPeriodo * precoUnit);
  const valAcumuladoAtual = arredondar4(valAnt + valMedidoPeriodo);
  const pctExecucao =
    qtdOrc > 0 ? arredondar4((qtdAcumuladaAtual / qtdOrc) * 100) : 0;

  return {
    quantidade_medida_periodo: qtdPeriodo,
    quantidade_acumulada_anterior: qtdAnt,
    quantidade_acumulada_atual: qtdAcumuladaAtual,
    saldo_quantidade: saldoQtd,
    valor_medido_periodo: valMedidoPeriodo,
    valor_acumulado_anterior: valAnt,
    valor_acumulado_atual: valAcumuladoAtual,
    percentual_execucao: pctExecucao,
    superou_orcamento: saldoQtd < 0,
  };
};

export default {
  ehUnidadeInteira,
  paraNumeroSeguro,
  arredondar4,
  calcularMedicaoLocal,
};

