import React from "react";
import { View, Text, StyleSheet, Modal, TouchableOpacity } from "react-native";
import { CheckCircle2 } from "lucide-react-native";

export default function SucessoModal({ 
  visible, 
  onClose, 
  titulo = "Sucesso!", 
  mensagem, 
  textoBotao = "Concluir" 
}) {
  return (
    <Modal
      animationType="fade"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <CheckCircle2 color="#00E5BC" size={64} style={styles.modalIcon} />
          <Text style={styles.modalTitle}>{titulo}</Text>
          <Text style={styles.modalText}>{mensagem}</Text>
          
          <TouchableOpacity
            style={styles.modalButton}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.modalButtonText}>{textoBotao}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 32,
    alignItems: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#172B4D",
    marginBottom: 8,
  },
  modalText: {
    fontSize: 16,
    color: "#64748B",
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 24,
  },
  modalButton: {
    width: "100%",
    height: 48,
    borderRadius: 12,
    backgroundColor: "#00E5BC",
    justifyContent: "center",
    alignItems: "center",
  },
  modalButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
});