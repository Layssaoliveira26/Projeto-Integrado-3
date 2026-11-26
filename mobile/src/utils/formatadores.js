import { padronizarUnidadeMedida } from "./unidadesMedida.js";

/**
 * Utilitários de formatação de datas, tempos e unidades para o aplicativo.
 */

export const formatarUnidadeMedida = padronizarUnidadeMedida;

/**
 * Formata uma data (ISO YYYY-MM-DD ou Date) para o padrão brasileiro DD/MM/AAAA.
 * @param {string|Date} valor 
 * @returns {string} Data formatada ou mensagem de fallback.
 */
export const formatarData = (valor) => {
  if (!valor) return "Não informada";
  if (valor instanceof Date && !isNaN(valor.getTime())) {
    const dia = String(valor.getDate()).padStart(2, "0");
    const mes = String(valor.getMonth() + 1).padStart(2, "0");
    const ano = valor.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
  const str = String(valor).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const dataApenas = str.split("T")[0];
    const [ano, mes, dia] = dataApenas.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return str;
};

/**
 * Formata um timestamp para exibição com hora (DD/MM/AAAA às HH:MM).
 * @param {string|Date} valor 
 * @returns {string|null} Data e hora formatadas ou null.
 */
export const formatarDataHora = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  if (isNaN(d.getTime())) return String(valor);
  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
};

/**
 * Extrai a variação numérica em dias de um registro do histórico de prazo.
 * @param {object} item Objeto do histórico com dias_adicionados ou tempo_adicionado.
 * @returns {number} Quantidade de dias (positiva para prorrogação, negativa para redução).
 */
export const obterDeltaDiasHistorico = (item) => {
  if (!item) return 0;
  if (item.dias_adicionados !== undefined && item.dias_adicionados !== null) {
    const num = Number(item.dias_adicionados);
    if (Number.isFinite(num)) return Math.trunc(num);
  }
  if (typeof item.tempo_adicionado === "string") {
    const match = item.tempo_adicionado.match(/-?\d+/);
    if (match) return parseInt(match[0], 10);
  }
  return 0;
};

/**
 * Formata a variação de prazo em dias com sinal (+90 dias, -15 dias, 0 dias).
 * @param {number} dias
 * @returns {string}
 */
export const formatarDeltaPrazo = (dias) => {
  const num = Number.isFinite(Number(dias)) ? Math.trunc(Number(dias)) : 0;
  if (num === 0) return "0 dias";
  const abs = Math.abs(num);
  const unidade = abs === 1 ? "dia" : "dias";
  return `${num > 0 ? "+" : "-"}${abs} ${unidade}`;
};

/**
 * Consolida a quantidade de alterações e o saldo total de dias do histórico de prazo.
 * @param {Array<object>} lista
 * @returns {{ totalAlteracoes: number, saldoDias: number }}
 */
export const resumirHistoricoConclusao = (lista = []) => {
  if (!Array.isArray(lista) || lista.length === 0) {
    return { totalAlteracoes: 0, saldoDias: 0 };
  }
  const saldoDias = lista.reduce(
    (acc, item) => acc + obterDeltaDiasHistorico(item),
    0,
  );
  return {
    totalAlteracoes: lista.length,
    saldoDias,
  };
};

/**
 * Formata o tempo adicionado (dias ou meses) para o histórico de conclusão.
 * @param {object} item Objeto do histórico com tempo_adicionado ou dias_adicionados.
 * @returns {string} Texto formatado (ex: "+90 dias", "-15 dias").
 */
export const formatarTempoAdicionado = (item) => {
  if (!item) return "0 dias";
  const dias = obterDeltaDiasHistorico(item);
  if (dias !== 0) return formatarDeltaPrazo(dias);
  if (item.tempo_adicionado) return item.tempo_adicionado;
  return "0 dias";
};
