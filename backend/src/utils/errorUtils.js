// Utilitário para padronização e criação de erros da aplicação com código de status HTTP
const criarErro = (mensagem, statusCode = 400) => {
  const error = new Error(mensagem);
  error.statusCode = statusCode;
  return error;
};

const tratarErro = (res, error) => {
  if (error?.code === "22P02") {
    return res.status(400).json({
      erro: "Identificador em formato inválido.",
      mensagem: "Identificador em formato inválido.",
    });
  }
  if (error?.code === "22007" || error?.code === "22008") {
    return res.status(400).json({
      erro: "Data informada em formato inválido.",
      mensagem: "Data informada em formato inválido.",
    });
  }

  const statusCode = error?.statusCode || error?.status || 500;
  const mensagem =
    statusCode >= 500 && !error?.statusCode && !error?.status
      ? "Erro interno do servidor"
      : error?.message || "Erro interno do servidor";

  return res.status(statusCode).json({
    mensagem,
  });
};

module.exports = {
  criarErro,
  tratarErro,
};
