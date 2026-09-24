import axios from "axios";

const api = axios.create({
  baseURL: "http://172.20.10.6:3000",
});

// TOKEN TEMPORÁRIO PARA DESENVOLVIMENTO
const TOKEN_TEMPORARIO = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6Ijc0ZDk4ZGZjLTY4MzYtNGY4ZC05NDRiLWQ1NDhlNmRlY2E2MiIsImVtYWlsIjoiZ2FicmllbEBvYnJhLmNvbSIsImlhdCI6MTc5MDIwNzQxOH0.VbBppV9kSotz8P7L9tm41a_SnJD-jlvHXJ3DcxySBus";

api.interceptors.request.use(async (config) => {
  // Injeta o token automaticamente em TODAS as requisições
  config.headers.Authorization = `Bearer ${TOKEN_TEMPORARIO}`;
  return config;
});

export default api;