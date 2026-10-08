import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Home, Layers, Image as ImageIcon, Plus } from "lucide-react-native";

import {
  cores,
  bordas,
  fontes,
  shadows,
  gradianteDistribuicaoDownload,
} from "../styles/theme";

// Abas da barra. "rota" é o nome da tela registrada no AppNavigator.
const ABAS = [
  { chave: "Obras", rota: "Home", Icone: Home },
  { chave: "Ciclos", rota: "Ciclos", Icone: Layers },
  { chave: "Fotos", rota: "Fotos", Icone: ImageIcon },
];

export default function NavBar({ abaAtiva = "Obras" }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const handlePressAba = (aba) => {
    if (aba.chave === abaAtiva) return;

    // Ciclos e Fotos ainda não têm tela registrada. Só navega se a rota
    // existir, evitando erro de "rota não encontrada" até serem criadas.
    const rotasRegistradas = navigation.getState()?.routeNames || [];
    if (rotasRegistradas.includes(aba.rota)) {
      navigation.navigate(aba.rota);
    }
  };

  const handlePressNovaObra = () => {
    navigation.navigate("NovaObra");
  };

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View
        style={[styles.barra, { paddingBottom: Math.max(insets.bottom, 12) }]}
      >
        <View style={styles.abas}>
          {ABAS.map((aba) => {
            const ativa = aba.chave === abaAtiva;
            const cor = ativa ? cores.verdeAgua : cores.azulPetroleo;
            const Icone = aba.Icone;

            return (
              <TouchableOpacity
                key={aba.chave}
                style={styles.aba}
                onPress={() => handlePressAba(aba)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={aba.chave}
                accessibilityState={{ selected: ativa }}
              >
                <Icone color={cor} size={28} strokeWidth={2.2} />
                <Text style={[styles.abaTexto, { color: cor }]}>
                  {aba.chave}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Botão flutuante "+" sobreposto à barra */}
      <TouchableOpacity
        style={styles.fabWrapper}
        onPress={handlePressNovaObra}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Cadastrar nova obra"
      >
        <LinearGradient
          colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
          locations={gradianteDistribuicaoDownload}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.fab}
        >
          <Plus color="rgba(255, 255, 255, 0.85)" size={50} strokeWidth={3.5} />
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  barra: {
    backgroundColor: cores.fundoCard,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    paddingTop: 18,
    paddingLeft: 20,
    paddingRight: 120,
    ...shadows.padrao,
    shadowOffset: { width: 0, height: -2 },
  },
  abas: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  aba: {
    alignItems: "center",
    minWidth: 64,
  },
  abaTexto: {
    fontFamily: fontes.semiNegrito,
    fontSize: 12,
    marginTop: 4,
  },
  fabWrapper: {
    position: "absolute",
    right: 25,
    top: -30,
    width: 95,
    height: 95,
    borderRadius: 100,
    ...shadows.padrao,
  },
  fab: {
    width: "100%",
    height: "100%",
    borderRadius: 100,
    justifyContent: "center",
    alignItems: "center",
  },
});
