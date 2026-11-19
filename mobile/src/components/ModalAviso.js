import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { fontes, moderateScale } from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import AlertTriangleGradient from "./AlertTriangleGradient";
import { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";

export default function ModalAviso({
  visible,
  titulo = "Atenção",
  mensagem = "",
  textoBotao = "Certo",
  onFechar = () => {},
}) {
  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onFechar}
    >
      <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onFechar}
          accessibilityLabel={textoBotao}
        />
        <View style={[ESTILOS_COMPARTILHADOS_MODAL.card, styles.card]}>
          <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />

          <View style={styles.conteudo}>
            <View style={styles.icone}>
              <AlertTriangleGradient
                size={moderateScale(48)}
                strokeWidth={2.4}
              />
            </View>

            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.mensagem}>{mensagem}</Text>

            <Pressable
              style={({ pressed }) => [
                ESTILOS_BOTOES_MODAL.botao,
                ESTILOS_BOTOES_MODAL.botaoSecundario,
                styles.botaoUnico,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
              ]}
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel={textoBotao}
            >
              <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>{textoBotao}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
  },
  conteudo: {
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
    paddingTop: moderateScale(24),
    paddingBottom: moderateScale(28),
  },
  icone: {
    marginBottom: moderateScale(10),
  },
  titulo: {
    marginBottom: moderateScale(8),
    color: "#1E3A5F",
    fontFamily: fontes.negrito,
    fontSize: moderateScale(20),
    textAlign: "center",
  },
  mensagem: {
    marginBottom: moderateScale(20),
    color: "#0F5F6E",
    fontFamily: fontes.media,
    fontSize: moderateScale(13.5),
    lineHeight: moderateScale(19),
    textAlign: "center",
  },
  botaoUnico: {
    marginBottom: 0,
  },
});
