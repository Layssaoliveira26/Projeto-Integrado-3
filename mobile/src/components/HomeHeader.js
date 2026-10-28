import React from "react";
import { View, Text, Image, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

import {
  cores,
  bordas,
  fontes,
  shadows,
  gradienteCores,
  gardianteDistribuicaoHeader,
  gradienteDistribuicaoCompleta,
  rem,
  moderateScale,
} from "../styles/theme";

export default function HomeHeader({ onLogout }) {
  return (
    <LinearGradient
      colors={[cores.azulPetroleo, cores.azulEsverdeado]}
      locations={gardianteDistribuicaoHeader}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.container}
    >
      <View style={styles.marca}>
        <LinearGradient
          colors={gradienteCores}
          locations={gradienteDistribuicaoCompleta}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.logoBolinha}
        />
        <Text style={styles.logo}>Metria</Text>
      </View>

      <View style={styles.areaAcoes}>
        {onLogout ? (
          <TouchableOpacity
            style={styles.botaoLogout}
            onPress={onLogout}
            activeOpacity={0.8}
            accessibilityLabel="Sair da conta"
          >
            <Ionicons
              name="log-out-outline"
              size={moderateScale(26)}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        ) : null}

        <Image
          source={require("../utils/img/avatar.png")}
          style={styles.avatar}
        />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: moderateScale(20),
    paddingTop: moderateScale(14),
    paddingBottom: moderateScale(14),
    borderBottomLeftRadius: moderateScale(bordas.header),
    borderBottomRightRadius: moderateScale(bordas.header),
    ...shadows.padrao,
  },
  marca: {
    flexDirection: "row",
    alignItems: "center",
  },
  logoBolinha: {
    width: moderateScale(26),
    height: moderateScale(26),
    borderRadius: moderateScale(13),
    marginRight: moderateScale(10),
  },
  logo: {
    fontFamily: fontes.semiNegrito,
    fontSize: rem(1.2),
    color: "#FFFFFF",
    paddingTop: moderateScale(3),
  },
  areaAcoes: {
    flexDirection: "row",
    alignItems: "center",
  },
  botaoLogout: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
    alignItems: "center",
    justifyContent: "center",
    marginRight: moderateScale(8),
  },
  avatar: {
    width: moderateScale(32),
    height: moderateScale(32),
    borderRadius: moderateScale(16),
  },
});

