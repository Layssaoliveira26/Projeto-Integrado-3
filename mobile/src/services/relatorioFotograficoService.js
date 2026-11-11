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
 * - Agrupamento por serviço/etapa
 * - Foto, descrição do serviço, data/hora e coordenadas 
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

let fs = null;
try {
  fs = require("expo-file-system/legacy");
} catch {
  try {
    fs = require("expo-file-system");
  } catch { }
}

async function converterFotoParaBase64(uri) {
  if (!uri || typeof uri !== "string") return uri;
  if (
    uri.startsWith("data:") ||
    uri.startsWith("http://") ||
    uri.startsWith("https://")
  ) {
    return uri;
  }
  if (!fs || !fs.readAsStringAsync) return uri;

  try {
    const base64 = await fs.readAsStringAsync(uri, {
      encoding: fs.EncodingType?.Base64 || "base64",
    });
    return `data:image/jpeg;base64,${base64}`;
  } catch (err) {
    console.warn("Aviso ao converter foto para base64:", err?.message || err);
    return uri;
  }
}

/**
 * Remove relatórios fotográficos anteriores do armazenamento local e limpa
 * o arquivo temporário inicial gerado pelo expo-print para evitar acúmulo desnecessário.
 */
export async function limparRelatoriosTemporariosAnteriores(arquivoAtualNome, tempPrintUri = null) {
  if (!fs) return;
  try {
    // 1. Remove arquivo temporário inicial criado pelo printToFileAsync se for diferente do destino final
    if (tempPrintUri && fs.deleteAsync) {
      try {
        await fs.deleteAsync(tempPrintUri, { idempotent: true });
      } catch {}
    }

    // 2. Remove PDFs anteriores gerados para relatórios fotográficos no dispositivo
    const pastaDestino = fs.documentDirectory || fs.cacheDirectory;
    if (pastaDestino && fs.readDirectoryAsync && fs.deleteAsync) {
      const arquivos = await fs.readDirectoryAsync(pastaDestino);
      const relatoriosAntigos = (arquivos || []).filter(
        (f) =>
          typeof f === "string" &&
          f.startsWith("Relatorio_Fotografico_") &&
          f.endsWith(".pdf") &&
          f !== arquivoAtualNome
      );
      for (const arquivo of relatoriosAntigos) {
        try {
          await fs.deleteAsync(`${pastaDestino}${arquivo}`, { idempotent: true });
        } catch {}
      }
    }
  } catch (err) {
    console.warn("Aviso na limpeza de relatórios anteriores:", err?.message || err);
  }
}

export async function exportarRelatorioFotograficoPdf(dadosRelatorio) {
  try {
    const etapasTratadas = await Promise.all(
      (dadosRelatorio.etapas || []).map(async (etapa) => {
        const servicosTratados = await Promise.all(
          (etapa.servicos || []).map(async (servico) => {
            const fotosTratadas = await Promise.all(
              (servico.fotos || []).map(async (foto) => {
                const uriEmbutida = await converterFotoParaBase64(foto.uri);
                return {
                  ...foto,
                  uri: uriEmbutida,
                };
              })
            );
            return {
              ...servico,
              fotos: fotosTratadas,
            };
          })
        );
        return {
          ...etapa,
          servicos: servicosTratados,
        };
      })
    );

    const dadosProntos = {
      ...dadosRelatorio,
      etapas: etapasTratadas,
    };

    const html = gerarHtmlRelatorioFotografico(dadosProntos);

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

    // ─── AMBIENTE MOBILE ─────────────────────────────────────
    const nomeArquivo = `Relatorio_Fotografico_Ciclo_${String(
      dadosRelatorio.numeroCiclo || 1
    ).padStart(2, "0")}_${Date.now()}.pdf`;

    // Gera o arquivo PDF 
    const printResult = await Print.printToFileAsync({
      html,
      base64: true,
    });

    let uriFinal = printResult.uri;

    if (fs) {
      const pastaDestino = fs.documentDirectory || fs.cacheDirectory;
      if (pastaDestino) {
        const destinoUri = `${pastaDestino}${nomeArquivo}`;
        try {
          if (printResult.base64) {
            await fs.writeAsStringAsync(destinoUri, printResult.base64, {
              encoding: fs.EncodingType?.Base64 || "base64",
            });
            uriFinal = destinoUri;
          } else if (printResult.uri) {
            await fs.copyAsync({ from: printResult.uri, to: destinoUri });
            uriFinal = destinoUri;
          }
        } catch (fsErr) {
          console.warn("Aviso ao persistir PDF no storage seguro:", fsErr);
        }
      }
    }

    // Gerenciamento de arquivos PDF temporários: remove relatórios anteriores
    // e o arquivo temporário do printToFileAsync prevenindo acúmulo de espaço no dispositivo
    await limparRelatoriosTemporariosAnteriores(
      nomeArquivo,
      printResult.uri !== uriFinal ? printResult.uri : null
    );

    // Registra histórico na tabela SQLite relatorios_fotograficos
    try {
      const relatorioId = `rel_${Date.now()}_${Math.random()
        .toString(36)
        .substring(2, 7)}`;
      await salvarRegistroRelatorio({
        id: relatorioId,
        obra_id: dadosRelatorio.obraId,
        ciclo_id: dadosRelatorio.cicloId,
        caminho_arquivo: uriFinal,
        formato: "pdf",
      });
    } catch (saveErr) {
      console.warn("Aviso ao salvar histórico do relatório no SQLite:", saveErr);
    }

    // Abre diálogo nativo de compartilhamento
    const sharingDisponivel = await Sharing.isAvailableAsync();
    if (sharingDisponivel) {
      try {
        await Sharing.shareAsync(uriFinal, {
          mimeType: "application/pdf",
          dialogTitle: `Relatório Fotográfico - Ciclo ${dadosRelatorio.numeroCiclo}`,
          UTI: "com.adobe.pdf",
        });
      } catch (shareErr) {
        console.warn("Aviso no diálogo de compartilhamento:", shareErr);
        Alert.alert(
          "Relatório Gerado",
          `O relatório em PDF foi gerado e salvo com sucesso em seu dispositivo:\n\n${uriFinal}`
        );
      }
    } else {
      Alert.alert(
        "Relatório Gerado",
        `O arquivo PDF foi salvo com sucesso em:\n${uriFinal}`
      );
    }

    return {
      sucesso: true,
      uri: uriFinal,
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
  limparRelatoriosTemporariosAnteriores,
};
