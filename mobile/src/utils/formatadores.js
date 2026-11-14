/**
 * Utilitários de formatação de datas e tempos para o aplicativo.
 */

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
 * Formata o tempo adicionado (dias ou meses) para o histórico de conclusão.
 * @param {object} item Objeto do histórico com tempo_adicionado ou dias_adicionados.
 * @returns {string} Texto formatado (ex: "3 meses" ou "45 dias").
 */
export const formatarTempoAdicionado = (item) => {
  if (!item) return "0 dias";
  if (item.tempo_adicionado) return item.tempo_adicionado;
  const dias = Number(item.dias_adicionados);
  if (!dias && dias !== 0) return "0 dias";
  if (dias >= 30 && dias % 30 === 0) {
    const meses = Math.floor(dias / 30);
    return `${meses} ${meses === 1 ? "mês" : "meses"}`;
  }
  return `${dias} ${dias === 1 ? "dia" : "dias"}`;
};
