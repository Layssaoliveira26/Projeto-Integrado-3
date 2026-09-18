import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import FundoGradiente from "../components/FundoGradiente";
import CardAutenticacao from "../components/CardAutenticacao";
import Logo from "../components/Logo";
import InputTexto from "../components/InputTexto";
import Botao from "../components/Botao";
import { cores, fontes } from "../styles/theme";

export default function LoginScreen({ navigation }) {
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");

  const handleEntrar = () => {
    setMensagemErro("");

    const idLimpo = identificador.trim();
    if (!idLimpo || !senha) {
      setMensagemErro("Todos os campos são obrigatórios.");
      return;
    }

    if (navigation) {
      navigation.navigate("Home");
    }
  };

  return (
    <FundoGradiente>
      <CardAutenticacao>
        {/* Logo */}
        <Logo />

        {/* Título */}
        <Text style={styles.titulo} accessibilityRole="header">
          Entrar
        </Text>

        {/* E-mail */}
        <InputTexto
          rotulo="E-mail ou Nome de usuário:"
          value={identificador}
          onChangeText={(texto) => {
            setIdentificador(texto);
            if (mensagemErro) setMensagemErro("");
          }}
          accessibilityHint="Digite seu e-mail cadastrado ou nome de usuário"
        />

        {/* Senha */}
        <InputTexto
          rotulo="Senha:"
          value={senha}
          onChangeText={(texto) => {
            setSenha(texto);
            if (mensagemErro) setMensagemErro("");
          }}
          secureTextEntry
          accessibilityHint="Digite sua senha de acesso"
        />

        {/* Botão */}
        <Botao
          titulo="Entrar"
          onPress={handleEntrar}
          accessibilityHint="Toque para entrar na sua conta"
        />

        {/* Mensagem de Erro*/}
        <View
          style={styles.containerErro}
          accessibilityLiveRegion="polite"
        >
          <Text
            style={styles.textoErro}
            accessibilityRole={mensagemErro ? "alert" : undefined}
          >
            {mensagemErro || " "}
          </Text>
        </View>

        {/* Rodapé com link para cadastro */}
        <View style={styles.rodape}>
          <Text style={styles.rodapeTexto}>Não tem conta? </Text>
          <TouchableOpacity
            onPress={() => navigation && navigation.navigate("Register")}
            activeOpacity={0.7}
            accessible={true}
            accessibilityRole="link"
            accessibilityLabel="Criar conta"
            accessibilityHint="Navega para a tela de cadastro"
          >
            <Text style={styles.rodapeLink}>Criar conta.</Text>
          </TouchableOpacity>
        </View>
      </CardAutenticacao>
    </FundoGradiente>
  );
}

const styles = StyleSheet.create({
  titulo: {
    fontFamily: fontes.negrito,
    fontSize: 28,
    color: cores.titulo,
    marginBottom: 32,
  },
  containerErro: {
    width: "100%",
    minHeight: 22,
    marginTop: 10,
    marginBottom: 28,
    alignItems: "flex-end",
  },
  textoErro: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.erro,
    textAlign: "right",
  },
  rodape: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  rodapeTexto: {
    fontFamily: fontes.regular,
    fontSize: 13,
    color: cores.textoEscuro,
  },
  rodapeLink: {
    fontFamily: fontes.negrito,
    fontSize: 13,
    color: cores.textoEscuro,
  },
});
