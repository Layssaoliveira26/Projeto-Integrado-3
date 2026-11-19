import React from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AlertTriangleGradient from "./AlertTriangleGradient";
import { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import { fontes, moderateScale } from "../styles/theme";

export default function ModalConfirmarExclusaoArquivo({
  visible,
  titulo = "Excluir arquivo",
  mensagem = "Tem certeza que deseja excluir a planilha? Esta ação será permanente.",
  textoConfirmar = "Excluir",
  textoCancelar = "Cancelar",
  carregando = false,
  onConfirmar = () => {},
  onCancelar = () => {},
}) {
  const fecharSePossivel = () => {
    if (!carregando) onCancelar();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={fecharSePossivel}
      statusBarTranslucent
    >
      <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={fecharSePossivel}
          accessibilityLabel={textoCancelar}
        />
        <View style={[ESTILOS_COMPARTILHADOS_MODAL.card, styles.card]}>
          <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />

          <View style={styles.conteudo}>
            <View style={styles.modalIcone}>
              <AlertTriangleGradient
                size={moderateScale(48)}
                strokeWidth={2.4}
              />
            </View>

            <Text style={styles.modalTitulo}>{titulo}</Text>

            <Text style={styles.modalMensagem}>{mensagem}</Text>

            <Pressable
              style={({ pressed }) => [
                ESTILOS_BOTOES_MODAL.botao,
                ESTILOS_BOTOES_MODAL.botaoPrimario,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={onConfirmar}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={textoConfirmar}
            >
              {carregando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                  {textoConfirmar}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                ESTILOS_BOTOES_MODAL.botao,
                ESTILOS_BOTOES_MODAL.botaoSecundario,
                styles.botaoUltimo,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={fecharSePossivel}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel={textoCancelar}
            >
              <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                {textoCancelar}
              </Text>
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
    paddingHorizontal: moderateScale(24),
    paddingTop: moderateScale(24),
    paddingBottom: moderateScale(28),
    alignItems: "center",
  },
  modalIcone: {
    marginBottom: moderateScale(10),
  },
  modalTitulo: {
    fontSize: moderateScale(20),
    fontFamily: fontes.negrito,
    color: "#1E3A5F",
    marginBottom: moderateScale(8),
    textAlign: "center",
  },
  modalMensagem: {
    fontSize: moderateScale(13),
    fontFamily: fontes.media,
    color: "#0F5F6E",
    textAlign: "center",
    lineHeight: moderateScale(18),
    marginBottom: moderateScale(20),
  },
  botaoUltimo: {
    marginBottom: 0,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
});
