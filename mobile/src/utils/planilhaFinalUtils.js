/**
 * Utilitários e constantes para a Planilha Final de Medição (US22)
 */

export const COLUNAS_PLANILHA_FINAL = [
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

/**
 * Constrói a URL para download da planilha final (.xlsx)
 *
 * @param {string} apiUrl - URL base da API (ex: http://localhost:3000)
 * @param {string|number} obraId - ID da obra
 * @param {string|number} [cicloId] - ID do ciclo de medição
 * @param {string} [token] - Token JWT para autenticação no download
 * @returns {string} URL completa de download
 */
export function construirUrlDownloadPlanilhaFinal(apiUrl, obraId, cicloId, token) {
  const base = (apiUrl || "http://localhost:3000").replace(/\/$/, "");
  const params = [];
  if (token) params.push(`token=${encodeURIComponent(token)}`);
  if (cicloId) params.push(`cicloId=${encodeURIComponent(cicloId)}`);
  const queryString = params.length > 0 ? `?${params.join("&")}` : "";
  return `${base}/obras/${obraId}/planilha-final/download${queryString}`;
}
