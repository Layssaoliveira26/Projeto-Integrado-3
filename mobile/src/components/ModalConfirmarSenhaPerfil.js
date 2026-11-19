import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
} from "react-native";
import { Lock, Eye, EyeOff } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cores, fontes, rem, moderateScale } from "../styles/theme";
import { ESTILOS_BOTOES_MODAL } from "../styles/modalButtonStyles";
import { ESTILOS_COMPARTILHADOS_MODAL } from "./ModalFeedback";

export default function ModalConfirmarSenhaPerfil({
  visivel,
  carregando = false,
  erroExterno = "",
  onConfirmar,
  onCancelar,
}) {
  const insets = useSafeAreaInsets();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroLocal, setErroLocal] = useState("");
  const [alturaTeclado, setAlturaTeclado] = useState(0);

  useEffect(() => {
    const eventoMostrar =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const eventoOcultar =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subMostrar = Keyboard.addListener(eventoMostrar, (e) => {
      setAlturaTeclado(e.endCoordinates?.height || 0);
    });
    const subOcultar = Keyboard.addListener(eventoOcultar, () => {
      setAlturaTeclado(0);
    });

    return () => {
      subMostrar.remove();
      subOcultar.remove();
    };
  }, []);

  useEffect(() => {
    if (visivel) {
      setSenhaAtual("");
      setMostrarSenha(false);
      setErroLocal("");
    } else {
      setAlturaTeclado(0);
    }
  }, [visivel]);

  const handleConfirmar = () => {
    if (!senhaAtual.trim()) {
      setErroLocal("Informe sua senha atual para confirmar.");
      return;
    }
    setErroLocal("");
    onConfirmar?.(senhaAtual);
  };

  const handleCancelar = () => {
    if (!carregando) onCancelar?.();
  };

  const mensagemErro = erroExterno || erroLocal;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleCancelar}
    >
      <View
        style={[
          ESTILOS_COMPARTILHADOS_MODAL.overlay,
          {
            paddingTop: insets.top,
            paddingBottom: alturaTeclado > 0 ? alturaTeclado : insets.bottom,
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleCancelar}
          accessibilityLabel="Cancelar"
        />
        <View style={[ESTILOS_COMPARTILHADOS_MODAL.card, styles.card]}>
          <View style={ESTILOS_COMPARTILHADOS_MODAL.faixaTopo} />

          <View style={styles.conteudo}>
            <View style={styles.iconeContainer}>
              <Lock
                color="#1A8E9A"
                size={moderateScale(34)}
                strokeWidth={2.3}
              />
            </View>

            <Text style={styles.titulo}>Confirmar identidade</Text>
            <Text style={styles.mensagem}>
              Para alterar seu e-mail ou senha, insira sua senha atual.
            </Text>

            <View
              style={[
                styles.inputWrapper,
                mensagemErro ? styles.inputErro : null,
              ]}
            >
              <TextInput
                style={styles.input}
                placeholder="Senha atual"
                placeholderTextColor={cores.textoSecundario}
                secureTextEntry={!mostrarSenha}
                value={senhaAtual}
                onChangeText={(texto) => {
                  setSenhaAtual(texto);
                  if (erroLocal) setErroLocal("");
                }}
                editable={!carregando}
                autoFocus
              />
              <TouchableOpacity
                onPress={() => setMostrarSenha((prev) => !prev)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {mostrarSenha ? (
                  <EyeOff size={moderateScale(20)} color={cores.azulPetroleo} />
                ) : (
                  <Eye size={moderateScale(20)} color={cores.azulPetroleo} />
                )}
              </TouchableOpacity>
            </View>

            {mensagemErro ? (
              <Text style={styles.textoErro}>{mensagemErro}</Text>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                ESTILOS_BOTOES_MODAL.botao,
                ESTILOS_BOTOES_MODAL.botaoPrimario,
                styles.botaoConfirmarEspaco,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={handleConfirmar}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel="Confirmar alteração"
            >
              {carregando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>
                  Confirmar alteração
                </Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                ESTILOS_BOTOES_MODAL.botao,
                ESTILOS_BOTOES_MODAL.botaoSecundario,
                styles.botaoUltimo,
                pressed && ESTILOS_BOTOES_MODAL.botaoPressionado,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={handleCancelar}
              disabled={carregando}
              accessibilityRole="button"
              accessibilityLabel="Cancelar"
            >
              <Text style={ESTILOS_BOTOES_MODAL.textoBotao}>Cancelar</Text>
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
  },
  conteudo: {
    paddingHorizontal: moderateScale(24),
    paddingTop: moderateScale(24),
    paddingBottom: moderateScale(28),
    alignItems: "center",
  },
  iconeContainer: {
    width: moderateScale(56),
    height: moderateScale(56),
    borderRadius: moderateScale(28),
    backgroundColor: "rgba(26, 142, 154, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: moderateScale(10),
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
    fontSize: moderateScale(13),
    color: "#0F5F6E",
    textAlign: "center",
    lineHeight: moderateScale(18),
    marginBottom: moderateScale(16),
  },
  inputWrapper: {
    width: "100%",
    height: moderateScale(48),
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "rgba(15, 95, 110, 0.18)",
    marginBottom: moderateScale(8),
  },
  inputErro: {
    borderColor: "#E53935",
  },
  input: {
    flex: 1,
    fontFamily: fontes.media,
    fontSize: rem(0.9),
    color: cores.textoEscuro,
    paddingVertical: 0,
    marginRight: moderateScale(8),
  },
  textoErro: {
    width: "100%",
    fontFamily: fontes.media,
    fontSize: rem(0.78),
    color: "#E53935",
    marginBottom: moderateScale(10),
    textAlign: "left",
  },
  botaoConfirmarEspaco: {
    marginTop: moderateScale(8),
  },
  botaoUltimo: {
    marginBottom: 0,
  },
  botaoDesabilitado: {
    opacity: 0.7,
  },
});
