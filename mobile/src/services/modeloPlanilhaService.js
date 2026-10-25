import { Platform, Alert } from "react-native";
import * as Sharing from "expo-sharing";
import { MODELO_PLANILHA_BASE64 } from "../utils/modeloPlanilhaBase64";

let ExpoFS = null;
let LegacyFS = null;
try {
  LegacyFS = require("expo-file-system/legacy");
} catch {}
try {
  ExpoFS = require("expo-file-system");
} catch {}

const fs = LegacyFS || ExpoFS;

const NOME_ARQUIVO_MODELO = "modelo_planilha_obras.xlsx";
const MIME_TYPE_EXCEL =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";


export async function baixarModeloPlanilha() {
  try {
    // ─── AMBIENTE WEB ──────────────────────────────────────────────────────────
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && typeof document !== "undefined") {
        const byteCharacters = atob(MODELO_PLANILHA_BASE64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: MIME_TYPE_EXCEL });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = NOME_ARQUIVO_MODELO;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        return { sucesso: true, mensagem: "Download iniciado no navegador." };
      }
    }

    // ─── AMBIENTE MOBILE (Android / iOS) ───────────────────────────────────────
    if (!fs) {
      throw new Error("Sistema de arquivos não disponível no dispositivo.");
    }

    const diretorioDestino =
      fs.cacheDirectory || fs.documentDirectory || "";
    const caminhoDestino = `${diretorioDestino}${NOME_ARQUIVO_MODELO}`;

    // 1. Grava o arquivo binário .xlsx a partir do Base64 embutido
    const encoding = fs.EncodingType?.Base64 || "base64";
    await fs.writeAsStringAsync(caminhoDestino, MODELO_PLANILHA_BASE64, {
      encoding,
    });

    // 2. Abre o menu nativo de compartilhamento / salvamento do dispositivo
    const sharingDisponivel = await Sharing.isAvailableAsync();

    if (sharingDisponivel) {
      await Sharing.shareAsync(caminhoDestino, {
        mimeType: MIME_TYPE_EXCEL,
        dialogTitle: "Baixar Modelo de Planilha Padrão",
        UTI: "com.microsoft.excel.xlsx",
      });

      return {
        sucesso: true,
        caminho: caminhoDestino,
        mensagem: "Modelo disponibilizado com sucesso!",
      };
    } else {
      Alert.alert(
        "Modelo Pronto",
        `O arquivo do modelo foi salvo em:\n${caminhoDestino}`
      );
      return {
        sucesso: true,
        caminho: caminhoDestino,
        mensagem: "Arquivo salvo no armazenamento local.",
      };
    }
  } catch (error) {
    console.error("Erro ao baixar modelo de planilha:", error);
    const msg =
      error.message ||
      "Ocorreu um erro ao tentar baixar o modelo padrão de planilha.";
    throw new Error(msg);
  }
}
