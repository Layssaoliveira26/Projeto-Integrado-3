import React, { useEffect, useId, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Circle, Defs, LinearGradient, Stop, Svg } from "react-native-svg";
import { Check } from "lucide-react-native";

import {
  fontes,
  gradienteCores,
  gradienteDistribuicaoCompleta,
  moderateScale,
} from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import { FEEDBACK } from "../constants/mensagensFeedback";

export const ESTILOS_COMPARTILHADOS_MODAL = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: moderateScale(36),
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  card: {
    width: "100%",
    maxWidth: moderateScale(380),
    borderRadius: moderateScale(18),
    overflow: "hidden",
    backgroundColor: "#F5F3EF",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 10,
  },
  faixaTopo: {
    height: moderateScale(14),
    backgroundColor: "#7EEA95",
  },
});

export default function ModalFeedback({
  visible,
  contexto,
  estado,
  tipo,
  titulo,
  mensagem,
  acoes,
}) {
  const estadoAtual = estado || tipo;
  const mensagensContexto = FEEDBACK[contexto];
  const mensagensEstado = mensagensContexto?.[estadoAtual];
  const rotacao = useRef(new Animated.Value(0)).current;
  const opacidade = useRef(new Animated.Value(1)).current;
  const escalaCheck = useRef(new Animated.Value(0.6)).current;
  const [acoesDesabilitadas, setAcoesDesabilitadas] = useState(false);
  const gradienteId = `modalFeedback${useId().replace(/:/g, "")}`;

  useEffect(() => {
    setAcoesDesabilitadas(false);
  }, [contexto, estadoAtual, visible]);

  useEffect(() => {
    if (!visible || !__DEV__) return;
    if (!mensagensContexto) {
      console.warn(`Contexto de feedback inexistente: "${contexto}".`);
    } else if (!mensagensEstado) {
      console.warn(
        `Estado de feedback inexistente para o contexto "${contexto}": "${estadoAtual}".`,
      );
    }
  }, [contexto, estadoAtual, mensagensContexto, mensagensEstado, visible]);

  useEffect(() => {
    if (!visible || estadoAtual !== "loading") return undefined;

    rotacao.setValue(0);
    const animacao = Animated.loop(
      Animated.timing(rotacao, {
        toValue: 1,
        duration: 900,
        useNativeDriver: true,
      }),
    );
    animacao.start();

    return () => animacao.stop();
  }, [estadoAtual, rotacao, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    opacidade.setValue(0);
    const animacao = Animated.timing(opacidade, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    animacao.start();

    return () => animacao.stop();
  }, [estadoAtual, opacidade, visible]);

  useEffect(() => {
    if (!visible || estadoAtual !== "sucesso") return undefined;

    escalaCheck.setValue(0.6);
    const animacao = Animated.spring(escalaCheck, {
      toValue: 1,
      speed: 18,
      bounciness: 5,
      useNativeDriver: true,
    });
    animacao.start();

    return () => animacao.stop();
  }, [escalaCheck, estadoAtual, visible]);

  const rotacaoInterpolada = rotacao.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleAcao = (acao) => {
    if (acoesDesabilitadas) return;
    setAcoesDesabilitadas(true);
    acao.onPress?.();
  };

  if (!visible || !mensagensEstado) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => {}}
    >
      <View style={ESTILOS_COMPARTILHADOS_MODAL.overlay}>
        <Animated.View
          style={[
            ESTILOS_COMPARTILHADOS_MODAL.card,
            estadoAtual === "sucesso" && styles.cardSucesso,
            { opacity: opacidade },
          ]}
        >
          <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />
          <View style={styles.conteudo}>
            {estadoAtual === "loading" ? (
              <Animated.View
                style={[
                  styles.spinner,
                  { transform: [{ rotate: rotacaoInterpolada }] },
                ]}
              >
                <Svg
                  width={moderateScale(44)}
                  height={moderateScale(44)}
                  viewBox="0 0 44 44"
                >
                  <Defs>
                    <LinearGradient
                      id={gradienteId}
                      x1="0%"
                      y1="0%"
                      x2="100%"
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
                  <Circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke="#E6E6E6"
                    strokeWidth="4"
                  />
                  <Circle
                    cx="22"
                    cy="22"
                    r="18"
                    fill="none"
                    stroke={`url(#${gradienteId})`}
                    strokeWidth="4"
                    strokeDasharray="28 85"
                    strokeLinecap="round"
                  />
                </Svg>
              </Animated.View>
            ) : (
              <Animated.View
                style={[
                  styles.iconeSucesso,
                  { transform: [{ scale: escalaCheck }] },
                ]}
              >
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
              </Animated.View>
            )}

            <Text style={styles.titulo}>{titulo ?? mensagensEstado.titulo}</Text>
            <Text style={styles.mensagem}>
              {mensagem ?? mensagensEstado.mensagem}
            </Text>
            {acoes?.length > 0 && (
              <View style={styles.acoes}>
                {acoes.map((acao, indice) => (
                  <Pressable
                    key={`${acao.rotulo}-${indice}`}
                    style={({ pressed }) => [
                      ESTILOS_BOTOES_MODAL.botao,
                      indice === 0
                        ? ESTILOS_BOTOES_MODAL.botaoPrimario
                        : ESTILOS_BOTOES_MODAL.botaoSecundario,
                      pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                      acoesDesabilitadas && styles.acoesDesabilitadas,
                    ]}
                    onPress={() => handleAcao(acao)}
                    disabled={acoesDesabilitadas}
                    accessibilityRole="button"
                    accessibilityLabel={acao.rotulo}
                  >
                    <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                      {acao.rotulo}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cardSucesso: {
    backgroundColor: "#DFF7EF",
  },
  conteudo: {
    alignItems: "center",
    paddingHorizontal: moderateScale(24),
    paddingVertical: moderateScale(28),
  },
  spinner: {
    width: moderateScale(44),
    height: moderateScale(44),
    marginBottom: moderateScale(16),
  },
  iconeSucesso: {
    height: moderateScale(44),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: moderateScale(16),
  },
  titulo: {
    marginBottom: moderateScale(8),
    color: "#1E3A5F",
    fontFamily: fontes.negrito,
    fontSize: moderateScale(20),
    textAlign: "center",
  },
  mensagem: {
    color: "#0F5F6E",
    fontFamily: fontes.media,
    fontSize: moderateScale(14),
    lineHeight: moderateScale(20),
    textAlign: "center",
  },
  acoes: {
    width: "100%",
    marginTop: moderateScale(16),
  },
  acoesDesabilitadas: {
    opacity: 0.7,
  },
});
