import React from "react";
import { View, Text, Modal, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { cores } from "../styles/theme";

const VARIANT_DEFAULTS = {
  loading: {
    title: "Atualizando dados",
    message: "Registrando nova medida e calculando informações.",
  },
  success: {
    title: "Dados atualizados",
    message:
      "Nova medida registrada e novos resultados do progresso disponíveis.",
  },
};

function VariantIcon({ variant }) {
  if (variant === "loading") {
    return (
      <ActivityIndicator
        size="large"
        color={cores.verdeAgua}
        style={styles.spinner}
      />
    );
  }

  return (
    <View style={styles.successIconWrap}>
      <Ionicons name="checkmark" size={30} color={cores.azulPetroleo} />
    </View>
  );
}

export default function FeedbackModal({
  visible,
  variant = "loading", // "loading" | "success"
  title,
  message,
  onRequestClose = () => {},
}) {
  const defaults = VARIANT_DEFAULTS[variant] ?? VARIANT_DEFAULTS.loading;
  const resolvedTitle = title ?? defaults.title;
  const resolvedMessage = message ?? defaults.message;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.topBar} />

          <View style={styles.content}>
            <VariantIcon variant={variant} />

            <Text style={styles.title}>{resolvedTitle}</Text>
            <Text style={styles.message}>{resolvedMessage}</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const CARD_WIDTH = 340;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(6, 20, 18, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: cores.fundoCard,
    borderRadius: 16,
    overflow: "hidden",
    ...{
      shadowColor: "#0F172A",
      shadowOpacity: 0.2,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 12,
    },
  },
  topBar: {
    height: 8,
    backgroundColor: cores.verdeAgua,
  },
  content: {
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  spinner: {
    marginBottom: 12,
  },
  successIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EEF0F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: cores.textoEscuro,
    marginBottom: 4,
    textAlign: "center",
  },
  message: {
    fontSize: 13,
    color: cores.azulPetroleo,
    textAlign: "center",
    lineHeight: 18,
  },
});
