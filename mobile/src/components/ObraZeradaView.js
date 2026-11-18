import React, { useState, useRef, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Upload } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Svg, { Rect, Path } from "react-native-svg";
import * as DocumentPicker from "expo-document-picker";

import { baixarModeloPlanilha, importarPlanilhaBase } from "../services/api";
import { analisarPlanilha, formatarTamanho } from "../utils/planilhaParser";
import AlertTriangleGradient from "./AlertTriangleGradient";
import ModalConfirmarExclusaoArquivo from "./ModalConfirmarExclusaoArquivo";
import ModalErroPlanilha from "./ModalErroPlanilha";
import FeedbackModal from "./FeedbackModal";
import theme, { fontes, moderateScale } from "../styles/theme";

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

export default function ObraZeradaView({
  obraId,
  onMapeamentoSucesso,
  onMapearActionChange,
}) {
  const [arquivoUpload, setArquivoUpload] = useState(null);
  const [progressoUpload, setProgressoUpload] = useState(0);
  const [modalErroPlanilhaVisivel, setModalErroPlanilhaVisivel] =
    useState(false);
  const [mensagemErroPlanilhaUpload, setMensagemErroPlanilhaUpload] =
    useState("");
  const [modalExcluirArquivoVisivel, setModalExcluirArquivoVisivel] =
    useState(false);
  const [feedbackUploadModal, setFeedbackUploadModal] = useState({
    visible: false,
    variant: "loading",
    title: "",
    message: "",
  });

  const intervaloProgressoRef = useRef(null);

  const limparIntervaloProgresso = () => {
    if (intervaloProgressoRef.current) {
      clearInterval(intervaloProgressoRef.current);
      intervaloProgressoRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      limparIntervaloProgresso();
    };
  }, []);

  const handleSelecionarArquivoPlanilha = async () => {
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

      limparIntervaloProgresso();
      setProgressoUpload(15);
      setArquivoUpload({
        uri: asset.uri,
        name: asset.name,
        sizeFormatted: formatarTamanho(asset.size),
        linhas: "...",
        colunas: "...",
      });

      intervaloProgressoRef.current = setInterval(() => {
        setProgressoUpload((prev) => {
          if (prev >= 87) {
            limparIntervaloProgresso();
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

      limparIntervaloProgresso();

      const dadosCompletos = {
        uri: asset.uri,
        name: asset.name,
        sizeFormatted: formatarTamanho(asset.size),
        linhas: resultadoAnalise.totalLinhas,
        colunas: resultadoAnalise.totalColunas,
        payload: resultadoAnalise.payload,
      };

      setArquivoUpload(dadosCompletos);

      setTimeout(() => {
        setProgressoUpload(100);
      }, 250);
    } catch (error) {
      console.error("Erro ao selecionar/analisar planilha:", error);
      limparIntervaloProgresso();
      setArquivoUpload(null);
      setProgressoUpload(0);

      const msg =
        error.code === "INCOMPATIVEL" || error.message?.includes("incompatível")
          ? "O arquivo importado é incompatível para mapeamento automático.\nBaixe nosso modelo e tente novamente."
          : error.message ||
            "Não foi possível processar o arquivo selecionado.";

      setMensagemErroPlanilhaUpload(msg);
      setModalErroPlanilhaVisivel(true);
    }
  };

  const handleConfirmarExclusaoArquivo = () => {
    limparIntervaloProgresso();
    setArquivoUpload(null);
    setProgressoUpload(0);
    setModalExcluirArquivoVisivel(false);
  };

  const handleMapearPlanilha = useCallback(async () => {
    if (!arquivoUpload?.payload) {
      return;
    }

    if (!obraId) {
      Alert.alert("Erro", "Identificador da obra não encontrado.");
      return;
    }

    setFeedbackUploadModal({
      visible: true,
      variant: "loading",
      title: "Mapeando planilha",
      message: "Validando dados e cadastrando etapas e serviços...",
    });

    try {
      await importarPlanilhaBase(obraId, arquivoUpload.payload);

      setFeedbackUploadModal({
        visible: true,
        variant: "success",
        title: "Planilha mapeada",
        message: "Os dados da obra foram importados com sucesso.",
      });

      setTimeout(async () => {
        setFeedbackUploadModal((prev) => ({ ...prev, visible: false }));
        setArquivoUpload(null);
        setProgressoUpload(0);
        if (typeof onMapeamentoSucesso === "function") {
          onMapeamentoSucesso();
        }
      }, 1200);
    } catch (error) {
      setFeedbackUploadModal((prev) => ({ ...prev, visible: false }));
      Alert.alert(
        "Erro na importação",
        error.message || "Não foi possível importar a planilha no servidor.",
      );
    }
  }, [arquivoUpload, obraId, onMapeamentoSucesso]);

  const prontoParaMapear =
    progressoUpload === 100 && Boolean(arquivoUpload?.payload);

  useEffect(() => {
    if (typeof onMapearActionChange !== "function") {
      return undefined;
    }

    onMapearActionChange(prontoParaMapear ? handleMapearPlanilha : null);
    return () => onMapearActionChange(null);
  }, [handleMapearPlanilha, onMapearActionChange, prontoParaMapear]);

  return (
    <View style={styles.estadoVazioContainer}>
      {!arquivoUpload ? (
        <View style={styles.cardNenhumDado}>
          <View style={styles.cardTopAccentBar} />

          <View style={styles.cardNenhumDadoConteudo}>
            <View style={styles.iconeNenhumDadoWrapper}>
              <AlertTriangleGradient
                size={moderateScale(56)}
                strokeWidth={2.4}
              />
            </View>

            <Text style={styles.textoNenhumDadoTitulo}>
              Nenhum dado cadastrado
            </Text>
            <Text style={styles.textoNenhumDadoSub}>
              Realize o upload da planilha de obras para registrar medições e
              acompanhar o progresso. Selecione o arquivo ou baixe nosso modelo.
            </Text>

            <View style={styles.botoesNenhumDadoWrapper}>
              <TouchableOpacity
                style={styles.botaoBaixarModelo}
                onPress={baixarModeloPlanilha}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Baixar modelo padrão"
              >
                <Text style={styles.textoBotaoBaixarModelo}>
                  Baixar modelo padrão
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoImportarPlanilha}
                onPress={handleSelecionarArquivoPlanilha}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Importar planilha"
              >
                <LinearGradient
                  colors={["#09D1C7", "#46DFB3", "#81EF99"]}
                  start={{ x: 0, y: 0.5 }}
                  end={{ x: 1, y: 0.5 }}
                  style={styles.gradienteImportarPlanilha}
                >
                  <Upload
                    size={moderateScale(21)}
                    color="#FFFFFF"
                    strokeWidth={3}
                    style={{ marginRight: moderateScale(8) }}
                  />
                  <Text style={styles.textoBotaoImportarPlanilha}>
                    Importar planilha
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.uploadFluxoContainer}>
          <View
            style={[
              styles.cardArquivoUpload,
              progressoUpload === 100 && styles.cardArquivoUploadConcluido,
            ]}
          >
            <TouchableOpacity
              style={styles.botaoLixeiraUpload}
              onPress={() => setModalExcluirArquivoVisivel(true)}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel="Excluir arquivo selecionado"
            >
              <Feather
                name="trash-2"
                size={moderateScale(22)}
                color="#0D6579"
              />
            </TouchableOpacity>

            <View style={styles.linhaTopoArquivo}>
              <View style={styles.iconeArquivoWrapper}>
                {progressoUpload === 100 ? (
                  <Feather
                    name="check"
                    size={moderateScale(28)}
                    color="#0D6579"
                    strokeWidth={3.5}
                  />
                ) : (
                  <IconePlanilhaTabela
                    size={moderateScale(28)}
                    color="#0D6579"
                  />
                )}
              </View>

              <View style={styles.infoArquivoWrapper}>
                <Text
                  style={styles.nomeArquivoUpload}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {arquivoUpload.name}
                </Text>
                <Text style={styles.detalhesArquivoUpload}>
                  {arquivoUpload.linhas} linhas - {arquivoUpload.colunas}{" "}
                  colunas - {arquivoUpload.sizeFormatted}
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
                  { width: `${Math.min(progressoUpload, 100)}%` },
                ]}
              />
            </View>

            <Text style={styles.textoStatusUpload}>
              {progressoUpload === 100
                ? "Importação de arquivo concluída."
                : `Importação de arquivo em ${progressoUpload}%`}
            </Text>
          </View>

          <View style={styles.badgeInformativoUpload}>
            <Text style={styles.textoBadgeInformativoUpload}>
              {progressoUpload === 100
                ? "Importação concluída com sucesso. Clique em “Mapear” para visualizar os serviços e registrar medições da obra."
                : "O arquivo está sendo importado. Aguarde um momento para liberação do mapeamento."}
            </Text>
          </View>
        </View>
      )}

      <ModalConfirmarExclusaoArquivo
        visible={modalExcluirArquivoVisivel}
        titulo="Excluir arquivo"
        mensagem="Tem certeza que deseja excluir a planilha? Esta ação será permanente."
        textoConfirmar="Excluir"
        textoCancelar="Cancelamento"
        onConfirmar={handleConfirmarExclusaoArquivo}
        onCancelar={() => setModalExcluirArquivoVisivel(false)}
      />

      <ModalErroPlanilha
        visible={modalErroPlanilhaVisivel}
        titulo="Erro!"
        mensagem={mensagemErroPlanilhaUpload}
        onConfirmar={() => setModalErroPlanilhaVisivel(false)}
      />

      <FeedbackModal
        visible={feedbackUploadModal.visible}
        variant={feedbackUploadModal.variant}
        title={feedbackUploadModal.title}
        message={feedbackUploadModal.message}
        onRequestClose={() => {}}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  estadoVazioContainer: {
    paddingHorizontal: moderateScale(16),
    paddingTop: moderateScale(16),
    paddingBottom: moderateScale(24),
  },
  cardNenhumDado: {
    backgroundColor: "#F7F5F0",
    borderRadius: moderateScale(22),
    borderWidth: 1,
    borderColor: "#E6E2DA",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  cardTopAccentBar: {
    height: 15,
    backgroundColor: "#81EF99",
    width: "100%",
  },
  cardNenhumDadoConteudo: {
    paddingHorizontal: moderateScale(22),
    paddingTop: moderateScale(30),
    paddingBottom: moderateScale(28),
    alignItems: "center",
  },
  iconeNenhumDadoWrapper: {
    marginBottom: moderateScale(20),
    alignItems: "center",
    justifyContent: "center",
  },
  textoNenhumDadoTitulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(18),
    color: "#223B59",
    textAlign: "center",
    marginBottom: moderateScale(5),
  },
  textoNenhumDadoSub: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13),
    lineHeight: moderateScale(20),
    color: "#0D6579",
    textAlign: "center",
    marginBottom: moderateScale(26),
    paddingHorizontal: moderateScale(8),
  },
  botoesNenhumDadoWrapper: {
    width: "100%",
    gap: moderateScale(8),
  },
  botaoBaixarModelo: {
    backgroundColor: "#0D6579",
    height: moderateScale(48),
    borderRadius: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  textoBotaoBaixarModelo: {
    fontFamily: fontes.semiNegrito,
    fontSize: moderateScale(14),
    color: "#FFFFFF",
  },
  botaoImportarPlanilha: {
    borderRadius: moderateScale(12),
    overflow: "hidden",
  },
  gradienteImportarPlanilha: {
    height: moderateScale(48),
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  textoBotaoImportarPlanilha: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(14),
    color: "#FFFFFF",
  },
  uploadFluxoContainer: {
    width: "100%",
    paddingTop: moderateScale(8),
  },
  cardArquivoUpload: {
    position: "relative",
    backgroundColor: "#F7F5F0",
    borderRadius: moderateScale(20),
    borderWidth: 1,
    borderColor: "#E6E2DA",
    paddingHorizontal: moderateScale(18),
    paddingVertical: moderateScale(18),
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: moderateScale(16),
  },
  cardArquivoUploadConcluido: {
    backgroundColor: "#E0F7F3",
    borderColor: "#A3E8DC",
  },
  linhaTopoArquivo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: moderateScale(14),
  },
  iconeArquivoWrapper: {
    marginRight: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  infoArquivoWrapper: {
    flex: 1,
    paddingRight: moderateScale(36),
  },
  nomeArquivoUpload: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(13.5),
    color: "#223B59",
    marginBottom: moderateScale(2),
  },
  detalhesArquivoUpload: {
    fontFamily: fontes.regular,
    fontSize: moderateScale(12.5),
    color: "#0D6579",
  },
  botaoLixeiraUpload: {
    position: "absolute",
    top: moderateScale(14),
    right: moderateScale(14),
    padding: moderateScale(6),
    zIndex: 10,
  },
  barraProgressoTrack: {
    height: 8,
    backgroundColor: "#E2E8F0",
    borderRadius: 999,
    overflow: "hidden",
    marginBottom: moderateScale(10),
  },
  barraProgressoFill: {
    height: "100%",
    borderRadius: 999,
  },
  textoStatusUpload: {
    fontFamily: fontes.media,
    fontSize: moderateScale(12.5),
    color: "#0D6579",
  },
  badgeInformativoUpload: {
    backgroundColor: "#E2ECE9",
    borderRadius: moderateScale(14),
    paddingHorizontal: moderateScale(16),
    paddingVertical: moderateScale(14),
    marginBottom: moderateScale(24),
  },
  textoBadgeInformativoUpload: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    lineHeight: moderateScale(19),
    color: "#0D6579",
  },
});
