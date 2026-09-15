// Utilitário para padronização e criação de erros da aplicação com código de status HTTP
const criarErro = (mensagem, statusCode = 400) => {
  const error = new Error(mensagem);
  error.statusCode = statusCode;
  return error;
};

const tratarErro = (res, error) => {
  const statusCode = error.statusCode || 500;
  return res.status(statusCode).json({
    mensagem: error.message || "Erro interno do servidor",
  });
};

module.exports = {
  criarErro,
  tratarErro,
};
