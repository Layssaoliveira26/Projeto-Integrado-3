import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../context/AuthContext";
import { cores, bordas, fontes, shadows } from "../styles/theme";

export default function HomeScreen() {
  const { usuario, logout } = useAuth();
  const [saindo, setSaindo] = useState(false);

  const handleSair = async () => {
    try {
      setSaindo(true);
      await logout();
    } catch (error) {
      console.error("Erro ao encerrar sessão:", error);
    } finally {
      setSaindo(false);
    }
  };

  const inicialNome = usuario?.nome ? usuario.nome.charAt(0).toUpperCase() : "U";

  return (
    <SafeAreaView style={styles.container} edges={["bottom", "left", "right"]}>
      {/* Cartão de Perfil do Usuário */}
      <View style={styles.cardPerfil}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarTexto}>{inicialNome}</Text>
        </View>

        <View style={styles.infoUsuario}>
          <Text style={styles.saudacao}>Bem-vindo(a),</Text>
          <Text style={styles.nomeUsuario} numberOfLines={1}>
            {usuario?.nome || "Usuário"}
          </Text>
          <Text style={styles.emailUsuario} numberOfLines={1}>
            {usuario?.email || ""}
          </Text>
        </View>
      </View>

      {/* Mensagem Central Simples */}
      <View style={styles.cardMensagem}>
        <Ionicons name="construct-outline" size={48} color={cores.azulEsverdeado} />
        <Text style={styles.textoMensagem}>Será construído em breve.</Text>
      </View>

      {/* Botão de Sair da Conta */}
      <TouchableOpacity
        style={styles.botaoSair}
        onPress={handleSair}
        disabled={saindo}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Sair da conta"
      >
        {saindo ? (
          <ActivityIndicator size="small" color="#DC2626" />
        ) : (
          <>
            <Ionicons name="log-out-outline" size={20} color="#DC2626" style={{ marginRight: 8 }} />
            <Text style={styles.textoBotaoSair}>Sair da conta</Text>
          </>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: cores.fundoCard,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    justifyContent: "space-between",
  },
  cardPerfil: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: bordas.cardObras,
    padding: 16,
    ...shadows.padrao,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: cores.principal,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 14,
  },
  avatarTexto: {
    fontFamily: fontes.negrito,
    fontSize: 20,
    color: "#FFFFFF",
  },
  infoUsuario: {
    flex: 1,
  },
  saudacao: {
    fontFamily: fontes.regular,
    fontSize: 12,
    color: cores.textoSecundario,
  },
  nomeUsuario: {
    fontFamily: fontes.semiNegrito,
    fontSize: 17,
    color: cores.titulo,
  },
  emailUsuario: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.textoSecundario,
  },
  cardMensagem: {
    backgroundColor: "#FFFFFF",
    borderRadius: bordas.cardObras,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    ...shadows.padrao,
  },
  textoMensagem: {
    fontFamily: fontes.semiNegrito,
    fontSize: 16,
    color: cores.titulo,
    marginTop: 14,
    textAlign: "center",
  },
  botaoSair: {
    flexDirection: "row",
    height: 48,
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    backgroundColor: "#FEF2F2",
    borderRadius: bordas.input,
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoSair: {
    fontFamily: fontes.semiNegrito,
    fontSize: 15,
    color: "#DC2626",
  },
});
