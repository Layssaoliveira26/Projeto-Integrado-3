// Utilitários de máscara, validação e cálculo de prorrogação de prazo da obra (DD/MM/AAAA)

export const OPCOES_DIAS_PADRAO = [30, 90, 100, 180];

/**
 * Formatação automática para data no formato DD/MM/AAAA com bloqueio de dia > 31 e mês > 12.
 */
export const aplicarMascaraData = (texto) => {
  const apenasNumeros = String(texto || "").replace(/\D/g, "").slice(0, 8);
  let dia = apenasNumeros.slice(0, 2);
  let mes = apenasNumeros.slice(2, 4);
  const ano = apenasNumeros.slice(4, 8);

  if (dia.length === 2) {
    const d = parseInt(dia, 10);
    if (d > 31) dia = "31";
    else if (d === 0) dia = "01";
  }

  if (mes.length === 2) {
    const m = parseInt(mes, 10);
    if (m > 12) mes = "12";
    else if (m === 0) mes = "01";
  }

  if (apenasNumeros.length <= 2) return dia;
  if (apenasNumeros.length <= 4) return `${dia}/${mes}`;
  return `${dia}/${mes}/${ano}`;
};

/**
 * Sanitiza a entrada numérica de quantidade de dias (apenas inteiros positivos, até 4 dígitos).
 */
export const sanitizarEntradaDias = (texto) => {
  return String(texto || "")
    .replace(/\D/g, "")
    .replace(/^0+/, "")
    .slice(0, 4);
};

/**
 * Valida se uma string está no formato DD/MM/AAAA com calendário real válido (1900 a 2100).
 */
export const validarDataBr = (valor, obrigatorio = false) => {
  if (!valor || String(valor).trim().length === 0) return !obrigatorio;
  const str = String(valor).trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;

  const [diaStr, mesStr, anoStr] = str.split("/");
  const dia = parseInt(diaStr, 10);
  const mes = parseInt(mesStr, 10);
  const ano = parseInt(anoStr, 10);

  if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return false;
  if (mes < 1 || mes > 12) return false;
  if (ano < 1900 || ano > 2100) return false;

  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return dia >= 1 && dia <= diasNoMes;
};

/**
 * Converte ISO (YYYY-MM-DD...) ou string numérica para exibição DD/MM/AAAA.
 */
export const formatarDataParaExibicao = (valor) => {
  if (!valor) return "";
  const str = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const dataApenas = str.split("T")[0];
    const [ano, mes, dia] = dataApenas.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return aplicarMascaraData(str);
};

/**
 * Converte DD/MM/AAAA para YYYY-MM-DD.
 */
export const converterDataBrParaIso = (valor) => {
  const str = String(valor || "").trim();
  if (!str) return null;
  const partes = str.split("/");
  if (partes.length !== 3) return null;
  return `${partes[2]}-${partes[1].padStart(2, "0")}-${partes[0].padStart(2, "0")}`;
};

/**
 * Soma uma quantidade de dias corridos a uma data DD/MM/AAAA usando UTC (imune a fuso/horário de verão).
 */
export const somarDiasDataBr = (dataBr, dias) => {
  if (!validarDataBr(dataBr, true)) return null;
  const qtdDias = parseInt(String(dias), 10);
  if (!Number.isInteger(qtdDias)) return null;

  const [dia, mes, ano] = String(dataBr).trim().split("/").map(Number);
  const dataUtc = new Date(Date.UTC(ano, mes - 1, dia + qtdDias));

  const novoAno = dataUtc.getUTCFullYear();
  if (novoAno < 1900 || novoAno > 2100) return null;

  const novoMes = String(dataUtc.getUTCMonth() + 1).padStart(2, "0");
  const novoDia = String(dataUtc.getUTCDate()).padStart(2, "0");
  return `${novoDia}/${novoMes}/${novoAno}`;
};

/**
 * Calcula a diferença em dias corridos entre duas datas DD/MM/AAAA (alvo - base).
 */
export const calcularDiferencaDiasBr = (dataBaseBr, dataAlvoBr) => {
  if (!validarDataBr(dataBaseBr, true) || !validarDataBr(dataAlvoBr, true)) {
    return null;
  }
  const [d1, m1, a1] = String(dataBaseBr).trim().split("/").map(Number);
  const [d2, m2, a2] = String(dataAlvoBr).trim().split("/").map(Number);
  const utc1 = Date.UTC(a1, m1 - 1, d1);
  const utc2 = Date.UTC(a2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

/**
 * Resolve qual data base usar para somar dias (prioriza o prazo original da obra, com fallback para início).
 */
export const resolverDataBasePrazo = ({ dataConclusaoBase, dataInicio }) => {
  if (validarDataBr(dataConclusaoBase, true)) return dataConclusaoBase.trim();
  if (validarDataBr(dataInicio, true)) return dataInicio.trim();
  return "";
};

/**
 * Calcula o novo estado de diasAdicionados e dataConclusao quando o usuário digita uma quantidade de dias.
 */
export const calcularEstadoAoAlterarDias = (
  textoDias,
  { dataConclusaoBase, dataConclusaoAtual = "", dataInicio = "" } = {},
) => {
  const diasLimpos = sanitizarEntradaDias(textoDias);
  const baseEfetiva = resolverDataBasePrazo({ dataConclusaoBase, dataInicio });

  if (!diasLimpos) {
    return {
      diasAdicionados: "",
      dataConclusao: validarDataBr(dataConclusaoBase, true)
        ? dataConclusaoBase.trim()
        : dataConclusaoAtual,
      dataBaseUsada: baseEfetiva,
    };
  }

  if (!baseEfetiva) {
    return {
      diasAdicionados: diasLimpos,
      dataConclusao: dataConclusaoAtual,
      dataBaseUsada: "",
    };
  }

  const novaData = somarDiasDataBr(baseEfetiva, Number(diasLimpos));
  return {
    diasAdicionados: diasLimpos,
    dataConclusao: novaData || dataConclusaoAtual || baseEfetiva,
    dataBaseUsada: baseEfetiva,
  };
};

/**
 * Calcula o novo estado ao tocar em uma opção padrão (30, 90, 100, 180 dias).
 * Tocar novamente na opção já ativa remove o acréscimo e restaura o prazo base.
 */
export const calcularEstadoAoSelecionarPresetDias = (
  diasPreset,
  {
    diasAdicionadosAtual = "",
    dataConclusaoBase = "",
    dataConclusaoAtual = "",
    dataInicio = "",
  } = {},
) => {
  const valorPresetStr = String(diasPreset);
  const novoTextoDias =
    String(diasAdicionadosAtual) === valorPresetStr ? "" : valorPresetStr;

  return calcularEstadoAoAlterarDias(novoTextoDias, {
    dataConclusaoBase,
    dataConclusaoAtual,
    dataInicio,
  });
};

/**
 * Sincroniza diasAdicionados quando o usuário edita manualmente o campo Data de conclusão.
 */
export const calcularEstadoAoEditarDataManual = (
  textoData,
  { dataConclusaoBase = "" } = {},
) => {
  const dataMascarada = aplicarMascaraData(textoData);

  if (!validarDataBr(dataMascarada, true)) {
    return {
      dataConclusao: dataMascarada,
      diasAdicionados: "",
      novaDataBase: dataConclusaoBase,
    };
  }

  if (validarDataBr(dataConclusaoBase, true)) {
    const diff = calcularDiferencaDiasBr(dataConclusaoBase, dataMascarada);
    return {
      dataConclusao: dataMascarada,
      diasAdicionados:
        diff !== null && diff > 0 && diff <= 9999 ? String(diff) : "",
      novaDataBase: dataConclusaoBase,
    };
  }

  return {
    dataConclusao: dataMascarada,
    diasAdicionados: "",
    novaDataBase: dataMascarada,
  };
};
