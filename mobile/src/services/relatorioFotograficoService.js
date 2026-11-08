// mobile/src/services/relatorioFotograficoService.js
import { Platform, Alert } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { listarFotografiasPorObra } from "../repositories/fotografiaRepository";
import { salvarRegistroRelatorio } from "../repositories/relatorioFotograficoRepository";
import {
  formatarDataHora,
  formatarCoordenadas,
  agruparFotosPorEtapaEServico,
  gerarHtmlRelatorioFotografico,
} from "../utils/relatorioFotograficoUtils";

export {
  formatarDataHora,
  formatarCoordenadas,
  agruparFotosPorEtapaEServico,
  gerarHtmlRelatorioFotografico,
};

/**
 * Organiza e agrupa as fotografias do ciclo por Etapa e Serviço.
 * Atende aos requisitos:
 * - Agrupamento por serviço/etapa (RN12)
 * - Foto, descrição do serviço, data/hora e coordenadas (RN13 / Critérios de aceite)
 */
export async function obterDadosRelatorioFotografico({
  obraId,
  cicloId,
  dadosObra = null,
  numeroCiclo = 1,
  periodo = null,
}) {
  const fotosBrutas = await listarFotografiasPorObra(obraId, cicloId);
  const listaFotos = Array.isArray(fotosBrutas) ? fotosBrutas : [];

  const agrupamento = agruparFotosPorEtapaEServico({
    fotos: listaFotos,
    estruturaObra: dadosObra,
  });

  return {
    obraId: String(obraId),
    obraNome: dadosObra?.nome || "Acompanhamento da Obra",
    obraEndereco: dadosObra?.endereco || "",
    cicloId: String(cicloId),
    numeroCiclo: Number(numeroCiclo || 1),
    periodoTexto:
      periodo ||
      (dadosObra?.ciclo_ativo?.numero_ciclo === numeroCiclo
        ? `Ciclo ${String(numeroCiclo).padStart(2, "0")}`
        : `Ciclo ${String(numeroCiclo).padStart(2, "0")}`),
    dataEmissao: formatarDataHora(new Date().toISOString()),
    totalFotos: agrupamento.totalFotos,
    totalServicosComFotos: agrupamento.totalServicosComFotos,
    etapas: agrupamento.etapas,
  };
}

/**
 * Dispara a renderização e compartilhamento nativo do arquivo PDF (RNF12).
 */
export async function exportarRelatorioFotograficoPdf(dadosRelatorio) {
  try {
    const html = gerarHtmlRelatorioFotografico(dadosRelatorio);

    // ─── AMBIENTE WEB ────────────────────────────────────────────────────────
    if (Platform.OS === "web") {
      if (typeof window !== "undefined") {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.focus();
          setTimeout(() => {
            printWindow.print();
          }, 300);
          return { sucesso: true, mensagem: "Janela de impressão aberta." };
        }
      }
    }

    // ─── AMBIENTE MOBILE (Android / iOS) ─────────────────────────────────────
    const nomeArquivo = `Relatorio_Fotografico_Ciclo_${String(
      dadosRelatorio.numeroCiclo || 1
    ).padStart(2, "0")}_${Date.now()}.pdf`;

    const { uri } = await Print.printToFileAsync({
      html,
      base64: false,
    });

    // Registra histórico na tabela SQLite relatorios_fotograficos
    try {
      const relatorioId = `rel_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;
      await salvarRegistroRelatorio({
        id: relatorioId,
        obra_id: dadosRelatorio.obraId,
        ciclo_id: dadosRelatorio.cicloId,
        caminho_arquivo: uri,
        formato: "pdf",
      });
    } catch (saveErr) {
      console.warn("Aviso ao salvar histórico do relatório no SQLite:", saveErr);
    }

    // Abre diálogo nativo de compartilhamento
    const sharingDisponivel = await Sharing.isAvailableAsync();
    if (sharingDisponivel) {
      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Relatório Fotográfico - Ciclo ${dadosRelatorio.numeroCiclo}`,
        UTI: "com.adobe.pdf",
      });
    } else {
      Alert.alert(
        "Relatório Gerado",
        `O arquivo PDF foi salvo com sucesso em:\n${uri}`
      );
    }

    return {
      sucesso: true,
      uri,
      mensagem: "Relatório gerado e compartilhado com sucesso!",
    };
  } catch (error) {
    console.error("Erro ao gerar relatório fotográfico:", error);
    throw new Error(
      error?.message || "Não foi possível gerar o relatório fotográfico."
    );
  }
}

export default {
  formatarDataHora,
  formatarCoordenadas,
  agruparFotosPorEtapaEServico,
  obterDadosRelatorioFotografico,
  gerarHtmlRelatorioFotografico,
  exportarRelatorioFotograficoPdf,
};
