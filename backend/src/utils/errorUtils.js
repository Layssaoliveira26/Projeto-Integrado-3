// Utilitário para padronização e criação de erros da aplicação com código de status HTTP
const criarErro = (mensagem, statusCode = 400) => {
  const error = new Error(mensagem);
  error.statusCode = statusCode;
  return error;
};

module.exports = {
  criarErro,
};
