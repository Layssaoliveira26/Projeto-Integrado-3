import { Platform, Linking, Alert } from "react-native";
import Constants from "expo-constants";
import { obterToken, obterUsuarioLocal } from "./storage";
import {
  criarObraLocal,
  listarObrasLocais,
  obterObraLocalPorId,
  atualizarObraLocal,
  arquivarObraLocal,
  deletarObraLocal,
  salvarEstruturaPlanilhaLocal,
  obterEstruturaObraLocal,
  upsertObraSincronizada,
} from "../repositories/obraLocalRepository";
import { upsertCicloSincronizado } from "../repositories/cicloLocalRepository";
import { upsertMedicaoSincronizada } from "../repositories/medicaoLocalRepository";
import {
  configurarClienteHttpSync,
  agendarSincronizacao,
  sincronizarTudo,
} from "../sync/syncManager";

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
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location) {
      const hostname = window.location.hostname || "localhost";
      return `http://${hostname}:3000`;
    }
    return "http://localhost:3000";
  }

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
console.log("[API] Conectando ao backend em:", API_URL);

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
      } else if (resposta.status === 404) {
        mensagemErro = "Rota não encontrada no servidor (404). Reconstrua o backend com: docker compose up -d --build backend";
      } else if (resposta.status >= 500) {
        mensagemErro = `Erro no servidor (${resposta.status}). Verifique se as tabelas do banco foram criadas.`;
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

// Registra a função de requisição no motor de sincronização sem acoplamento circular
configurarClienteHttpSync(requisicao);

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

// ─── Funções de Obras (Offline-First - RNF01 / RNF02 / RNF04) ─────────────────

export async function listarObras() {
  const usuario = await obterUsuarioLocal();
  const locais = await listarObrasLocais(usuario?.id).catch(() => []);

  if (Array.isArray(locais) && locais.length > 0) {
    // Dispara atualização em segundo plano sem bloquear a UI (RNF04)
    sincronizarTudo({ incluirPull: true }).catch(() => {});
    return locais;
  }

  try {
    const remotas = await requisicao("/obras");
    if (Array.isArray(remotas)) {
      for (const obra of remotas) {
        await upsertObraSincronizada(obra).catch(() => {});
      }
      return remotas;
    }
  } catch (error) {
    if (error.status === 0) {
      return locais || [];
    }
    throw error;
  }

  return [];
}

export async function criarObra(dados) {
  const usuario = await obterUsuarioLocal();
  const novaObra = await criarObraLocal({
    ...dados,
    usuarioId: usuario?.id || "local_user",
  });

  agendarSincronizacao();
  return novaObra;
}

export async function obterObra(id) {
  const local = await obterObraLocalPorId(id).catch(() => null);
  if (local) {
    return local;
  }

  const remota = await requisicao(`/obras/${id}`);
  if (remota) {
    await upsertObraSincronizada(remota).catch(() => {});
  }
  return remota;
}

export async function atualizarObra(id, dados) {
  const atualizada = await atualizarObraLocal(id, dados);
  agendarSincronizacao();
  return atualizada;
}

export async function deletarObra(id) {
  const deletada = await deletarObraLocal(id);
  agendarSincronizacao();
  return deletada;
}

export async function arquivarObra(id) {
  const arquivada = await arquivarObraLocal(id);
  agendarSincronizacao();
  return arquivada;
}

export async function obterEstruturaObra(obraId, cicloId = null) {
  const estruturaLocal = await obterEstruturaObraLocal(obraId, cicloId).catch(
    () => null
  );
  if (estruturaLocal && estruturaLocal.etapas && estruturaLocal.etapas.length > 0) {
    return estruturaLocal;
  }

  try {
    const query = cicloId ? `?ciclo_id=${encodeURIComponent(cicloId)}` : "";
    const estruturaRemota = await requisicao(`/obras/estrutura/${obraId}${query}`);
    if (estruturaRemota && Array.isArray(estruturaRemota.etapas)) {
      await salvarEstruturaPlanilhaLocal({
        obraId,
        etapas: estruturaRemota.etapas,
        sincronizado: true,
      }).catch(() => {});

      if (estruturaRemota.ciclo_ativo) {
        await upsertCicloSincronizado({
          ...estruturaRemota.ciclo_ativo,
          obra_id: obraId,
        }).catch(() => {});

        for (const etapa of estruturaRemota.etapas) {
          for (const s of etapa.servicos || []) {
            if (Number(s.valor_acumulado_atual || 0) > 0) {
              await upsertMedicaoSincronizada({
                ciclo_id: estruturaRemota.ciclo_ativo.id,
                servico_id: s.id,
                valor_acumulado_atual: s.valor_acumulado_atual,
                percentual_execucao: s.percentual_execucao,
              }).catch(() => {});
            }
          }
        }
      }
    }
    return estruturaRemota;
  } catch (error) {
    if (error.status === 404 || error.status === 0) {
      return estruturaLocal || null;
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
      estrutura?.valor_orcado_total ?? obra.orcamento_total ?? 0,
    );

    return {
      id: obra.id,
      nome: obra.nome,
      status: obra.status || "ativa",
      sync_status: obra.sync_status || "synced",
      ciclo: cicloNumero,
      servicos: totalServicos,
      valor: valorFormatado,
      progresso: progresso,
      imagem: obterImagemObra(index, obra.id),
      _raw: { obra, estrutura },
    };
  });
}

export async function importarPlanilhaBase(obraId, payload) {
  const resultadoLocal = await salvarEstruturaPlanilhaLocal({
    obraId,
    nomeArquivo: payload?.nome_arquivo || "planilha_padrao.xlsx",
    etapas: payload?.etapas || [],
    sincronizado: false,
  });

  agendarSincronizacao();

  return {
    sucesso: true,
    mensagem: "Planilha orçamentária importada com sucesso.",
    resumo: resultadoLocal,
  };
}

export function obterUrlModeloPlanilha() {
  return `${API_URL}/obras/modelo-planilha/planilha_padrao.xlsx`;
}

export async function baixarModeloPlanilha() {
  const url = obterUrlModeloPlanilha();

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.document) {
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "planilha_padrao.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    return;
  }

  // Mobile (Android / iOS): Download direto no app, sem abrir o navegador
  try {
    let FileSystem = null;
    try {
      FileSystem = require("expo-file-system/legacy");
    } catch {
      try {
        FileSystem = require("expo-file-system");
      } catch {}
    }

    if (!FileSystem) {
      throw new Error("Módulo FileSystem não encontrado.");
    }

    const tempUri = `${FileSystem.cacheDirectory || FileSystem.documentDirectory}planilha_padrao.xlsx`;
    const downloadResult = await FileSystem.downloadAsync(url, tempUri);

    if (downloadResult.status !== 200) {
      throw new Error(`Falha no download (HTTP ${downloadResult.status})`);
    }

    if (Platform.OS === "android" && FileSystem.StorageAccessFramework) {
      const SAF = FileSystem.StorageAccessFramework;
      const permissoes = await SAF.requestDirectoryPermissionsAsync();

      if (permissoes && permissoes.granted) {
        const encoding = FileSystem.EncodingType?.Base64 || "base64";
        const base64Data = await FileSystem.readAsStringAsync(
          downloadResult.uri,
          { encoding }
        );

        const destinoUri = await SAF.createFileAsync(
          permissoes.directoryUri,
          "planilha_padrao",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );

        await FileSystem.writeAsStringAsync(destinoUri, base64Data, {
          encoding,
        });

        Alert.alert(
          "Download Concluído",
          "O modelo de planilha foi salvo com sucesso no seu dispositivo!"
        );
        return;
      }
      return;
    }

    Alert.alert(
      "Download Concluído",
      "O modelo padrão de planilha foi baixado com sucesso!"
    );
  } catch (error) {
    console.error("Erro no download interno:", error);
    Alert.alert(
      "Erro no Download",
      "Não foi possível salvar o arquivo no dispositivo. Tente novamente."
    );
  }
}

// ─── Export default (métodos HTTP genéricos usados por authService e demais serviços) ──

export default {
  get: async (endpoint, opcoes) => {
    if (endpoint && endpoint.startsWith("/obras/estrutura/")) {
      const partes = endpoint.replace("/obras/estrutura/", "").split("?");
      const idObra = partes[0];
      const local = await obterEstruturaObra(idObra);
      if (local) return local;
    }
    return requisicao(endpoint, { ...opcoes, method: "GET" });
  },

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
  criarObra,
  obterObra,
  atualizarObra,
  deletarObra,
  arquivarObra,
  obterEstruturaObra,
  listarObrasComProgresso,
  importarPlanilhaBase,
  obterUrlModeloPlanilha,
  baixarModeloPlanilha,
};
