import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { CheckCircle2 } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  cores,
  fontes,
  shadows,
  rem,
  moderateScale,
} from "../styles/theme";

export default function ModalSucessoPerfil({
  visivel,
  titulo = "Sucesso",
  mensagem = "",
  textoBotao = "OK",
  onFechar,
}) {
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onFechar}
    >
      <View style={styles.fundo}>
        <View style={styles.card}>
          <View style={styles.iconeContainer}>
            <CheckCircle2
              color={cores.verdeAgua}
              size={moderateScale(40)}
              strokeWidth={2.2}
            />
          </View>

          <Text style={styles.titulo}>{titulo}</Text>
          <Text style={styles.mensagem}>{mensagem}</Text>

          <TouchableOpacity
            style={styles.botaoWrapper}
            onPress={onFechar}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.botao}
            >
              <Text style={styles.textoBotao}>{textoBotao}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(22),
    paddingVertical: moderateScale(26),
    paddingHorizontal: moderateScale(22),
    alignItems: "center",
    ...shadows.padrao,
  },
  iconeContainer: {
    width: moderateScale(64),
    height: moderateScale(64),
    borderRadius: moderateScale(32),
    backgroundColor: "rgba(64, 222, 181, 0.14)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: moderateScale(12),
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: rem(1.2),
    color: cores.titulo,
    marginBottom: moderateScale(6),
    textAlign: "center",
  },
  mensagem: {
    fontFamily: fontes.regular,
    fontSize: rem(0.84),
    color: cores.textoSecundario,
    textAlign: "center",
    lineHeight: moderateScale(19),
    marginBottom: moderateScale(20),
  },
  botaoWrapper: {
    width: "100%",
  },
  botao: {
    width: "100%",
    height: moderateScale(46),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotao: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.92),
    color: "#FFFFFF",
  },
});