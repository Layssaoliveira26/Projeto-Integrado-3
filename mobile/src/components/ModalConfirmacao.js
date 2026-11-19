import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fontes, moderateScale } from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import AlertTriangleGradient from "./AlertTriangleGradient";
import { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";

export default function ModalConfirmacao({
  visible,
  titulo,
  mensagem,
  textoConfirmar,
  textoCancelar = "Cancelar",
  onConfirmar,
  onCancelar,
  processando = false,
}) {
  const confirmarTravadoRef = useRef(false);

  useEffect(() => {
    if (!visible || !processando) {
      confirmarTravadoRef.current = false;
    }
  }, [visible, processando]);

  const cancelar = () => {
    if (confirmarTravadoRef.current || processando) return;
    onCancelar();
  };

  const confirmar = () => {
    if (confirmarTravadoRef.current || processando) return;
    confirmarTravadoRef.current = true;
    onConfirmar();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={cancelar}
    >
      <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={cancelar}
          accessibilityLabel={textoCancelar}
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
                ESTILOS_BOTOES_MODAL.botaoPrimario,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                processando && styles.botaoDesabilitado,
              ]}
              onPress={confirmar}
              disabled={processando}
              accessibilityRole="button"
              accessibilityLabel={textoConfirmar}
            >
              {processando ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
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
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                processando && styles.botaoDesabilitado,
              ]}
              onPress={cancelar}
              disabled={processando}
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
    fontSize: moderateScale(13),
    lineHeight: moderateScale(18),
    textAlign: "center",
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
});
