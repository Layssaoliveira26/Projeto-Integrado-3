import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  Platform,
  StyleSheet,
} from "react-native";
import { Lock, Eye, EyeOff } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  cores,
  fontes,
  shadows,
  rem,
  moderateScale,
} from "../styles/theme";

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

  const mensagemErro = erroExterno || erroLocal;

  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!carregando) onCancelar?.();
      }}
    >
      <View
        style={[
          styles.fundo,
          {
            paddingTop: insets.top,
            paddingBottom: alturaTeclado > 0 ? alturaTeclado : insets.bottom,
          },
        ]}
      >
        <View style={styles.card}>
          <View style={styles.iconeContainer}>
            <Lock color={cores.ciano} size={moderateScale(36)} strokeWidth={2.2} />
          </View>

          <Text style={styles.titulo}>Confirmar identidade</Text>
          <Text style={styles.mensagem}>
            Para alterar seu e-mail ou senha, insira sua senha atual.
          </Text>

          <View style={[styles.inputWrapper, mensagemErro ? styles.inputErro : null]}>
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

          {mensagemErro ? <Text style={styles.textoErro}>{mensagemErro}</Text> : null}

          <TouchableOpacity
            style={styles.botaoConfirmarWrapper}
            onPress={handleConfirmar}
            disabled={carregando}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[cores.ciano, cores.verdeAgua, cores.verdeClaro]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={styles.botaoConfirmar}
            >
              {carregando ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.textoBotaoConfirmar}>Confirmar alteração</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoCancelar}
            onPress={onCancelar}
            disabled={carregando}
            activeOpacity={0.85}
          >
            <Text style={styles.textoBotaoCancelar}>Cancelar</Text>
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
    width: moderateScale(60),
    height: moderateScale(60),
    borderRadius: moderateScale(30),
    backgroundColor: "rgba(9, 209, 199, 0.12)",
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
    fontSize: rem(0.82),
    color: cores.textoSecundario,
    textAlign: "center",
    lineHeight: moderateScale(18),
    marginBottom: moderateScale(16),
  },
  inputWrapper: {
    width: "100%",
    height: moderateScale(48),
    backgroundColor: cores.fundoInput,
    borderRadius: moderateScale(12),
    paddingHorizontal: moderateScale(14),
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "transparent",
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
  botaoConfirmarWrapper: {
    width: "100%",
    marginTop: moderateScale(6),
    marginBottom: moderateScale(10),
  },
  botaoConfirmar: {
    width: "100%",
    height: moderateScale(46),
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoConfirmar: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.92),
    color: "#FFFFFF",
  },
  botaoCancelar: {
    width: "100%",
    height: moderateScale(46),
    backgroundColor: cores.titulo,
    borderRadius: moderateScale(12),
    justifyContent: "center",
    alignItems: "center",
  },
  textoBotaoCancelar: {
    fontFamily: fontes.negrito,
    fontSize: rem(0.92),
    color: "#FFFFFF",
  },
});