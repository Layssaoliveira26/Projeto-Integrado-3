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

export default function RegisterScreen({ navigation }) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [mensagemErro, setMensagemErro] = useState("");

  const handleCadastrar = () => {
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

    // Sucesso na validação (integração com API na próxima etapa)
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
        <Titulo>Criar conta</Titulo>

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
        />

        {/* Botão Cadastrar*/}
        <Botao
          titulo="Cadastrar"
          onPress={handleCadastrar}
          accessibilityHint="Toque para criar sua conta"
        />

        {/* Mensagem de Erro */}
        <MensagemErro mensagem={mensagemErro} />

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
