import React, { useId } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Defs, LinearGradient, Stop } from "react-native-svg";
import { Check } from "lucide-react-native";
import {
  fontes,
  gradienteCores,
  gradienteDistribuicaoCompleta,
  moderateScale,
} from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";

export default function ModalSucessoPerfil({
  visivel,
  titulo = "Sucesso",
  mensagem = "",
  textoBotao = "Certo",
  onFechar = () => {},
}) {
  const gradienteId = `modalSucessoPerfil${useId().replace(/:/g, "")}`;

  if (!visivel) return null;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onFechar}
    >
      <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onFechar}
          accessibilityLabel={textoBotao}
        />
        <View style={[ESTILOS_COMPARTILHADOS_MODAL.card, styles.card]}>
          <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />

          <View style={styles.conteudo}>
            <View style={styles.iconeSucesso}>
              <Check
                color={`url(#${gradienteId})`}
                size={moderateScale(40)}
                strokeWidth={2.8}
              >
                <Defs>
                  <LinearGradient
                    id={gradienteId}
                    x1="0%"
                    y1="0%"
                    x2="0%"
                    y2="100%"
                  >
                    {gradienteCores.map((cor, indice) => (
                      <Stop
                        key={`${cor}-${indice}`}
                        offset={`${gradienteDistribuicaoCompleta[indice] * 100}%`}
                        stopColor={cor}
                      />
                    ))}
                  </LinearGradient>
                </Defs>
              </Check>
            </View>

            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.mensagem}>{mensagem}</Text>

            <Pressable
              style={({ pressed }) => [
                ESTILOS_BOTOES_MODAL.botao,
                ESTILOS_BOTOES_MODAL.botaoSecundario,
                styles.botaoUnico,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
              ]}
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel={textoBotao}
            >
              <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>{textoBotao}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "stretch",
    backgroundColor: "#DFF7EF",
  },
  conteudo: {
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(28),
  },
  iconeSucesso: {
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(16),
  },
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: moderateScale(20),
    color: "#1E3A5F",
    marginBottom: moderateScale(8),
    textAlign: "center",
  },
  mensagem: {
    fontFamily: fontes.media,
    fontSize: moderateScale(14),
    color: "#0F5F6E",
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginBottom: moderateScale(20),
  },
  botaoUnico: {
    marginBottom: 0,
  },
});
