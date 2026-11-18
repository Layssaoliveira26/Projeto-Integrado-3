import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import NetInfo from "@react-native-community/netinfo";
import * as FileSystem from "expo-file-system/legacy";
import {
  obterToken,
  obterUsuarioLocal,
  salvarUsuarioLocal as salvarUsuarioStorage,
} from "../services/storage";
import authService from "../services/authService";
import usuarioRepository from "../repositories/usuarioRepository";

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [token, setToken] = useState(null);
  const [carregando, setCarregando] = useState(true);

  const sincronizarPerfilPendente = useCallback(async () => {
    try {
      const state = await NetInfo.fetch();
      if (!state.isConnected) return;

      const pendencias = await usuarioRepository.listarPendenciasPerfil();
      if (!pendencias || pendencias.length === 0) return;

      for (const item of pendencias) {
        try {
          const payload = JSON.parse(item.payload || "{}");
          const corpo = {};

          if (payload.nome !== undefined) corpo.nome = payload.nome;

          if (payload.foto_local) {
            try {
              const info = await FileSystem.getInfoAsync(payload.foto_local);
              if (info.exists) {
                const base64 = await FileSystem.readAsStringAsync(payload.foto_local, {
                  encoding: FileSystem.EncodingType.Base64,
                });
                corpo.fotoUrl = `data:image/jpeg;base64,${base64}`;
              }
            } catch {}
          } else if (payload.fotoUrl !== undefined) {
            corpo.fotoUrl = payload.fotoUrl;
          }

          const resp = await authService.atualizarPerfilRemoto(corpo);
          if (resp?.usuario) {
            const salvo = await usuarioRepository.salvarUsuarioLocal({
              ...resp.usuario,
              foto_local: payload.foto_local || null,
            });
            setUsuario(salvo);
            await salvarUsuarioStorage(salvo);
          }
          await usuarioRepository.marcarPendenciaPerfilConcluida(item.id);
        } catch (err) {
          await usuarioRepository.registrarErroPendenciaPerfil(
            item.id,
            err?.message || "Erro ao sincronizar perfil"
          );
        }
      }
    } catch {}
  }, []);

  useEffect(() => {
    async function carregarSessao() {
      try {
        const [tokenSalvo, usuarioStorage] = await Promise.all([
          obterToken(),
          obterUsuarioLocal(),
        ]);

        if (tokenSalvo) {
          setToken(tokenSalvo);
          const local = await usuarioRepository.buscarUsuarioLocal();
          if (local) {
            setUsuario(local);
          } else if (usuarioStorage) {
            setUsuario(usuarioStorage);
          }

          try {
            await sincronizarPerfilPendente();
            const resposta = await authService.obterPerfil();
            if (resposta && resposta.usuario) {
              const salvo = await usuarioRepository.salvarUsuarioLocal(resposta.usuario);
              setUsuario(salvo);
              await salvarUsuarioStorage(salvo);
            }
          } catch (erroPerfil) {
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
  }, [sincronizarPerfilPendente]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && token) {
        sincronizarPerfilPendente();
      }
    });
    return () => unsubscribe();
  }, [token, sincronizarPerfilPendente]);

  const login = async ({ email, senha }) => {
    const resposta = await authService.login({ email, senha });
    if (resposta.token) {
      setToken(resposta.token);
    }
    if (resposta.usuario) {
      const salvo = await usuarioRepository.salvarUsuarioLocal(resposta.usuario);
      setUsuario(salvo);
      await salvarUsuarioStorage(salvo);
    }
    return resposta;
  };

  const registrar = async ({ nome, email, senha }) => {
    const resposta = await authService.registrar({ nome, email, senha });
    if (resposta.token) {
      setToken(resposta.token);
    }
    if (resposta.usuario) {
      const salvo = await usuarioRepository.salvarUsuarioLocal(resposta.usuario);
      setUsuario(salvo);
      await salvarUsuarioStorage(salvo);
    }
    return resposta;
  };

  const atualizarDadosUsuario = async ({ nome, email, novaSenha, senhaAtual, fotoLocalUri }) => {
    if (!usuario?.id) throw new Error("Usuário não autenticado.");

    const netState = await NetInfo.fetch();
    const online = Boolean(netState.isConnected && netState.isInternetReachable !== false);

    const alterouEmail = email !== undefined && email.toLowerCase().trim() !== (usuario.email || "").toLowerCase().trim();
    const alterouSenha = Boolean(novaSenha && novaSenha.length > 0);

    if ((alterouEmail || alterouSenha) && !online) {
      throw new Error("Conecte-se à internet para alterar e-mail ou senha.");
    }

    let caminhoFotoPersistido = usuario.foto_local || null;
    let fotoBase64DataUrl = undefined;

    if (fotoLocalUri && fotoLocalUri !== usuario.foto_local) {
      const dir = `${FileSystem.documentDirectory}avatares/`;
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      const destino = `${dir}avatar_${usuario.id}_${Date.now()}.jpg`;
      await FileSystem.copyAsync({ from: fotoLocalUri, to: destino });
      caminhoFotoPersistido = destino;

      const base64 = await FileSystem.readAsStringAsync(destino, {
        encoding: FileSystem.EncodingType.Base64,
      });
      fotoBase64DataUrl = `data:image/jpeg;base64,${base64}`;
    }

    if (online) {
      try {
        const corpo = {};
        if (nome !== undefined) corpo.nome = nome;
        if (alterouEmail) corpo.email = email;
        if (alterouSenha) corpo.novaSenha = novaSenha;
        if (senhaAtual) corpo.senhaAtual = senhaAtual;
        if (fotoBase64DataUrl !== undefined) corpo.fotoUrl = fotoBase64DataUrl;

        const resp = await authService.atualizarPerfilRemoto(corpo);
        const atualizado = await usuarioRepository.salvarUsuarioLocal({
          ...(resp?.usuario || usuario),
          nome: nome ?? usuario.nome,
          email: email ?? usuario.email,
          foto_local: caminhoFotoPersistido,
        });
        setUsuario(atualizado);
        await salvarUsuarioStorage(atualizado);
        return { sincronizado: true, usuario: atualizado };
      } catch (err) {
        if (err.status && err.status !== 0) {
          throw err;
        }
        if (alterouEmail || alterouSenha) {
          throw new Error("Sem conexão com o servidor para alterar e-mail ou senha.");
        }
      }
    }

    const atualizadoLocal = await usuarioRepository.salvarUsuarioLocal({
      ...usuario,
      nome: nome ?? usuario.nome,
      foto_local: caminhoFotoPersistido,
    });

    await usuarioRepository.enfileirarAtualizacaoPerfil(usuario.id, {
      nome: nome ?? usuario.nome,
      foto_local: caminhoFotoPersistido,
    });

    setUsuario(atualizadoLocal);
    await salvarUsuarioStorage(atualizadoLocal);
    return { sincronizado: false, usuario: atualizadoLocal };
  };

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
        atualizarDadosUsuario,
        sincronizarPerfilPendente,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth deve ser utilizado dentro de um AuthProvider");
  }
  return contexto;
}

export default AuthContext;