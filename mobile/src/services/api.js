import { Platform, Linking, Alert } from "react-native";
import Constants from "expo-constants";
import { obterToken, obterUsuarioLocal } from "./storage";
import {
  criarObraLocal,
  listarObrasLocais,
  obterObraLocalPorId,
  atualizarObraLocal,
  arquivarObraLocal,
  encerrarObraLocal,
  deletarObraLocal,
  salvarEstruturaPlanilhaLocal,
  obterEstruturaObraLocal,
  obterResumoFiltrosObraLocal,
  upsertObraSincronizada,
  listarHistoricoConclusaoLocal,
  upsertHistoricoDataObraLocal,
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

  const timeoutMs =
    opcoes.timeoutMs || (endpoint.startsWith("/sync") ? 25000 : 8000);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
        mensagemErro = endpoint.includes("/auth/login")
          ? "E-mail ou senha incorretos."
          : dados.mensagem || dados.erro || "Sessão expirada ou não autorizada.";
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

export function obterImagemObra(index, id) {
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

// ─── Funções de Obras (Offline-First) ─────────────────

export async function listarObras(opcoes = false) {
  const incluirArquivadas =
    typeof opcoes === "boolean"
      ? opcoes
      : Boolean(opcoes?.incluirArquivadas);
  const incluirEncerradas =
    typeof opcoes === "object" && opcoes !== null
      ? Boolean(opcoes.incluirEncerradas)
      : false;
  const pularSyncEmSegundoPlano =
    typeof opcoes === "object" && opcoes !== null
      ? Boolean(opcoes.pularSyncEmSegundoPlano)
      : false;
  const incluirNaoAtivas = incluirArquivadas || incluirEncerradas;

  const usuario = await obterUsuarioLocal();
  const locais = await listarObrasLocais(usuario?.id, incluirNaoAtivas).catch(() => []);
  const todasLocais = incluirNaoAtivas
    ? locais
    : await listarObrasLocais(usuario?.id, true).catch(() => []);

  if (Array.isArray(todasLocais) && todasLocais.length > 0) {
    // Dispara atualização em segundo plano sem bloquear a UI (exceto quando chamado em reação ao próprio Pull)
    if (!pularSyncEmSegundoPlano) {
      sincronizarTudo({ incluirPull: true }).catch(() => {});
    }
    return locais;
  }

  try {
    const parametros = new URLSearchParams();
    if (incluirArquivadas) parametros.set("incluirArquivadas", "true");
    if (incluirEncerradas) parametros.set("incluirEncerradas", "true");
    const queryString = parametros.toString();
    const query = queryString ? `?${queryString}` : "";
    const remotas = await requisicao(`/obras${query}`);
    if (Array.isArray(remotas)) {
      for (const obra of remotas) {
        await upsertObraSincronizada(obra).catch(() => {});
      }
      return await listarObrasLocais(usuario?.id, incluirNaoAtivas).catch(
        () => remotas
      );
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
  if (!usuario?.id) {
    throw new Error("Sessão de usuário inválida. Faça login novamente.");
  }
  const novaObra = await criarObraLocal({
    ...dados,
    usuarioId: usuario.id,
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

export async function obterHistoricoConclusaoObra(obraId) {
  const local = await listarHistoricoConclusaoLocal(obraId).catch(() => null);
  if (local && Array.isArray(local.historico) && local.historico.length > 0) {
    return local;
  }

  try {
    const remoto = await requisicao(`/obras/${obraId}/historico-conclusao`);
    if (remoto && Array.isArray(remoto.historico)) {
      for (const item of remoto.historico) {
        await upsertHistoricoDataObraLocal({
          ...item,
          obra_id: item.obra_id || obraId,
        }).catch(() => {});
      }
    }
    return remoto;
  } catch (error) {
    if (error.status === 0 || !error.status) {
      return local || { ultima_atualizacao: null, historico: [] };
    }
    throw error;
  }
}

export async function adicionarHistoricoConclusaoObra(obraId, dados) {
  const registro = await requisicao(`/obras/${obraId}/historico-conclusao`, {
    method: "POST",
    body: JSON.stringify(dados),
  });
  if (registro && registro.id) {
    await upsertHistoricoDataObraLocal({
      ...registro,
      obra_id: registro.obra_id || obraId,
    }).catch(() => {});
  }
  return registro;
}

export async function encerrarObra(id) {
  const encerrada = await encerrarObraLocal(id);
  agendarSincronizacao();
  return encerrada;
}
export async function obterEstruturaObra(obraId, cicloId = null) {
  const estruturaLocal = await obterEstruturaObraLocal(obraId, cicloId).catch(
    () => null
  );
  if (estruturaLocal && estruturaLocal.etapas && estruturaLocal.etapas.length > 0) {
    return estruturaLocal;
  }

  const obraLocal = await obterObraLocalPorId(obraId).catch(() => null);
  if (
    obraLocal &&
    (obraLocal.sync_status === "pending" ||
      Number(obraLocal.orcamento_total || 0) === 0)
  ) {
    return {
      obra_id: obraLocal.id,
      nome: obraLocal.nome,
      ciclo_ativo: null,
      progresso_geral_percentual: 0,
      valor_executado_total: 0,
      valor_orcado_total: 0,
      etapas: [],
    };
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

        const possuiMedicoes = estruturaRemota.etapas.some((etapa) =>
          (etapa.servicos || []).some(
            (s) => Number(s.valor_acumulado_atual || 0) > 0
          )
        );
        if (possuiMedicoes) {
          // Dispara pull em segundo plano para hidratar as medições completas sem gravar linhas parciais
          agendarSincronizacao({ incluirPull: true });
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

export async function listarObrasComProgresso(opcoes = false) {
  const obras = await listarObras(opcoes);

  if (!Array.isArray(obras) || obras.length === 0) {
    return [];
  }

  const resultados = await Promise.allSettled(
    obras.map((obra) => obterEstruturaObra(obra.id)),
  );
  const resumosFiltros = await Promise.all(
    obras.map((obra) => obterResumoFiltrosObraLocal(obra.id)),
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
      imagem: obra.imagem_capa || obterImagemObra(index, obra.id),
      quantidade_ciclos: resumosFiltros[index].quantidade_ciclos,
      data_ultima_medicao: resumosFiltros[index].data_ultima_medicao,
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

export async function baixarModeloPlanilha({ mostrarAlertas = true } = {}) {
  const url = obterUrlModeloPlanilha();

  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.document) {
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "planilha_padrao.xlsx");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return true;
    }
    return true;
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

      if (permissoes?.granted) {
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

        if (mostrarAlertas) {
          Alert.alert(
            "Download Concluído",
            "O modelo de planilha foi salvo com sucesso no seu dispositivo!",
          );
        }
        return true;
      }
      if (!mostrarAlertas) {
        const erroCancelamento = new Error("Download cancelado pelo usuário.");
        erroCancelamento.code = "DOWNLOAD_CANCELADO";
        throw erroCancelamento;
      }
      return false;
    }

    if (mostrarAlertas) {
      Alert.alert(
        "Download Concluído",
        "O modelo padrão de planilha foi baixado com sucesso!",
      );
    }
    return true;
  } catch (error) {
    if (error?.code !== "DOWNLOAD_CANCELADO") {
      console.error("Erro no download interno:", error);
    }
    if (!mostrarAlertas) throw error;
    if (error?.code !== "DOWNLOAD_CANCELADO") {
      Alert.alert(
        "Erro no Download",
        "Não foi possível salvar o arquivo no dispositivo. Tente novamente.",
      );
    }
    return false;
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
  obterHistoricoConclusaoObra,
  adicionarHistoricoConclusaoObra,
  encerrarObra,
  obterEstruturaObra,
  listarObrasComProgresso,
  importarPlanilhaBase,
  obterUrlModeloPlanilha,
  baixarModeloPlanilha,
};
