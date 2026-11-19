const userRepository = require("../repositories/userRepository");
const { gerarHash, compararSenha } = require("../utils/passwordUtils");
const { criarErro } = require("../utils/errorUtils");

const padronizarEmail = (email) => (typeof email === "string" ? email.toLowerCase().trim() : "");
const padronizarNome = (nome) => (typeof nome === "string" ? nome.trim().replace(/\s+/g, " ") : "");

const criarUsuario = async ({ nome, email, senha }) => {
  if (!nome || !email || !senha) {
    throw criarErro("Todos os campos (nome, email, senha) são obrigatórios", 400);
  }

  const nomePadronizado = padronizarNome(nome);
  if (nomePadronizado.length === 0) {
    throw criarErro("Nome inválido", 400);
  }

  const emailPadronizado = padronizarEmail(email);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailPadronizado)) {
    throw criarErro("Formato de e-mail inválido", 400);
  }

  if (typeof senha !== "string" || senha.length < 8) {
    throw criarErro("A senha deve conter no mínimo 8 caracteres", 400);
  }

  const usuarioExistente = await userRepository.buscarPorEmail(emailPadronizado);
  if (usuarioExistente) {
    throw criarErro("E-mail já cadastrado", 409);
  }

  const senhaHash = await gerarHash(senha);
  const novoUsuario = await userRepository.criar({
    nome: nomePadronizado,
    email: emailPadronizado,
    senhaHash,
  });

  const { senha_hash, ...usuarioPublico } = novoUsuario;

  return { ...usuarioPublico };
};

const obterPerfil = async (id) => {
  if (!id) {
    throw criarErro("ID do usuário é obrigatório", 400);
  }

  const usuario = await userRepository.buscarPorId(id);
  if (!usuario) {
    throw criarErro("Usuário não encontrado", 404);
  }

  const { senha_hash, ...usuarioPublico } = usuario;

  return { ...usuarioPublico };
};

const atualizarPerfil = async (id, { nome, email, novaSenha, senhaAtual, fotoUrl }) => {
  if (!id) {
    throw criarErro("ID do usuário é obrigatório", 400);
  }

  const usuarioAtual = await userRepository.buscarPorIdComSenha(id);
  if (!usuarioAtual) {
    throw criarErro("Usuário não encontrado", 404);
  }

  const atualizacoes = {};
  let alterouCredenciais = false;

  if (nome !== undefined) {
    const nomePadronizado = padronizarNome(nome);
    if (!nomePadronizado) {
      throw criarErro("Nome inválido", 400);
    }
    if (nomePadronizado !== usuarioAtual.nome) {
      atualizacoes.nome = nomePadronizado;
    }
  }

  if (email !== undefined) {
    const emailPadronizado = padronizarEmail(email);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailPadronizado)) {
      throw criarErro("Formato de e-mail inválido", 400);
    }
    if (emailPadronizado !== usuarioAtual.email) {
      const existente = await userRepository.buscarPorEmail(emailPadronizado);
      if (existente && existente.id !== id) {
        throw criarErro("E-mail já cadastrado", 409);
      }
      atualizacoes.email = emailPadronizado;
      alterouCredenciais = true;
    }
  }

  if (novaSenha !== undefined && novaSenha !== "") {
    if (typeof novaSenha !== "string" || novaSenha.length < 8) {
      throw criarErro("A nova senha deve conter no mínimo 8 caracteres", 400);
    }
    atualizacoes.senhaHash = await gerarHash(novaSenha);
    alterouCredenciais = true;
  }

  if (fotoUrl !== undefined) {
    if (fotoUrl !== null && typeof fotoUrl !== "string") {
      throw criarErro("Formato de foto de perfil inválido", 400);
    }
    atualizacoes.fotoUrl = fotoUrl;
  }

  if (alterouCredenciais) {
    if (!senhaAtual || typeof senhaAtual !== "string") {
      throw criarErro("Informe a senha atual para alterar e-mail ou senha", 400);
    }
    const senhaCorreta = await compararSenha(senhaAtual, usuarioAtual.senha_hash);
    if (!senhaCorreta) {
      throw criarErro("Senha atual incorreta", 401);
    }
  }

  const usuarioAtualizado = await userRepository.atualizarPerfil(id, atualizacoes);
  const { senha_hash, ...usuarioPublico } = usuarioAtualizado;

  return { ...usuarioPublico };
};

module.exports = {
  criarUsuario,
  obterPerfil,
  atualizarPerfil,
  padronizarEmail,
  padronizarNome,
};