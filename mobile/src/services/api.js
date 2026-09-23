import authStorage from "./authStorage";

const IMAGENS_OBRAS = [
  require("../utils/img/obra (1).jpg"),
  require("../utils/img/obra (2).jpg"),
  require("../utils/img/obra (3).jpg"),
  require("../utils/img/obra (4).jpg"),
  require("../utils/img/obra (5).jpg"),
  require("../utils/img/obra (6).jpg"),
];

const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL || "http://10.0.2.2:3000"
).replace(/\/$/, "");

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const token = authStorage.getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Tempo de conexão esgotado. Tente novamente.");
    }
    throw new Error(
      "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    let errorData = null;
    try {
      errorData = await response.json();
    } catch {
      // resposta sem corpo json
    }

    let mensagem = "Não foi possível carregar as informações.";
    if (response.status === 401) {
      mensagem = "Sessão expirada ou não autorizada.";
    } else if (errorData?.erro || errorData?.mensagem) {
      mensagem = errorData.erro || errorData.mensagem;
    }

    const erro = new Error(mensagem);
    erro.status = response.status;
    erro.data = errorData;
    throw erro;
  }

  return response.json();
}

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

export async function listarObras() {
  return request("/obras");
}

export async function obterEstruturaObra(obraId, cicloId = null) {
  try {
    const query = cicloId ? `?ciclo_id=${encodeURIComponent(cicloId)}` : "";
    return await request(`/obras/estrutura/${obraId}${query}`);
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
      _raw: {
        obra,
        estrutura,
      },
    };
  });
}

export default {
  listarObras,
  obterEstruturaObra,
  listarObrasComProgresso,
};
