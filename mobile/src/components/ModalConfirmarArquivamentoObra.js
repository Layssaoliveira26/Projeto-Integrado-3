import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import AlertTriangleGradient from "./AlertTriangleGradient";
import theme, { moderateScale } from "../styles/theme";

export default function ModalConfirmarArquivamentoObra({
  visivel,
  processando,
  onConfirmar,
  onCancelar,
}) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!processando) onCancelar();
      }}
    >
      <View style={styles.modalFundo}>
        <View style={styles.modalCard}>
          <View style={styles.modalIcone}>
            <AlertTriangleGradient size={moderateScale(50)} strokeWidth={2.4} />
          </View>
          <Text style={styles.modalTitulo}>Arquivar obra</Text>
          <Text style={styles.modalMensagem}>
            Tem certeza que deseja arquivar a obra?{"\n"}Você poderá desfazer esta ação.
          </Text>

          <TouchableOpacity
            style={styles.modalBotaoConfirmar}
            onPress={onConfirmar}
            disabled={processando}
            activeOpacity={0.85}
          >
            {processando ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.modalTextoBotaoConfirmar}>Arquivar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.modalBotaoCancelar}
            onPress={onCancelar}
            disabled={processando}
            activeOpacity={0.85}
          >
            <Text style={styles.modalTextoBotaoCancelar}>Cancelar</Text>
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
    ...theme.shadows.padrao,
  },
  modalIcone: {
    marginBottom: moderateScale(12),
  },
  modalTitulo: {
    fontSize: moderateScale(22),
    fontFamily: theme.fontes.negrito,
    color: theme.cores.titulo,
    marginBottom: moderateScale(10),
  },
  modalMensagem: {
    fontSize: moderateScale(13),
    fontFamily: theme.fontes.regular,
    color: theme.cores.textoSecundario,
    textAlign: "center",
    lineHeight: moderateScale(18),
    marginBottom: moderateScale(22),
  },
  modalBotaoConfirmar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: theme.cores.azulPetroleo,
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
    marginBottom: moderateScale(10),
  },
  modalTextoBotaoConfirmar: {
    fontSize: moderateScale(15),
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
  },
  modalBotaoCancelar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: theme.cores.titulo,
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  modalTextoBotaoCancelar: {
    fontSize: moderateScale(15),
    fontFamily: theme.fontes.negrito,
    color: "#FFFFFF",
  },
});
