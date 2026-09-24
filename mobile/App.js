import React from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet } from "react-native";

// Importe o seu componente oficial desenvolvido para a US13/US14
import AcompanhamentoObraScreen from "./src/screens/AcompanhamentoObraScreen";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <AcompanhamentoObraScreen />
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
});