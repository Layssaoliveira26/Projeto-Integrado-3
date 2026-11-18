import React, { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";

import { cores, fontes, shadows, moderateScale, rem } from "../styles/theme";
import { analisarPlanilha, formatarTamanho } from "../utils/planilhaParser";
import ModalConfirmarExclusaoArquivo from "./ModalConfirmarExclusaoArquivo";
import ModalErroPlanilha from "./ModalErroPlanilha";

function IconePlanilhaTabela({ size = 28, color = "#0D6579" }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="3"
        stroke={color}
        strokeWidth="2.2"
      />
      <Path d="M3 9.5H21" stroke={color} strokeWidth="2.2" />
      <Path d="M9.5 9.5V21" stroke={color} strokeWidth="2.2" />
    </Svg>
  );
}

export default function UploadPlanilhaCard({
  onArquivoChange = () => {},
  arquivoInicial = null,
  exibirBadgeInfo = true,
}) {
  const [arquivo, setArquivo] = useState(arquivoInicial);
  const [progresso, setProgresso] = useState(arquivoInicial ? 100 : 0);
  const [modalErroVisivel, setModalErroVisivel] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");
  const [modalExcluirVisivel, setModalExcluirVisivel] = useState(false);

  const intervaloProgressoRef = useRef(null);

  const limparProgresso = () => {
    if (intervaloProgressoRef.current) {
      clearInterval(intervaloProgressoRef.current);
      intervaloProgressoRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      limparProgresso();
    };
  }, []);

  const handleSelecionarArquivo = async () => {
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/octet-stream",
          "*/*",
        ],
        copyToCacheDirectory: false,
      });

      if (pickerResult.canceled) {
        return;
      }

      const asset = pickerResult.assets && pickerResult.assets[0];
      if (!asset || !asset.uri) {
        return;
      }

      limparProgresso();
      setProgresso(15);
      setArquivo({
        uri: asset.uri,
        name: asset.name,
        sizeFormatted: formatarTamanho(asset.size),
        linhas: "...",
        colunas: "...",
      });

      intervaloProgressoRef.current = setInterval(() => {
        setProgresso((prev) => {
          if (prev >= 87) {
            limparProgresso();
            return 87;
          }
          return prev + 24;
        });
      }, 180);

      const resultadoAnalise = await analisarPlanilha(
        asset.uri,
        asset.name,
        asset,
      );

      limparProgresso();

      const dadosArquivo = {
        uri: asset.uri,
        name: asset.name,
        sizeFormatted: formatarTamanho(asset.size),
        linhas: resultadoAnalise.totalLinhas,
        colunas: resultadoAnalise.totalColunas,
        payload: resultadoAnalise.payload,
      };

      setArquivo(dadosArquivo);

      setTimeout(() => {
        setProgresso(100);
        onArquivoChange(dadosArquivo);
      }, 250);
    } catch (error) {
      console.error("Erro ao processar planilha no UploadPlanilhaCard:", error);
      limparProgresso();
      setArquivo(null);
      setProgresso(0);
      onArquivoChange(null);

      const msg =
        error.code === "INCOMPATIVEL" || error.message?.includes("incompatível")
          ? "O arquivo importado é incompatível para mapeamento automático.\nBaixe nosso modelo e tente novamente."
          : error.message ||
            "Não foi possível processar o arquivo selecionado.";

      setMensagemErro(msg);
      setModalErroVisivel(true);
    }
  };

  const handleAbrirConfirmacaoExclusao = () => {
    setModalExcluirVisivel(true);
  };

  const handleConfirmarExclusao = () => {
    limparProgresso();
    setArquivo(null);
    setProgresso(0);
    setModalExcluirVisivel(false);
    onArquivoChange(null);
  };

  const handleCancelarExclusao = () => {
    setModalExcluirVisivel(false);
  };

  return (
    <View style={styles.container}>
      {!arquivo && (
        <TouchableOpacity
          style={styles.cardUpload}
          onPress={handleSelecionarArquivo}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Selecionar arquivo da planilha"
        >
          <Feather
            name="folder"
            size={moderateScale(52)}
            color={cores.azulPetroleo || "#0D6579"}
            style={styles.iconePasta}
          />
          <Text style={styles.tituloUpload}>Selecione o arquivo</Text>
          <Text style={styles.subtituloUpload}>
            Toque para escolher do dispositivo
          </Text>
        </TouchableOpacity>
      )}

      {arquivo && (
        <>
          <View
            style={[
              styles.cardArquivo,
              progresso === 100 && styles.cardArquivoConcluido,
            ]}
          >
            <TouchableOpacity
              style={styles.botaoLixeira}
              onPress={handleAbrirConfirmacaoExclusao}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Excluir arquivo importado"
            >
              <Feather
                name="trash-2"
                size={moderateScale(22)}
                color={cores.azulPetroleo || "#0D6579"}
              />
            </TouchableOpacity>

            <View style={styles.linhaTopoArquivo}>
              <View style={styles.iconeStatusWrapper}>
                {progresso === 100 ? (
                  <Feather
                    name="check"
                    size={moderateScale(28)}
                    color={cores.azulPetroleo || "#0D6579"}
                    strokeWidth={3.5}
                  />
                ) : (
                  <IconePlanilhaTabela
                    size={moderateScale(28)}
                    color={cores.azulPetroleo || "#0D6579"}
                  />
                )}
              </View>

              <View style={styles.infoArquivoWrapper}>
                <Text
                  style={styles.nomeArquivo}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {arquivo.name}
                </Text>
                <Text style={styles.detalhesArquivo}>
                  {arquivo.linhas} linhas - {arquivo.colunas} colunas -{" "}
                  {arquivo.sizeFormatted}
                </Text>
              </View>
            </View>

            <View style={styles.barraProgressoTrack}>
              <LinearGradient
                colors={["#65F09B", "#09D1C7", "#0D6579"]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[
                  styles.barraProgressoFill,
                  { width: `${Math.min(progresso, 100)}%` },
                ]}
              />
            </View>

            <Text style={styles.textoStatusArquivo}>
              {progresso === 100
                ? "Importação de arquivo concluída."
                : `Importação de arquivo em ${progresso}%`}
            </Text>
          </View>

          {exibirBadgeInfo && (
            <View style={styles.badgeInfo}>
              <Text style={styles.textoBadgeInfo}>
                {progresso === 100
                  ? "Importação concluída com sucesso. Clique em “Mapear” para visualizar os serviços e registrar medições da obra."
                  : "O arquivo está sendo importado. Aguarde um momento para liberação do mapeamento."}
              </Text>
            </View>
          )}
        </>
      )}

      <ModalConfirmarExclusaoArquivo
        visible={modalExcluirVisivel}
        titulo="Excluir arquivo"
        mensagem="Tem certeza que deseja excluir a planilha? Esta ação será permanente."
        textoConfirmar="Excluir"
        textoCancelar="Cancelamento"
        onConfirmar={handleConfirmarExclusao}
        onCancelar={handleCancelarExclusao}
      />

      <ModalErroPlanilha
        visible={modalErroVisivel}
        titulo="Erro!"
        mensagem={mensagemErro}
        onConfirmar={() => setModalErroVisivel(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
  },
  cardUpload: {
    backgroundColor: cores.fundoCardMetric || "#EAE7E2",
    borderRadius: moderateScale(20),
    minHeight: moderateScale(220),
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    paddingVertical: moderateScale(30),
    marginBottom: moderateScale(20),
  },
  iconePasta: {
    marginBottom: moderateScale(12),
  },
  tituloUpload: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.92),
    color: cores.azulPetroleo || "#0D6579",
    marginBottom: moderateScale(4),
    textAlign: "center",
  },
  subtituloUpload: {
    fontFamily: fontes.regular,
    fontSize: rem(0.82),
    color: cores.textoSecundario || "#79A5AF",
    textAlign: "center",
  },
  cardArquivo: {
    position: "relative",
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(18),
    padding: moderateScale(18),
    ...shadows.padrao,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  cardArquivoConcluido: {
    backgroundColor: "#E0F7F3",
  },

  linhaTopoArquivo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: moderateScale(14),
  },
  iconeStatusWrapper: {
    width: moderateScale(34),
    alignItems: "center",
    justifyContent: "center",
    marginRight: moderateScale(10),
  },
  infoArquivoWrapper: {
    flex: 1,
    justifyContent: "center",
    paddingRight: moderateScale(36),
  },
  nomeArquivo: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.82),
    color: "#223B59",
    marginBottom: moderateScale(2),
  },
  detalhesArquivo: {
    fontFamily: fontes.regular,
    fontSize: rem(0.76),
    color: "#0D6579",
  },
  botaoLixeira: {
    position: "absolute",
    top: moderateScale(14),
    right: moderateScale(14),
    padding: moderateScale(4),
    zIndex: 10,
  },
  barraProgressoTrack: {
    height: moderateScale(8),
    backgroundColor: "#E8ECEF",
    borderRadius: moderateScale(4),
    overflow: "hidden",
    marginBottom: moderateScale(8),
  },
  barraProgressoFill: {
    height: "100%",
    borderRadius: moderateScale(4),
  },
  textoStatusArquivo: {
    fontFamily: fontes.media,
    fontSize: rem(0.74),
    color: "#0D6579",
  },
  badgeInfo: {
    backgroundColor: "#E0EAE7",
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(16),
    paddingHorizontal: moderateScale(18),
    marginTop: moderateScale(14),
    marginBottom: moderateScale(24),
  },
  textoBadgeInfo: {
    fontFamily: fontes.media,
    fontSize: rem(0.7),
    lineHeight: rem(1.28),
    color: "#0D6579",
  },
});
