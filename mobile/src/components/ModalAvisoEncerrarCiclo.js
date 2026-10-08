import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function ModalAvisoEncerrarCiclo({
  visivel,
  numeroCiclo,
  onAvancar,
  onCancelar,
}) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onCancelar}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconeContainer}>
            <Ionicons name="help-circle-outline" size={56} color="#0D6579" />
          </View>

          <Text style={styles.titulo}>Encerrar Ciclo {String(numeroCiclo || 1).padStart(2, "0")}?</Text>

          <Text style={styles.mensagem}>
            Deseja iniciar o processo de encerramento deste ciclo de medição?
          </Text>

          <TouchableOpacity
            style={styles.btnAvancar}
            onPress={onAvancar}
            activeOpacity={0.8}
          >
            <Text style={styles.btnAvancarTexto}>Continuar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnCancelar}
            onPress={onCancelar}
            activeOpacity={0.8}
          >
            <Text style={styles.btnCancelarTexto}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    elevation: 5,
  },
  iconeContainer: { marginBottom: 8 },
  titulo: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F2A38",
    marginBottom: 12,
  },
  mensagem: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnAvancar: {
    backgroundColor: "#0D6579",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  btnAvancarTexto: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  btnCancelar: {
    backgroundColor: "#F1F5F9",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancelarTexto: { color: "#475569", fontSize: 15, fontWeight: "700" },
});