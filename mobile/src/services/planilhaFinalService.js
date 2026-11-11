import { Platform, Linking } from "react-native";
import { API_URL, requisicao } from "./api";
import { obterToken } from "./storage";
import { construirUrlDownloadPlanilhaFinal } from "../utils/planilhaFinalUtils";
import { obterEstruturaObraLocal } from "../repositories/obraLocalRepository";
import { listarMedicoesCicloLocal } from "../repositories/medicaoLocalRepository";

/**
 * Monta os dados da planilha final a partir do SQLite local quando sem conexão (Offline-First).
 */
async function gerarDadosPlanilhaFinalLocal(obraId, cicloId) {
  const estrutura = await obterEstruturaObraLocal(obraId, cicloId);
  if (!estrutura || !Array.isArray(estrutura.etapas)) return null;

  const cicloAlvoId = cicloId || estrutura.ciclo_ativo?.id;
  const medicoesMap = new Map();

  if (cicloAlvoId) {
    const medCiclo = await listarMedicoesCicloLocal(cicloAlvoId);
    for (const m of medCiclo?.medicoes || []) {
      medicoesMap.set(String(m.servico_id), m);
    }
  }

  let totalOrcadoObra = 0;
  let totalPeriodoObra = 0;
  let totalAcumuladoObra = 0;

  const etapasFormatadas = estrutura.etapas.map((etapa) => {
    let totalOrcadoEtapa = 0;
    let totalPeriodoEtapa = 0;
    let totalAcumuladoEtapa = 0;

    const servicosFormatados = (etapa.servicos || []).map((s) => {
      const m = medicoesMap.get(String(s.id));
      const qtdOrcada = Number(s.quantidade_orcada || 0);
      const precoUnit = Number(s.preco_unitario || 0);
      const precoTotal = Number(s.preco_total_orcado || qtdOrcada * precoUnit);

      const qtdPeriodo = Number(m?.quantidade_medida_periodo || 0);
      const valPeriodo = Number(m?.valor_medido_periodo || qtdPeriodo * precoUnit);
      const qtdAcum = Number(m?.quantidade_acumulada_atual || 0);
      const valAcum = Number(
        m?.valor_acumulado_atual ?? s.valor_acumulado_atual ?? 0
      );
      const saldoQtd = Number(
        m?.saldo_quantidade ?? Math.max(0, qtdOrcada - qtdAcum)
      );
      const saldoVal = Number((precoTotal - valAcum).toFixed(2));
      const pct = Number(
        m?.percentual_execucao ?? s.percentual_execucao ?? 0
      );

      totalOrcadoEtapa += precoTotal;
      totalPeriodoEtapa += valPeriodo;
      totalAcumuladoEtapa += valAcum;

      return {
        id: s.id,
        codigo_servico: s.codigo_servico,
        descricao: s.descricao,
        unidade_medida: s.unidade_medida,
        quantidade_orcada: qtdOrcada,
        preco_unitario: precoUnit,
        preco_total: precoTotal,
        quantidade_periodo: qtdPeriodo,
        valor_periodo: valPeriodo,
        quantidade_acumulada: qtdAcum,
        valor_acumulado: valAcum,
        saldo_quantidade: saldoQtd,
        saldo_valor: saldoVal,
        percentual_execucao: pct,
      };
    });

    totalOrcadoObra += totalOrcadoEtapa;
    totalPeriodoObra += totalPeriodoEtapa;
    totalAcumuladoObra += totalAcumuladoEtapa;

    return {
      id: etapa.id,
      nome: etapa.nome,
      ordem: etapa.ordem,
      total_orcado: totalOrcadoEtapa,
      total_periodo: totalPeriodoEtapa,
      total_acumulado: totalAcumuladoEtapa,
      total_saldo: totalOrcadoEtapa - totalAcumuladoEtapa,
      percentual_execucao:
        totalOrcadoEtapa > 0
          ? (totalAcumuladoEtapa / totalOrcadoEtapa) * 100
          : 0,
      servicos: servicosFormatados,
    };
  });

  return {
    obra_id: obraId,
    nome_obra: estrutura.nome,
    etapas: etapasFormatadas,
    totais: {
      total_orcado: totalOrcadoObra,
      total_periodo: totalPeriodoObra,
      total_acumulado: totalAcumuladoObra,
      total_saldo: totalOrcadoObra - totalAcumuladoObra,
      percentual_execucao:
        totalOrcadoObra > 0
          ? (totalAcumuladoObra / totalOrcadoObra) * 100
          : 0,
    },
  };
}

/**
 * Obtém os dados estruturados da planilha final de medição (etapas, serviços e métricas calculadas).
 * Útil para a tela de visualização e conferência (funciona online e offline).
 *
 * @param {string|number} obraId
 * @param {string|number} [cicloId]
 * @returns {Promise<Object>}
 */
export async function obterPlanilhaFinal(obraId, cicloId) {
  try {
    const local = await gerarDadosPlanilhaFinalLocal(obraId, cicloId);
    if (local && local.etapas && local.etapas.length > 0) {
      return local;
    }
  } catch {
    // Continua para tentativa remota
  }

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
