const authService = require("../services/authService");
const userService = require("../services/userService");
const { gerarToken } = require("../utils/jwtUtils");
const { tratarErro } = require("../utils/errorUtils");

const registrar = async (req, res) => {
  try {
    const { nome, email, senha } = req.body || {};
    const resultado = await authService.registrar({ nome, email, senha });
    return res.status(201).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

const login = async (req, res) => {
  try {
    const { email, senha } = req.body || {};
    const resultado = await authService.login({ email, senha });
    return res.status(200).json(resultado);
  } catch (error) {
    return tratarErro(res, error);
  }
};

const perfil = async (req, res) => {
  try {
    const id = req.user?.id;
    const usuario = await userService.obterPerfil(id);
    return res.status(200).json({ usuario });
  } catch (error) {
    return tratarErro(res, error);
  }
};

const atualizarPerfil = async (req, res) => {
  try {
    const id = req.user?.id;
    const body = req.body || {};
    const nome = body.nome;
    const email = body.email;
    const novaSenha =
      body.novaSenha !== undefined ? body.novaSenha : body.nova_senha;
    const senhaAtual =
      body.senhaAtual !== undefined ? body.senhaAtual : body.senha_atual;
    const fotoUrl =
      body.fotoUrl !== undefined ? body.fotoUrl : body.foto_url;

    const usuario = await userService.atualizarPerfil(id, {
      nome,
      email,
      novaSenha,
      senhaAtual,
      fotoUrl,
    });
    const token = gerarToken({ id: usuario.id, email: usuario.email });
    return res.status(200).json({ usuario, token });
  } catch (error) {
    return tratarErro(res, error);
  }
};

module.exports = {
  registrar,
  login,
  perfil,
  atualizarPerfil,
};