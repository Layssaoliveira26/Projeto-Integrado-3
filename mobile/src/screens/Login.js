import React, { useState } from "react";
import FundoGradiente from "../components/FundoGradiente";
import CardAutenticacao from "../components/CardAutenticacao";
import Logo from "../components/Logo";
import Titulo from "../components/Titulo";
import InputTexto from "../components/InputTexto";
import Botao from "../components/Botao";
import MensagemErro from "../components/MensagemErro";
import RodapeAutenticacao from "../components/RodapeAutenticacao";
import { validarEmail } from "../utils/validacoes";
import { useAuth } from "../context/AuthContext";

export default function LoginScreen({ navigation }) {
  const { login } = useAuth();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleEntrar = async () => {
    setMensagemErro("");

    const idLimpo = identificador.trim();
    if (!idLimpo || !senha) {
      setMensagemErro("Todos os campos são obrigatórios.");
      return;
    }

    if (!validarEmail(idLimpo)) {
      setMensagemErro("Formato de e-mail inválido.");
      return;
    }

    try {
      setCarregando(true);
      await login({ email: idLimpo, senha });
    } catch (error) {
      const mensagem = error.message || "Erro ao realizar login.";
      setMensagemErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <FundoGradiente>
      <CardAutenticacao>
        {/* Logo */}
        <Logo />

        {/* Título */}
        <Titulo>Entrar</Titulo>

        {/* Campo E-mail*/}
        <InputTexto
          rotulo="E-mail:"
          value={identificador}
          onChangeText={(texto) => {
            setIdentificador(texto);
            if (mensagemErro) setMensagemErro("");
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityHint="Digite seu e-mail cadastrado"
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
          carregando={carregando}
          accessibilityHint="Toque para entrar na sua conta"
        />

        {/* Mensagem de Erro */}
        <MensagemErro mensagem={mensagemErro} />

        {/* Rodapé*/}
        <RodapeAutenticacao
          texto="Não tem conta?"
          textoLink="Criar conta."
          onPress={() => navigation && navigation.navigate("Register")}
          accessibilityHint="Navega para a tela de cadastro"
        />
      </CardAutenticacao>
    </FundoGradiente>
  );
}
