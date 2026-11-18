import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import AlertTriangleGradient from "./AlertTriangleGradient";
import { cores, fontes, shadows, moderateScale, rem } from "../styles/theme";

export default function ModalConfirmarExclusaoArquivo({
  visible,
  titulo = "Excluir arquivo",
  mensagem = "Tem certeza que deseja excluir a planilha? Esta ação será permanente.",
  textoConfirmar = "Excluir",
  textoCancelar = "Cancelamento",
  carregando = false,
  onConfirmar = () => {},
  onCancelar = () => {},
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!carregando) onCancelar();
      }}
      statusBarTranslucent
    >
      <View style={styles.modalFundo}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcone}>
            <AlertTriangleGradient size={moderateScale(48)} strokeWidth={2.4} />
          </View>

          <Text style={styles.modalTitulo}>{titulo}</Text>

          <Text style={styles.modalMensagem}>{mensagem}</Text>

          <TouchableOpacity
            style={styles.modalBotaoConfirmar}
            onPress={onConfirmar}
            disabled={carregando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={textoConfirmar}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.modalTextoBotaoConfirmar}>{textoConfirmar}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalBotaoCancelar}
            onPress={onCancelar}
            disabled={carregando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={textoCancelar}
          >
            <Text style={styles.modalTextoBotaoCancelar}>{textoCancelar}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(20),
    paddingVertical: moderateScale(28),
    paddingHorizontal: moderateScale(22),
    alignItems: "center",
    ...shadows.padrao,
  },
  modalIcone: {
    marginBottom: moderateScale(12),
  },
  modalTitulo: {
    fontSize: rem(1.35),
    fontFamily: fontes.negrito,
    color: cores.titulo || "#223B59",
    marginBottom: moderateScale(10),
    textAlign: "center",
  },
  modalMensagem: {
    fontSize: rem(0.82),
    fontFamily: fontes.regular,
    color: cores.textoSecundario || "#79A5AF",
    textAlign: "center",
    lineHeight: rem(1.15),
    marginBottom: moderateScale(22),
  },
  modalBotaoConfirmar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: cores.azulPetroleo || "#0D6579",
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: moderateScale(10),
  },
  modalTextoBotaoConfirmar: {
    fontSize: rem(0.92),
    fontFamily: fontes.negrito,
    color: "#FFFFFF",
  },
  modalBotaoCancelar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: cores.titulo || "#223B59",
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  modalTextoBotaoCancelar: {
    fontSize: rem(0.92),
    fontFamily: fontes.negrito,
    color: "#FFFFFF",
  },
});
