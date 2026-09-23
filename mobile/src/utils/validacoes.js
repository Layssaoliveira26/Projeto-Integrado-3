// Funções utilitárias de validação de formulários

// Valida o formato de um endereço de e-mail.
export const validarEmail = (email) => {
  if (!email || typeof email !== "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.toLowerCase().trim());
};
