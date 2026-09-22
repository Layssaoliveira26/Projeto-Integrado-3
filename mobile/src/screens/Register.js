import React, { useState } from "react";
import { useWindowDimensions } from "react-native";
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

export default function RegisterScreen({ navigation }) {
  const { registrar } = useAuth();
  const { height } = useWindowDimensions();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  const handleCadastrar = async () => {
    setMensagemErro("");

    const nomeLimpo = nome.trim();
    const emailLimpo = email.trim();
    if (!nomeLimpo || !emailLimpo || !senha || !confirmarSenha) {
      setMensagemErro("Todos os campos são obrigatórios.");
      return;
    }

    if (!validarEmail(emailLimpo)) {
      setMensagemErro("Formato de e-mail inválido.");
      return;
    }

    if (senha.length < 8) {
      setMensagemErro("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    if (senha !== confirmarSenha) {
      setMensagemErro("As senhas não coincidem.");
      return;
    }

    try {
      setCarregando(true);
      await registrar({ nome: nomeLimpo, email: emailLimpo, senha });
    } catch (error) {
      const mensagem = error.message || "Erro ao realizar cadastro.";
      setMensagemErro(mensagem);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <FundoGradiente>
      <CardAutenticacao style={{ minHeight: height * 0.82, paddingVertical: 44 }}>
        {/* Logo */}
        <Logo />

        {/* Título */}
        <Titulo style={{ marginBottom: 18 }}>Criar conta</Titulo>

        {/* Campo Nome */}
        <InputTexto
          rotulo="Nome:"
          value={nome}
          onChangeText={(texto) => {
            setNome(texto);
            if (mensagemErro) setMensagemErro("");
          }}
          autoCapitalize="words"
          accessibilityHint="Digite seu nome completo"
          style={{ marginBottom: 10 }}
        />

        {/* Campo E-mail */}
        <InputTexto
          rotulo="E-mail:"
          value={email}
          onChangeText={(texto) => {
            setEmail(texto);
            if (mensagemErro) setMensagemErro("");
          }}
          keyboardType="email-address"
          autoCapitalize="none"
          accessibilityHint="Digite seu e-mail para cadastro"
          style={{ marginBottom: 10 }}
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
          accessibilityHint="Digite sua senha com no mínimo 8 caracteres"
          style={{ marginBottom: 10 }}
        />

        {/* Confirmar senha */}
        <InputTexto
          rotulo="Confirmar senha:"
          value={confirmarSenha}
          onChangeText={(texto) => {
            setConfirmarSenha(texto);
            if (mensagemErro) setMensagemErro("");
          }}
          secureTextEntry
          accessibilityHint="Confirme sua senha digitando-a novamente"
          style={{ marginBottom: 10 }}
        />

        {/* Botão Criar conta*/}
        <Botao
          titulo="Criar conta"
          onPress={handleCadastrar}
          carregando={carregando}
          accessibilityHint="Toque para criar sua conta"
          style={{ marginTop: 8 }}
        />

        {/* Mensagem de Erro*/}
        <MensagemErro
          mensagem={mensagemErro}
          style={{ minHeight: 18, marginTop: 8, marginBottom: 14 }}
        />

        {/* Rodapé*/}
        <RodapeAutenticacao
          texto="Já possui uma conta?"
          textoLink="Entrar."
          onPress={() => navigation && navigation.navigate("Login")}
          accessibilityHint="Volta para a tela de login"
        />
      </CardAutenticacao>
    </FundoGradiente>
  );
}
