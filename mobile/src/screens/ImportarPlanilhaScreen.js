import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as DocumentPicker from "expo-document-picker";

import { cores, fontes } from "../styles/theme";
import { analisarPlanilha, formatarTamanho } from "../utils/planilhaParser";
import { importarPlanilhaBase } from "../services/api";
import FeedbackModal from "../components/FeedbackModal";
import ModalErroPlanilha from "../components/ModalErroPlanilha";

export default function ImportarPlanilhaScreen({ navigation, route }) {
  const obraId = route?.params?.obraId;
  const nomeObra = route?.params?.nome;

  const [arquivo, setArquivo] = useState(null);
  const [progresso, setProgresso] = useState(0);
  const [erroModalVisivel, setErroModalVisivel] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");
  const [feedbackModal, setFeedbackModal] = useState({
    visible: false,
    variant: "loading",
    title: "",
    message: "",
  });

  const intervaloProgressoRef = useRef(null);

  const limparProgresso = () => {
    if (intervaloProgressoRef.current) {
      clearInterval(intervaloProgressoRef.current);
      intervaloProgressoRef.current = null;
    }
  };

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

      // 1. Inicia o estado com arquivo em processamento
      limparProgresso();
      setProgresso(15);

      // Simula a progressão da barra até 87% enquanto o parser valida
      intervaloProgressoRef.current = setInterval(() => {
        setProgresso((prev) => {
          if (prev >= 87) {
            limparProgresso();
            return 87;
          }
          return prev + 24;
        });
      }, 180);

      // 2. Extrai e valida a estrutura da planilha usando o parser (suporta Android, iOS e Web)
      const resultadoAnalise = await analisarPlanilha(asset.uri, asset.name, asset);

      limparProgresso();

      // 3. Atualiza os dados do arquivo
      setArquivo({
        uri: asset.uri,
        name: asset.name,
        sizeFormatted: formatarTamanho(asset.size),
        linhas: resultadoAnalise.totalLinhas,
        colunas: resultadoAnalise.totalColunas,
        payload: resultadoAnalise.payload,
      });

      // 4. Ao concluir, avança suavemente para 100% (card fica verde)
      setTimeout(() => {
        setProgresso(100);
      }, 250);
    } catch (error) {
      console.error("Erro ao selecionar/analisar planilha:", error);
      limparProgresso();
      setArquivo(null);
      setProgresso(0);

      const msg =
        error.code === "INCOMPATIVEL" || error.message?.includes("incompatível")
          ? "O arquivo importado é incompatível para mapeamento automático.\nBaixe nosso modelo e tente novamente."
          : error.message || "Não foi possível processar o arquivo selecionado.";

      setMensagemErro(msg);
      setErroModalVisivel(true);
    }
  };

  const handleRemoverArquivo = () => {
    limparProgresso();
    setArquivo(null);
    setProgresso(0);
  };

  const handleMapear = async () => {
    if (!arquivo || progresso < 100 || !arquivo.payload) {
      return;
    }

    if (!obraId) {
      setMensagemErro("Identificador da obra não encontrado.");
      setErroModalVisivel(true);
      return;
    }

    setFeedbackModal({
      visible: true,
      variant: "loading",
      title: "Mapeando planilha",
      message: "Validando dados e cadastrando etapas e serviços...",
    });

    try {
      await importarPlanilhaBase(obraId, arquivo.payload);

      setFeedbackModal({
        visible: true,
        variant: "success",
        title: "Planilha mapeada",
        message: "Os dados da obra foram importados com sucesso.",
      });

      // Aguarda o usuário visualizar a confirmação e navega para a tela de acompanhamento
      setTimeout(() => {
        setFeedbackModal((prev) => ({ ...prev, visible: false }));
        navigation.replace("AcompanhamentoObra", {
          obraId,
          nome: nomeObra,
        });
      }, 1200);
    } catch (error) {
      setFeedbackModal((prev) => ({ ...prev, visible: false }));
      const msg =
        error.message ||
        "Ocorreu um erro ao importar a planilha orçamentária no servidor.";
      setMensagemErro(msg);
      setErroModalVisivel(true);
    }
  };

  const prontoParaMapear = arquivo !== null && progresso === 100;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={cores.fundoCard} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        {/* Top Header com Botão Voltar e Título */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => navigation?.goBack?.()}
            activeOpacity={0.7}
          >
            <Feather
              name="chevron-left"
              size={32}
              color={cores.titulo || "#223B59"}
            />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Importar planilha</Text>
        </View>

        {/* Card Informativo Superior */}
        <View style={styles.cardBanner}>
          <Text style={styles.textoBanner}>
            Faça o upload da planilha do projeto que deseja cadastrar usando
            nosso modelo padrão.
          </Text>
        </View>

        {/* Card Grande de Upload (Selecione o arquivo) */}
        <TouchableOpacity
          style={styles.cardUpload}
          onPress={handleSelecionarArquivo}
          activeOpacity={0.8}
        >
          {/* Ícone de pasta preenchida */}
          <Feather
            name="folder"
            size={52}
            color={cores.azulPetroleo || "#0D6579"}
            style={styles.iconePasta}
          />
          <Text style={styles.tituloUpload}>Selecione o arquivo</Text>
          <Text style={styles.subtituloUpload}>
            Toque para escolher do dispositivo
          </Text>
        </TouchableOpacity>

        {/* Card de Status do Arquivo Selecionado (Transiciona para Verde em 100%) */}
        {arquivo && (
          <View
            style={[
              styles.cardArquivo,
              progresso === 100 && styles.cardArquivoConcluido,
            ]}
          >
            <View style={styles.linhaTopoArquivo}>
              {/* Ícone da esquerda: Tabela em carregamento, Checkmark em 100% */}
              <View style={styles.iconeStatusWrapper}>
                {progresso === 100 ? (
                  <Feather
                    name="check"
                    size={28}
                    color={cores.azulPetroleo || "#0D6579"}
                    strokeWidth={3.5}
                  />
                ) : (
                  <Feather
                    name="grid"
                    size={24}
                    color={cores.azulPetroleo || "#0D6579"}
                  />
                )}
              </View>

              {/* Detalhes do arquivo */}
              <View style={styles.infoArquivoWrapper}>
                <Text
                  style={styles.nomeArquivo}
                  numberOfLines={1}
                  ellipsizeMode="middle"
                >
                  {arquivo.name}
                </Text>
                <Text style={styles.detalhesArquivo}>
                  {arquivo.linhas} linhas – {arquivo.colunas} colunas –{" "}
                  {arquivo.sizeFormatted}
                </Text>
              </View>

              {/* Botão de excluir/remover */}
              <TouchableOpacity
                style={styles.botaoLixeira}
                onPress={handleRemoverArquivo}
                activeOpacity={0.7}
              >
                <Feather
                  name="trash-2"
                  size={22}
                  color={cores.azulPetroleo || "#0D6579"}
                />
              </TouchableOpacity>
            </View>

            {/* Barra de Progresso com Gradiente */}
            <View style={styles.barraProgressoTrack}>
              <LinearGradient
                colors={
                  progresso === 100
                    ? [
                        cores.verdeClaro || "#81EF99",
                        cores.ciano || "#09D1C7",
                        cores.azulPetroleo || "#0D6579",
                      ]
                    : [cores.verdeClaro || "#81EF99", cores.ciano || "#09D1C7"]
                }
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.barraProgressoFill, { width: `${progresso}%` }]}
              />
            </View>

            {/* Texto de Status */}
            <Text style={styles.textoStatusArquivo}>
              {progresso === 100
                ? "Importação de arquivo concluída."
                : `Importação de arquivo em ${progresso}%`}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Botão Fixo "Mapear" na base */}
      <View style={styles.rodapeContainer}>
        <TouchableOpacity
          style={[
            styles.botaoMapear,
            !prontoParaMapear && styles.botaoMapearDesabilitado,
          ]}
          onPress={handleMapear}
          disabled={!prontoParaMapear}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={
              prontoParaMapear
                ? [
                    cores.ciano || "#09D1C7",
                    cores.verdeAgua || "#46DFB3",
                    cores.verdeClaro || "#81EF99",
                  ]
                : ["#79DDCB", "#A4EFD2"]
            }
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.gradienteMapear}
          >
            <Text style={styles.textoBotaoMapear}>Mapear</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Modal de Feedback (Loading / Sucesso) */}
      <FeedbackModal
        visible={feedbackModal.visible}
        variant={feedbackModal.variant}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onRequestClose={() => {}}
      />

      {/* Modal de Erro Customizado (Fiel à Imagem 3) */}
      <ModalErroPlanilha
        visible={erroModalVisivel}
        titulo="Erro!"
        mensagem={mensagemErro}
        onConfirmar={() => setErroModalVisivel(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: cores.fundoCard || "#F6F4F0",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    marginBottom: 20,
  },
  botaoVoltar: {
    marginRight: 8,
    padding: 4,
    marginLeft: -4,
  },
  tituloHeader: {
    fontFamily: fontes.negrito,
    fontSize: 24,
    color: cores.titulo || "#223B59",
  },
  cardBanner: {
    backgroundColor: cores.fundoBanner || "#E0EAE7",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 18,
    marginBottom: 20,
  },
  textoBanner: {
    fontFamily: fontes.regular,
    fontSize: 14,
    lineHeight: 20,
    color: cores.azulPetroleo || "#0D6579",
  },
  cardUpload: {
    backgroundColor: cores.fundoCardMetric || "#EAE7E2",
    borderRadius: 20,
    height: 220,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  iconePasta: {
    marginBottom: 12,
  },
  tituloUpload: {
    fontFamily: fontes.negrito,
    fontSize: 18,
    color: cores.azulPetroleo || "#0D6579",
    marginBottom: 4,
  },
  subtituloUpload: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.textoSecundario || "#79A5AF",
  },
  cardArquivo: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.04)",
  },
  cardArquivoConcluido: {
    backgroundColor: "#E0F7F3",
    borderColor: "rgba(9, 209, 199, 0.25)",
  },
  linhaTopoArquivo: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconeStatusWrapper: {
    width: 32,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  infoArquivoWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  nomeArquivo: {
    fontFamily: fontes.negrito,
    fontSize: 15,
    color: cores.azulPetroleo || "#0D6579",
    marginBottom: 2,
  },
  detalhesArquivo: {
    fontFamily: fontes.regular,
    fontSize: 12,
    color: cores.azulPetroleo || "#0D6579",
  },
  botaoLixeira: {
    padding: 6,
    marginLeft: 8,
  },
  barraProgressoTrack: {
    height: 6,
    backgroundColor: "#E6E6E6",
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 10,
  },
  barraProgressoFill: {
    height: "100%",
    borderRadius: 3,
  },
  textoStatusArquivo: {
    fontFamily: fontes.media,
    fontSize: 12,
    color: cores.azulPetroleo || "#0D6579",
  },
  rodapeContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 20,
    backgroundColor: "transparent",
  },
  botaoMapear: {
    height: 54,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  botaoMapearDesabilitado: {
    opacity: 0.5,
    elevation: 0,
  },
  gradienteMapear: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoMapear: {
    fontFamily: fontes.negrito,
    fontSize: 18,
    color: "#FFFFFF",
  },
});
