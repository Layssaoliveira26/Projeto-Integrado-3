import { Platform } from "react-native";
import Constants from "expo-constants";
import { obterToken } from "./storage";

const IMAGENS_OBRAS = [
  require("../utils/img/obra1.jpg"),
  require("../utils/img/obra2.jpg"),
  require("../utils/img/obra3.jpg"),
  require("../utils/img/obra4.jpg"),
  require("../utils/img/obra5.jpg"),
  require("../utils/img/obra6.jpg"),
];

// ─── URL Base ──────────────────────────────────────────────────────────────────

const obterUrlBase = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoClient?.hostUri ||
    Constants.manifest?.debuggerHost;

  if (hostUri) {
    const ip = hostUri.split(":")[0];
    if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
      return `http://${ip}:3000`;
    }
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  return "http://localhost:3000";
};

export const API_URL = obterUrlBase();

// ─── Cliente HTTP Base ─────────────────────────────────────────────────────────

export const requisicao = async (endpoint, opcoes = {}) => {
  const url = `${API_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers = {
    "Content-Type": "application/json",
    ...(opcoes.headers || {}),
  };

  if (!opcoes.pularToken) {
    const token = await obterToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const resposta = await fetch(url, {
      ...opcoes,
      headers,
      signal: controller.signal,
    });

    const dados = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      let mensagemErro = "Não foi possível carregar as informações.";
      if (resposta.status === 401) {
        mensagemErro = "E-mail ou senha incorretos.";
      } else if (dados.mensagem || dados.erro || dados.message) {
        mensagemErro = dados.mensagem || dados.erro || dados.message;
      }

      const erro = new Error(mensagemErro);
      erro.status = resposta.status;
      erro.dados = dados;
      throw erro;
    }

    return dados;
  } catch (error) {
    if (error.name === "AbortError") {
      const erroTimeout = new Error(
        "Tempo de conexão esgotado. Tente novamente.",
      );
      erroTimeout.status = 0;
      throw erroTimeout;
    }

    if (!error.status) {
      const erroRede = new Error(
        "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
      );
      erroRede.status = 0;
      throw erroRede;
    }

    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatarValorMoeda(valor) {
  if (valor === undefined || valor === null || isNaN(Number(valor))) {
    return "0,00";
  }
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function obterImagemObra(index, id) {
  if (typeof index === "number") {
    return IMAGENS_OBRAS[index % IMAGENS_OBRAS.length];
  }
  let hash = 0;
  if (id && typeof id === "string") {
    for (let i = 0; i < id.length; i++) {
      hash = (hash + id.charCodeAt(i)) % IMAGENS_OBRAS.length;
    }
  }
  return IMAGENS_OBRAS[hash] || IMAGENS_OBRAS[0];
}

// ─── Funções de Obras ──────────────────────────────────────────────────────────

export async function listarObras() {
  return requisicao("/obras");
}

export async function obterEstruturaObra(obraId, cicloId = null) {
  try {
    const query = cicloId ? `?ciclo_id=${encodeURIComponent(cicloId)}` : "";
    return await requisicao(`/obras/estrutura/${obraId}${query}`);
  } catch (error) {
    if (error.status === 404) {
      return null;
    }
    throw error;
  }
}

export async function listarObrasComProgresso() {
  const obras = await listarObras();

  if (!Array.isArray(obras) || obras.length === 0) {
    return [];
  }

  const resultados = await Promise.allSettled(
    obras.map((obra) => obterEstruturaObra(obra.id)),
  );

  return obras.map((obra, index) => {
    const resultadoEstrutura = resultados[index];
    const estrutura =
      resultadoEstrutura.status === "fulfilled"
        ? resultadoEstrutura.value
        : null;

    let totalServicos = 0;
    if (estrutura?.etapas && Array.isArray(estrutura.etapas)) {
      totalServicos = estrutura.etapas.reduce((acc, etapa) => {
        const count =
          etapa.total_servicos ??
          (Array.isArray(etapa.servicos) ? etapa.servicos.length : 0);
        return acc + count;
      }, 0);
    }

    const cicloNumero = estrutura?.ciclo_ativo?.numero_ciclo ?? 1;
    const progresso = Math.round(estrutura?.progresso_geral_percentual ?? 0);
    const valorFormatado = formatarValorMoeda(
      estrutura?.valor_orcado_total ?? 0,
    );

    return {
      id: obra.id,
      nome: obra.nome,
      ciclo: cicloNumero,
      servicos: totalServicos,
      valor: valorFormatado,
      progresso: progresso,
      imagem: obterImagemObra(index, obra.id),
      _raw: { obra, estrutura },
    };
  });
}

// ─── Export default (métodos HTTP genéricos usados por authService) ────────────

export default {
  get: (endpoint, opcoes) => requisicao(endpoint, { ...opcoes, method: "GET" }),

  post: (endpoint, corpo, opcoes) =>
    requisicao(endpoint, {
      ...opcoes,
      method: "POST",
      body: JSON.stringify(corpo),
    }),

  put: (endpoint, corpo, opcoes) =>
    requisicao(endpoint, {
      ...opcoes,
      method: "PUT",
      body: JSON.stringify(corpo),
    }),

  delete: (endpoint, opcoes) =>
    requisicao(endpoint, { ...opcoes, method: "DELETE" }),

  listarObras,
  obterEstruturaObra,
  listarObrasComProgresso,
};
