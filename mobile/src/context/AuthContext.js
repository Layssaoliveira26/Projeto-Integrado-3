import React, { createContext, useContext, useState, useEffect } from "react";
import { obterToken } from "../services/storage";
import authService from "../services/authService";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [carregando, setCarregando] = useState(true);

  // Restaura a sessão salva no dispositivo ao iniciar o aplicativo
  useEffect(() => {
    async function carregarSessao() {
      try {
        const tokenSalvo = await obterToken();
        if (tokenSalvo) {
          setToken(tokenSalvo);
          try {
            const resposta = await authService.obterPerfil();
            if (resposta && resposta.usuario) {
              setUsuario(resposta.usuario);
            }
          } catch (erroPerfil) {
            // Se o token estiver expirado ou for inválido (401/403), encerra a sessão
            if (erroPerfil.status === 401 || erroPerfil.status === 403) {
              await authService.logout();
              setToken(null);
              setUsuario(null);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao carregar sessão:", error);
      } finally {
        setCarregando(false);
      }
    }

    carregarSessao();
  }, []);

  // Realiza o login com email e senha
  const login = async ({ email, senha }) => {
    const resposta = await authService.login({ email, senha });
    if (resposta.token) {
      setToken(resposta.token);
    }
    if (resposta.usuario) {
      setUsuario(resposta.usuario);
    }
    return resposta;
  };

  // Cadastra um novo usuário e já autentica a sessão
  const registrar = async ({ nome, email, senha }) => {
    const resposta = await authService.registrar({ nome, email, senha });
    if (resposta.token) {
      setToken(resposta.token);
    }
    if (resposta.usuario) {
      setUsuario(resposta.usuario);
    }
    return resposta;
  };

  // Encerra a sessão atual e limpa os dados
  const logout = async () => {
    await authService.logout();
    setToken(null);
    setUsuario(null);
  };

  return (
    <AuthContext.Provider
      value={{
        usuario,
        token,
        autenticado: Boolean(token && usuario),
        carregando,
        login,
        registrar,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Hook de conveniência para acessar o contexto de autenticação
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return contexto;
}

export default AuthContext;
