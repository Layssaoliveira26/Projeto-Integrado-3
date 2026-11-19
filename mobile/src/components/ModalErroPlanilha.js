import React, { useEffect, useRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { cores, fontes, moderateScale } from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import { baixarModeloPlanilha } from "../services/api";
import AlertTriangleGradient from "./AlertTriangleGradient";
import ModalFeedback, { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";
import ModalAviso from "./ModalAviso";
import useFeedbackAcao from "../hooks/useFeedbackAcao";

export default function ModalErroPlanilha({
  visible,
  titulo = "Erro!",
  mensagem = "O arquivo importado é incompatível para mapeamento automático.\nBaixe nosso modelo e tente novamente.",
  textoBotao = "Certo",
  onConfirmar = () => {},
}) {
  const { feedback, executar } = useFeedbackAcao();
  const [avisoDownload, setAvisoDownload] = useState(null);
  const temporizadorDownloadRef = useRef(null);

  useEffect(
    () => () => {
      if (temporizadorDownloadRef.current) {
        clearTimeout(temporizadorDownloadRef.current);
      }
    },
    [],
  );

  const handleBaixarModelo = () => {
    onConfirmar();
    if (temporizadorDownloadRef.current) {
      clearTimeout(temporizadorDownloadRef.current);
    }
    temporizadorDownloadRef.current = setTimeout(() => {
      temporizadorDownloadRef.current = null;
      executar(
        "downloadModeloPlanilha",
        () => baixarModeloPlanilha({ mostrarAlertas: false }),
        {
          aoFalhar: (erro) => {
            if (erro?.code === "DOWNLOAD_CANCELADO") return;
            setAvisoDownload({
              titulo: "Erro no download",
              mensagem:
                erro?.message ||
                "Não foi possível salvar o modelo de planilha. Tente novamente.",
            });
          },
        },
      );
    }, 300);
  };

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={onConfirmar}
        statusBarTranslucent
      >
        <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onConfirmar}
            accessibilityLabel={textoBotao}
          />
          <View style={[ESTILOS_COMPARTILHADOS_MODAL.card, styles.card]}>
            <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />

            <View style={styles.conteudo}>
              <View style={styles.iconeContainer}>
                <AlertTriangleGradient
                  size={moderateScale(48)}
                  strokeWidth={2.4}
                />
              </View>

              <Text style={styles.titulo}>{titulo}</Text>

              <Text style={styles.mensagem}>{mensagem}</Text>

              <TouchableOpacity
                style={styles.botaoBaixarModelo}
                onPress={handleBaixarModelo}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Baixar modelo padrão (.xlsx)"
              >
                <Feather
                  name="download"
                  size={moderateScale(18)}
                  color={cores.azulPetroleo || "#0D6579"}
                  style={{ marginRight: moderateScale(8) }}
                />
                <Text style={styles.textoBotaoBaixarModelo}>
                  Baixar modelo padrão (.xlsx)
                </Text>
              </TouchableOpacity>

              <Pressable
                style={({ pressed }) => [
                  ESTILOS_BOTOES_MODAL.botao,
                  ESTILOS_BOTOES_MODAL.botaoSecundario,
                  styles.botaoUnico,
                  pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                ]}
                onPress={onConfirmar}
                accessibilityRole="button"
                accessibilityLabel={textoBotao}
              >
                <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                  {textoBotao}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <ModalFeedback {...feedback} />
      <ModalAviso
        visible={Boolean(avisoDownload)}
        titulo={avisoDownload?.titulo}
        mensagem={avisoDownload?.mensagem}
        onFechar={() => setAvisoDownload(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
  },
  conteudo: {
    paddingHorizontal: moderateScale(24),
    paddingTop: moderateScale(24),
    paddingBottom: moderateScale(28),
    alignItems: "center",
  },
  iconeContainer: {
    marginBottom: moderateScale(10),
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(20),
    color: "#1E3A5F",
    marginBottom: moderateScale(8),
    textAlign: "center",
  },
  mensagem: {
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    lineHeight: moderateScale(19),
    color: "#0F5F6E",
    textAlign: "center",
    marginBottom: moderateScale(20),
  },
  botaoBaixarModelo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    minHeight: moderateScale(48),
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    marginBottom: moderateScale(12),
    borderWidth: 1.5,
    borderColor: "#1A8E9A",
    borderRadius: moderateScale(14),
    backgroundColor: "#FFFFFF",
  },
  textoBotaoBaixarModelo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(14),
    color: "#0F5F6E",
  },
  botaoUnico: {
    marginBottom: 0,
  },
});
