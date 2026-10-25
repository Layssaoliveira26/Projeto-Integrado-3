const xlsx = require("xlsx");
const Decimal = require("decimal.js");
const planilhaFinalRepository = require("../repositories/planilhaFinalRepository");

// Configuração decimal com precisão financeira
const PrecisionDecimal = Decimal.clone({
  precision: 28,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Converte valor para Decimal seguro
 */
function toDecimal(val) {
  try {
    return new PrecisionDecimal(val || 0);
  } catch {
    return new PrecisionDecimal(0);
  }
}

/**
 * Agrupa as linhas do banco de dados em Etapas e Serviços com totais calculados.
 */
async function obterDadosPlanilhaFinal(obraId, cicloId = null) {
  const obra = await planilhaFinalRepository.buscarObraPorId(obraId);
  if (!obra) {
    const err = new Error("Obra não encontrada.");
    err.status = 404;
    throw err;
  }

  const ciclo = await planilhaFinalRepository.buscarCicloReferencia(obraId, cicloId);
  if (!ciclo) {
    const err = new Error("Nenhum ciclo de medição cadastrado para esta obra.");
    err.status = 404;
    throw err;
  }

  const linhas = await planilhaFinalRepository.buscarEstruturaPlanilhaFinal(obraId, ciclo.id);
  if (!linhas || linhas.length === 0) {
    const err = new Error("A obra não possui serviços cadastrados para geração da planilha final.");
    err.status = 400;
    throw err;
  }

  const etapasMap = new Map();

  let obraTotalOrcado = new PrecisionDecimal(0);
  let obraTotalAnterior = new PrecisionDecimal(0);
  let obraTotalPeriodo = new PrecisionDecimal(0);
  let obraTotalAcumulado = new PrecisionDecimal(0);
  let obraTotalSaldo = new PrecisionDecimal(0);

  linhas.forEach((linha) => {
    const precoTotalOrcado = toDecimal(linha.preco_total_orcado);
    const valorAnterior = toDecimal(linha.valor_anterior);
    const valorPeriodo = toDecimal(linha.valor_periodo);
    const valorAcumulado = toDecimal(linha.valor_acumulado);
    const saldoValor = toDecimal(linha.saldo_valor);

    obraTotalOrcado = obraTotalOrcado.plus(precoTotalOrcado);
    obraTotalAnterior = obraTotalAnterior.plus(valorAnterior);
    obraTotalPeriodo = obraTotalPeriodo.plus(valorPeriodo);
    obraTotalAcumulado = obraTotalAcumulado.plus(valorAcumulado);
    obraTotalSaldo = obraTotalSaldo.plus(saldoValor);

    if (!etapasMap.has(linha.etapa_id)) {
      etapasMap.set(linha.etapa_id, {
        id: linha.etapa_id,
        nome: linha.etapa_nome,
        ordem: linha.etapa_ordem,
        total_orcado: new PrecisionDecimal(0),
        total_anterior: new PrecisionDecimal(0),
        total_periodo: new PrecisionDecimal(0),
        total_acumulado: new PrecisionDecimal(0),
        total_saldo: new PrecisionDecimal(0),
        servicos: [],
      });
    }

    const etapa = etapasMap.get(linha.etapa_id);
    etapa.total_orcado = etapa.total_orcado.plus(precoTotalOrcado);
    etapa.total_anterior = etapa.total_anterior.plus(valorAnterior);
    etapa.total_periodo = etapa.total_periodo.plus(valorPeriodo);
    etapa.total_acumulado = etapa.total_acumulado.plus(valorAcumulado);
    etapa.total_saldo = etapa.total_saldo.plus(saldoValor);

    etapa.servicos.push({
      id: linha.servico_id,
      codigo_servico: linha.codigo_servico,
      descricao: linha.servico_descricao,
      fonte_origem: linha.fonte_origem || "",
      unidade_medida: linha.unidade_medida,
      quantidade_orcada: parseFloat(new PrecisionDecimal(linha.quantidade_orcada).toFixed(2)),
      preco_unitario: parseFloat(new PrecisionDecimal(linha.preco_unitario).toFixed(2)),
      preco_total: parseFloat(new PrecisionDecimal(linha.preco_total_orcado).toFixed(2)),
      quantidade_anterior: parseFloat(new PrecisionDecimal(linha.quantidade_anterior).toFixed(2)),
      valor_anterior: parseFloat(new PrecisionDecimal(linha.valor_anterior).toFixed(2)),
      quantidade_periodo: parseFloat(new PrecisionDecimal(linha.quantidade_periodo).toFixed(2)),
      valor_periodo: parseFloat(new PrecisionDecimal(linha.valor_periodo).toFixed(2)),
      quantidade_acumulada: parseFloat(new PrecisionDecimal(linha.quantidade_acumulada).toFixed(2)),
      valor_acumulado: parseFloat(new PrecisionDecimal(linha.valor_acumulado).toFixed(2)),
      saldo_quantidade: parseFloat(new PrecisionDecimal(linha.saldo_quantidade).toFixed(2)),
      saldo_valor: parseFloat(new PrecisionDecimal(linha.saldo_valor).toFixed(2)),
      percentual_execucao: parseFloat(new PrecisionDecimal(linha.percentual_execucao).toFixed(2)),
    });
  });

  const etapas = Array.from(etapasMap.values()).map((etapa) => {
    const percentual = etapa.total_orcado.isZero()
      ? 0
      : etapa.total_acumulado.dividedBy(etapa.total_orcado).times(100).toNumber();

    return {
      id: etapa.id,
      nome: etapa.nome,
      ordem: etapa.ordem,
      total_orcado: parseFloat(etapa.total_orcado.toFixed(2)),
      total_anterior: parseFloat(etapa.total_anterior.toFixed(2)),
      total_periodo: parseFloat(etapa.total_periodo.toFixed(2)),
      total_acumulado: parseFloat(etapa.total_acumulado.toFixed(2)),
      total_saldo: parseFloat(etapa.total_saldo.toFixed(2)),
      percentual_execucao: parseFloat(percentual.toFixed(2)),
      servicos: etapa.servicos,
    };
  });

  const percentualGeral = obraTotalOrcado.isZero()
    ? 0
    : obraTotalAcumulado.dividedBy(obraTotalOrcado).times(100).toNumber();

  return {
    obra: {
      id: obra.id,
      nome: obra.nome,
      endereco: obra.endereco,
      status: obra.status,
    },
    ciclo: {
      id: ciclo.id,
      numero_ciclo: ciclo.numero_ciclo,
      status: ciclo.status,
      data_inicio: ciclo.data_inicio,
      data_encerramento: ciclo.data_encerramento,
    },
    totais: {
      total_orcado: parseFloat(obraTotalOrcado.toFixed(2)),
      total_anterior: parseFloat(obraTotalAnterior.toFixed(2)),
      total_periodo: parseFloat(obraTotalPeriodo.toFixed(2)),
      total_acumulado: parseFloat(obraTotalAcumulado.toFixed(2)),
      total_saldo: parseFloat(obraTotalSaldo.toFixed(2)),
      percentual_execucao: parseFloat(percentualGeral.toFixed(2)),
    },
    etapas,
  };
}

/**
 * Formata percentual para exibição pt-BR com 2 casas decimais.
 */
function formatarPercentualPtBr(valor) {
  if (valor === null || valor === undefined || isNaN(valor)) return "0,00%";
  return `${Number(valor).toFixed(2).replace(".", ",")}%`;
}

/**
 * Gera o arquivo binário .xlsx a partir dos dados consolidados da planilha final.
 */
function gerarExcelPlanilhaFinal(dados) {
  const rows = [];

  // Cabeçalho institucional
  rows.push(["SISTEMA METRIA - BOLETIM DE MEDIÇÃO FINAL DA OBRA"]);
  rows.push([`OBRA: ${dados.obra.nome}`]);
  if (dados.obra.endereco) {
    rows.push([`ENDEREÇO: ${dados.obra.endereco}`]);
  }
  rows.push([`CICLO DE MEDIÇÃO: Ciclo ${dados.ciclo.numero_ciclo} (${dados.ciclo.status.toUpperCase()})`]);
  rows.push([`DATA DE EMISSÃO: ${new Date().toLocaleDateString("pt-BR")}`]);
  rows.push([]); // Espaçamento

  // Cabeçalho das colunas (Atende a US22)
  rows.push([
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
  ]);

  // Itera por etapas e serviços
  dados.etapas.forEach((etapa, idxEtapa) => {
    const numEtapa = etapa.ordem || idxEtapa + 1;

    // Linha da Etapa
    rows.push([
      String(numEtapa),
      "",
      etapa.nome,
      "",
      "",
      "",
      "",
      etapa.total_orcado,
      "",
      etapa.total_anterior,
      "",
      etapa.total_periodo,
      "",
      etapa.total_acumulado,
      "",
      etapa.total_saldo,
      formatarPercentualPtBr(etapa.percentual_execucao),
    ]);

    // Serviços da Etapa
    etapa.servicos.forEach((servico, idxServico) => {
      const itemServico = `${numEtapa}.${idxServico + 1}`;
      rows.push([
        itemServico,
        servico.codigo_servico,
        servico.descricao,
        servico.fonte_origem || "",
        servico.unidade_medida,
        servico.quantidade_orcada,
        servico.preco_unitario,
        servico.preco_total,
        servico.quantidade_anterior,
        servico.valor_anterior,
        servico.quantidade_periodo,
        servico.valor_periodo,
        servico.quantidade_acumulada,
        servico.valor_acumulado,
        servico.saldo_quantidade,
        servico.saldo_valor,
        formatarPercentualPtBr(servico.percentual_execucao),
      ]);
    });
  });

  // Linha de Totais Gerais da Obra
  rows.push([]);
  const idxTotalGeral = rows.length;
  rows.push([
    "TOTAL GERAL DA OBRA",
    "",
    "",
    "",
    "",
    "",
    "",
    dados.totais.total_orcado,
    "",
    dados.totais.total_anterior,
    "",
    dados.totais.total_periodo,
    "",
    dados.totais.total_acumulado,
    "",
    dados.totais.total_saldo,
    formatarPercentualPtBr(dados.totais.percentual_execucao),
  ]);

  const worksheet = xlsx.utils.aoa_to_sheet(rows);

  // Formatação de máscaras numéricas (#,##0.00) nas células
  const range = xlsx.utils.decode_range(worksheet["!ref"]);
  const colunasMoeda = [6, 7, 9, 11, 13, 15]; // UNITÁRIO, TOTAL ORÇADO, VALOR ANTERIOR, VALOR PERÍODO, VALOR ACUMULADO, SALDO VALOR
  const colunasQtd = [5, 8, 10, 12, 14]; // QTD ORÇADA, QTD ANTERIOR, QTD PERÍODO, QTD ACUMULADA, SALDO QTD

  for (let R = 7; R <= range.e.r; ++R) {
    colunasMoeda.forEach((C) => {
      const addr = xlsx.utils.encode_cell({ r: R, c: C });
      if (worksheet[addr] && typeof worksheet[addr].v === "number") {
        worksheet[addr].z = "#,##0.00";
      }
    });

    colunasQtd.forEach((C) => {
      const addr = xlsx.utils.encode_cell({ r: R, c: C });
      if (worksheet[addr] && typeof worksheet[addr].v === "number") {
        worksheet[addr].z = "#,##0.00";
      }
    });
  }

  // Mesclagens estruturais
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 16 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 16 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 16 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 16 } },
    { s: { r: 4, c: 0 }, e: { r: 4, c: 16 } },
    { s: { r: idxTotalGeral, c: 0 }, e: { r: idxTotalGeral, c: 6 } },
  ];

  // Define largura confortável para colunas
  worksheet["!cols"] = [
    { wch: 8 },  // ITEM
    { wch: 14 }, // CÓDIGO
    { wch: 52 }, // DESCRIÇÃO
    { wch: 10 }, // FONTE
    { wch: 8 },  // UND
    { wch: 14 }, // QTD ORÇADA
    { wch: 16 }, // UNITÁRIO (R$)
    { wch: 20 }, // TOTAL ORÇADO (R$)
    { wch: 14 }, // QTD ANTERIOR
    { wch: 20 }, // VALOR ANTERIOR (R$)
    { wch: 14 }, // QTD PERÍODO
    { wch: 20 }, // VALOR PERÍODO (R$)
    { wch: 16 }, // QTD ACUMULADA
    { wch: 22 }, // VALOR ACUMULADO (R$)
    { wch: 14 }, // SALDO QTD
    { wch: 20 }, // SALDO VALOR (R$)
    { wch: 14 }, // % EXECUÇÃO
  ];

  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, "Medição Final");

  return xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
}

module.exports = {
  obterDadosPlanilhaFinal,
  gerarExcelPlanilhaFinal,
};
