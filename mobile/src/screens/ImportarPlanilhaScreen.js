import React, { useState } from "react";
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

import { cores, fontes, moderateScale, rem } from "../styles/theme";
import { importarPlanilhaBase, baixarModeloPlanilha } from "../services/api";
import FeedbackModal from "../components/FeedbackModal";
import ModalErroPlanilha from "../components/ModalErroPlanilha";
import UploadPlanilhaCard from "../components/UploadPlanilhaCard";

export default function ImportarPlanilhaScreen({ navigation, route }) {
  const obraId = route?.params?.obraId;
  const nomeObra = route?.params?.nome;

  const [arquivo, setArquivo] = useState(null);
  const [erroModalVisivel, setErroModalVisivel] = useState(false);
  const [mensagemErro, setMensagemErro] = useState("");
  const [feedbackModal, setFeedbackModal] = useState({
    visible: false,
    variant: "loading",
    title: "",
    message: "",
  });

  const handleMapear = async () => {
    if (!arquivo || !arquivo.payload) {
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

      // Aguarda o usuário visualizar a confirmação e navega para o acompanhamento da obra
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

  const prontoParaMapear = arquivo !== null && Boolean(arquivo.payload);

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar barStyle="dark-content" backgroundColor={cores.fundoCard} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        bounces={false}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.botaoVoltar}
            onPress={() => navigation?.goBack?.()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Feather
              name="chevron-left"
              size={moderateScale(32)}
              color={cores.titulo || "#223B59"}
            />
          </TouchableOpacity>
          <Text style={styles.tituloHeader}>Importar planilha</Text>
        </View>

        {/* Badge */}
        <TouchableOpacity
          style={styles.cardBanner}
          onPress={baixarModeloPlanilha}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Baixar modelo padrão de planilha"
        >
          <Text style={styles.textoBanner}>
            Faça o upload da planilha do projeto usando nosso modelo padrão.{" "}
            <Text
              style={{
                textDecorationLine: "underline",
                fontFamily: fontes.negrito,
              }}
            >
              Toque aqui para baixá-lo.
            </Text>
          </Text>
        </TouchableOpacity>

        {/* Upload de Arquivos */}
        <UploadPlanilhaCard onArquivoChange={setArquivo} />
      </ScrollView>

      {/* Botão Fixo "Mapear" na base da tela */}
      <View style={styles.rodapeContainer}>
        <TouchableOpacity
          style={[
            styles.botaoMapear,
            !prontoParaMapear && styles.botaoMapearDesabilitado,
          ]}
          onPress={handleMapear}
          disabled={!prontoParaMapear}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Mapear planilha"
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

      {/* Modal de Feedback do Processamento (Loading / Sucesso) */}
      <FeedbackModal
        visible={feedbackModal.visible}
        variant={feedbackModal.variant}
        title={feedbackModal.title}
        message={feedbackModal.message}
        onRequestClose={() => {}}
      />

      {/* Modal de Erro Genérico / Servidor */}
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
    paddingHorizontal: moderateScale(20),
    paddingBottom: moderateScale(110),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: moderateScale(10),
    marginBottom: moderateScale(20),
  },
  botaoVoltar: {
    marginRight: moderateScale(8),
    padding: moderateScale(4),
    marginLeft: -moderateScale(4),
  },
  tituloHeader: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.45),
    color: cores.titulo || "#223B59",
  },
  cardBanner: {
    backgroundColor: cores.fundoBanner || "#E0EAE7",
    borderRadius: moderateScale(16),
    paddingVertical: moderateScale(18),
    paddingHorizontal: moderateScale(18),
    marginBottom: moderateScale(20),
  },
  textoBanner: {
    fontFamily: fontes.regular,
    fontSize: rem(0.85),
    lineHeight: rem(1.25),
    color: cores.azulPetroleo || "#0D6579",
  },
  rodapeContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: moderateScale(20),
    paddingBottom:
      Platform.OS === "ios" ? moderateScale(30) : moderateScale(20),
    backgroundColor: "transparent",
  },
  botaoMapear: {
    height: moderateScale(54),
    borderRadius: moderateScale(20),
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
    fontSize: rem(1.1),
    color: "#FFFFFF",
  },
});
