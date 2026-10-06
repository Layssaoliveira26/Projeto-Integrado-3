import React from "react";
import { View, Text, Modal, TouchableOpacity, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { cores, fontes } from "../styles/theme";

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
          {/* Faixa superior verde */}
          <View style={styles.topBar} />

          <View style={styles.conteudo}>
            {/* Ícone de alerta em formato de triângulo */}
            <Feather
              name="alert-triangle"
              size={52}
              color={cores.ciano || "#09D1C7"}
              style={styles.iconeAlerta}
            />

            <Text style={styles.titulo}>{titulo}</Text>

            <Text style={styles.mensagem}>{mensagem}</Text>

            <TouchableOpacity
              style={styles.botao}
              onPress={onConfirmar}
              activeOpacity={0.85}
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
    paddingHorizontal: 25,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  topBar: {
    height: 8,
    backgroundColor: cores.verdeClaro || "#81EF99",
  },
  conteudo: {
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconeAlerta: {
    marginBottom: 8,
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: 22,
    color: cores.titulo || "#223B59",
    marginBottom: 10,
    textAlign: "center",
  },
  mensagem: {
    fontFamily: fontes.regular,
    fontSize: 14,
    lineHeight: 20,
    color: cores.azulPetroleo || "#0D6579",
    textAlign: "center",
    marginBottom: 24,
  },
  botao: {
    width: "100%",
    height: 48,
    backgroundColor: cores.azulPetroleo || "#0D6579",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotao: {
    fontFamily: fontes.negrito,
    fontSize: 16,
    color: "#FFFFFF",
  },
});
