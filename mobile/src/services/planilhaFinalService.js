import { Platform, Linking } from "react-native";
import { API_URL, requisicao } from "./api";
import { obterToken } from "./storage";
import { construirUrlDownloadPlanilhaFinal } from "../utils/planilhaFinalUtils";

/**
 * Obtém os dados estruturados da planilha final de medição (etapas, serviços e métricas calculadas).
 * Útil para a tela de visualização e conferência.
 *
 * @param {string|number} obraId
 * @param {string|number} [cicloId]
 * @returns {Promise<Object>}
 */
export async function obterPlanilhaFinal(obraId, cicloId) {
  const query = cicloId ? `?cicloId=${encodeURIComponent(cicloId)}` : "";
  return requisicao(`/obras/${obraId}/planilha-final${query}`, {
    method: "GET",
  });
}

/**
 * Constrói a URL para download direto da planilha final (.xlsx)
 *
 * @param {string|number} obraId
 * @param {string|number} [cicloId]
 * @param {string} [token]
 * @returns {string}
 */
export function obterUrlDownloadPlanilhaFinal(obraId, cicloId, token) {
  return construirUrlDownloadPlanilhaFinal(API_URL, obraId, cicloId, token);
}

/**
 * Dispara o download da planilha final (.xlsx) no dispositivo ou navegador.
 *
 * @param {string|number} obraId
 * @param {string|number} [cicloId]
 * @param {string} [nomeObra]
 * @returns {Promise<boolean>}
 */
export async function baixarPlanilhaFinal(obraId, cicloId, nomeObra = "Obra") {
  const token = await obterToken();
  const downloadUrl = obterUrlDownloadPlanilhaFinal(obraId, cicloId, token);

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.document) {
      try {
        const resp = await fetch(downloadUrl, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) {
          throw new Error(`Falha no download (${resp.status})`);
        }
        const blob = await resp.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = blobUrl;
        const nomeArquivoSanitizado = (nomeObra || "Obra")
          .replace(/[^a-zA-Z0-9_\-]/g, "_")
          .substring(0, 40);
        link.download = `Planilha_Final_${nomeArquivoSanitizado}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
        return true;
      } catch (err) {
        // Fallback para navegação direta caso fetch/blob falhe
        window.location.href = downloadUrl;
        return true;
      }
    }
  }

  // Mobile (Android / iOS)
  const suportado = await Linking.canOpenURL(downloadUrl).catch(() => true);
  if (suportado) {
    await Linking.openURL(downloadUrl);
    return true;
  }

  throw new Error("Não foi possível abrir o link para download da planilha.");
}

export default {
  obterPlanilhaFinal,
  obterUrlDownloadPlanilhaFinal,
  baixarPlanilhaFinal,
};
