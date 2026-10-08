import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cores } from "../styles/theme";

export default function ModalEncerrarCiclo({
  visivel,
  carregando,
  onConfirmar,
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
            <Ionicons name="alert-circle-outline" size={56} color="#0D9488" />
          </View>

          <Text style={styles.titulo}>Encerrar ciclo</Text>

          <Text style={styles.mensagem}>
            Tem certeza que deseja encerrar o ciclo atual? Esta ação será
            permanente.
          </Text>

          {/* ATENÇÃO AQUI: onPress={onConfirmar} */}
          <TouchableOpacity
            style={[styles.btnConfirmar, carregando && styles.btnDesabilitado]}
            onPress={() => {
              console.log("Clique no botão Encerrar do Modal detectado!");
              if (onConfirmar) onConfirmar();
            }}
            disabled={carregando}
            activeOpacity={0.7}
          >
            {carregando ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.btnConfirmarTexto}>Encerrar</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.btnCancelar}
            onPress={onCancelar}
            disabled={carregando}
            activeOpacity={0.7}
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
    zIndex: 9999,
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
    color: "#1E293B",
    marginBottom: 12,
  },
  mensagem: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  btnConfirmar: {
    backgroundColor: "#0D9488",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  btnDesabilitado: { opacity: 0.7 },
  btnConfirmarTexto: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
  btnCancelar: {
    backgroundColor: "#0F172A",
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnCancelarTexto: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});