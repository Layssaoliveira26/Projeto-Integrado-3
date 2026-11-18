import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cores, fontes, shadows, moderateScale, rem } from "../styles/theme";
import { baixarModeloPlanilha } from "../services/api";
import AlertTriangleGradient from "./AlertTriangleGradient";

export default function ModalErroPlanilha({
  visible,
  titulo = "Erro!",
  mensagem = "O arquivo importado é incompatível para mapeamento automático.\nBaixe nosso modelo e tente novamente.",
  textoBotao = "Certo",
  onConfirmar = () => {},
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onConfirmar}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.modalAccentBar} />

          <View style={styles.conteudo}>
            <View style={styles.iconeContainer}>
              <AlertTriangleGradient />
            </View>

            <Text style={styles.titulo}>{titulo}</Text>

            <Text style={styles.mensagem}>{mensagem}</Text>

            <TouchableOpacity
              style={styles.botaoBaixarModelo}
              onPress={baixarModeloPlanilha}
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

            <TouchableOpacity
              style={styles.botao}
              onPress={onConfirmar}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={textoBotao}
            >
              <Text style={styles.textoBotao}>{textoBotao}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(24),
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    overflow: "hidden",
    ...shadows.padrao,
  },
  modalAccentBar: {
    height: moderateScale(6),
    backgroundColor: cores.verdeClaro || "#81EF99",
  },
  conteudo: {
    paddingVertical: moderateScale(26),
    paddingHorizontal: moderateScale(22),
    alignItems: "center",
  },
  iconeContainer: {
    marginBottom: moderateScale(12),
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.4),
    color: cores.titulo || "#223B59",
    marginBottom: moderateScale(8),
    textAlign: "center",
  },
  mensagem: {
    fontFamily: fontes.regular,
    fontSize: rem(0.85),
    lineHeight: rem(1.22),
    color: cores.textoSecundario || "#79A5AF",
    textAlign: "center",
    marginBottom: moderateScale(22),
  },
  botaoBaixarModelo: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    paddingVertical: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    marginBottom: moderateScale(12),
    borderWidth: 1.5,
    borderColor: cores.azulPetroleo || "#0D6579",
    borderRadius: moderateScale(12),
    backgroundColor: "#F2FBF9",
  },
  textoBotaoBaixarModelo: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.85),
    color: cores.azulPetroleo || "#0D6579",
  },
  botao: {
    width: "100%",
    height: moderateScale(48),
    backgroundColor: cores.azulPetroleo || "#0D6579",
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotao: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.95),
    color: "#FFFFFF",
  },
});
