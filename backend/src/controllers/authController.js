// Controlador responsável por intermediar as requisições HTTP e as respostas dos serviços de autenticação
const authService = require("../services/authService");
const userService = require("../services/userService");
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

module.exports = {
  registrar,
  login,
  perfil,
};
