const obraService = require("./obraService");
const planilhaService = require("./planilhaService");
const medicaoService = require("./medicaoService");
const syncRepository = require("../repositories/syncRepository");

// Ordem hierárquica de integridade referencial para processamento do lote de sincronização.
// Importante: ciclos_medicao e medicoes possuem a mesma prioridade (3) para que sejam
// executados em ordem cronológica estrita (created_at):
// Medições do Ciclo 1 -> Encerramento do Ciclo 1 (e herança para Ciclo 2) -> Medições do Ciclo 2.
const PRIORIDADE_TABELA = {
  obras: 1,
  planilhas_base: 2,
  ciclos_medicao: 3,
  medicoes: 3,
  fotografias: 4,
};

const ordenarOperacoes = (itens = []) => {
  return [...itens].sort((a, b) => {
    const pA = PRIORIDADE_TABELA[a.tabela_referencia] || 99;
    const pB = PRIORIDADE_TABELA[b.tabela_referencia] || 99;
    if (pA !== pB) return pA - pB;
    const diffTempo =
      new Date(a.created_at || 0).getTime() -
      new Date(b.created_at || 0).getTime();
    if (diffTempo !== 0) return diffTempo;
    // Se tiverem exatamente o mesmo timestamp em ms, processa medições antes de fechar o ciclo
    if (
      a.tabela_referencia === "medicoes" &&
      b.tabela_referencia === "ciclos_medicao"
    ) {
      return -1;
    }
    if (
      a.tabela_referencia === "ciclos_medicao" &&
      b.tabela_referencia === "medicoes"
    ) {
      return 1;
    }
    return 0;
  });
};

/**
 * Processa um único item da fila de sincronização garantindo isolamento por usuarioId (RNF09)
 * e idempotência por UUID (RNF13).
 */
const processarItemFila = async (item, usuarioId) => {
  const { tabela_referencia, registro_id, operacao } = item;
  const payload =
    typeof item.payload === "string"
      ? JSON.parse(item.payload)
      : item.payload || item.payloadObj || {};

  switch (tabela_referencia) {
    case "obras": {
      if (operacao === "insert") {
        return await obraService.criarObra({
          id: payload.id || registro_id,
          nome: payload.nome,
          endereco: payload.endereco,
          data_inicio: payload.data_inicio,
          data_conclusao: payload.data_conclusao,
          descricao: payload.descricao,
          usuarioId,
        });
      }
      if (operacao === "update") {
        if (payload.status === "arquivada" || payload.acao === "arquivar") {
          try {
            return await obraService.arquivarObra(registro_id, usuarioId);
          } catch (err) {
            if (err.message.includes("já está arquivada")) {
              return { id: registro_id, status: "arquivada" };
            }
            throw err;
          }
        }
        return await obraService.atualizarObra(registro_id, usuarioId, {
          nome: payload.nome,
          endereco: payload.endereco,
          data_inicio: payload.data_inicio,
          data_conclusao: payload.data_conclusao,
          descricao: payload.descricao,
        });
      }
      if (operacao === "delete") {
        try {
          return await obraService.deletarObra(registro_id, usuarioId);
        } catch (err) {
          if (err.message.includes("não encontrada")) {
            return { id: registro_id, deletada: true };
          }
          throw err;
        }
      }
      throw new Error(`Operação "${operacao}" não suportada para obras.`);
    }

    case "planilhas_base": {
      const obraId = payload.obra_id || registro_id;
      try {
        return await planilhaService.importarPlanilhaBase({
          obraId,
          usuarioId,
          nomeArquivo: payload.nome_arquivo || "planilha_padrao.xlsx",
          etapas: payload.etapas || [],
          totais_rodape: payload.totais_rodape || {},
          cicloInicialId: payload.ciclo_inicial_id || null,
        });
      } catch (err) {
        // Se já havia medições sincronizadas anteriormente, trata como idempotente
        if (err.statusCode === 409) {
          return { idempotente: true, obra_id: obraId };
        }
        throw err;
      }
    }

    case "ciclos_medicao": {
      if (payload.acao === "encerrar" || operacao === "update") {
        return await syncRepository.encerrarCicloIdempotente({
          cicloEncerradoId: payload.ciclo_encerrado_id || registro_id,
          obraId: payload.obra_id || payload.novo_ciclo?.obra_id || null,
          novoCiclo: payload.novo_ciclo,
          dataEncerramento: payload.data_encerramento,
          usuarioId,
        });
      }
      return { id: registro_id };
    }

    case "medicoes": {
      try {
        return await medicaoService.registrarOuAtualizarMedicao({
          id: payload.id || registro_id,
          ciclo_id: payload.ciclo_id,
          servico_id: payload.servico_id,
          usuario_id: usuarioId,
          quantidade_medida_periodo: String(
            payload.quantidade_medida_periodo ?? 0
          ),
        });
      } catch (err) {
        // Fallback resiliente caso o ciclo já tenha sido encerrado no mesmo lote offline
        // ou caso o UUID do ciclo inicial precise ser resolvido pela obra
        if (
          typeof syncRepository.upsertMedicaoSincronizadaDireta === "function" &&
          (err.message.includes("ciclo encerrado") ||
            err.message.includes("Ciclo de medição não encontrado"))
        ) {
          return await syncRepository.upsertMedicaoSincronizadaDireta({
            id: payload.id || registro_id,
            ciclo_id: payload.ciclo_id,
            servico_id: payload.servico_id,
            usuario_id: usuarioId,
            quantidade_medida_periodo: payload.quantidade_medida_periodo,
            quantidade_acumulada_anterior: payload.quantidade_acumulada_anterior,
            quantidade_acumulada_atual: payload.quantidade_acumulada_atual,
            saldo_quantidade: payload.saldo_quantidade,
            valor_medido_periodo: payload.valor_medido_periodo,
            valor_acumulado_anterior: payload.valor_acumulado_anterior,
            valor_acumulado_atual: payload.valor_acumulado_atual,
            percentual_execucao: payload.percentual_execucao,
          });
        }
        throw err;
      }
    }

    case "fotografias": {
      if (operacao === "delete") {
        return await syncRepository.deletarFotografia(registro_id, usuarioId);
      }
      return await syncRepository.upsertFotografia({
        id: payload.id || registro_id,
        obra_id: payload.obra_id,
        ciclo_id: payload.ciclo_id,
        servico_id: payload.servico_id,
        usuario_id: usuarioId,
        caminho_local: payload.caminho_local,
        caminho_comprimido: payload.caminho_comprimido,
        url_nuvem: payload.url_nuvem || null,
        latitude: payload.latitude,
        longitude: payload.longitude,
        possui_localizacao: payload.possui_localizacao,
        data_hora_captura: payload.data_hora_captura,
      });
    }

    default:
      throw new Error(
        `Tabela de referência desconhecida na sincronização: "${tabela_referencia}".`
      );
  }
};

/**
 * Processa um lote de operações enviadas pelo cliente (Push Sync).
 * Falhas individuais não interrompem o lote inteiro, garantindo confiabilidade (RNF13).
 */
const processarPushLote = async (itens = [], usuarioId) => {
  if (!usuarioId) {
    throw new Error("Usuário autenticado é obrigatório para sincronizar dados.");
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return {
      sincronizados: [],
      falhas: [],
      timestamp: new Date().toISOString(),
    };
  }

  const ordenados = ordenarOperacoes(itens);
  const sincronizados = [];
  const falhas = [];

  for (const item of ordenados) {
    try {
      const resultado = await processarItemFila(item, usuarioId);
      sincronizados.push({
        fila_id: item.id,
        tabela_referencia: item.tabela_referencia,
        registro_id: item.registro_id,
        operacao: item.operacao,
        resultado,
      });
    } catch (error) {
      falhas.push({
        fila_id: item.id,
        tabela_referencia: item.tabela_referencia,
        registro_id: item.registro_id,
        operacao: item.operacao,
        erro: error.message || "Erro ao sincronizar item no servidor.",
      });
    }
  }

  return {
    sincronizados,
    falhas,
    timestamp: new Date().toISOString(),
  };
};

/**
 * Retorna o estado consolidado do servidor para o usuário autenticado (Pull Sync).
 */
const obterPullEstado = async (usuarioId) => {
  if (!usuarioId) {
    throw new Error("Usuário autenticado é obrigatório para consultar dados.");
  }

  const dados = await syncRepository.buscarDadosCompletosPorUsuario(usuarioId);
  return {
    ...dados,
    timestamp: new Date().toISOString(),
  };
};

module.exports = {
  ordenarOperacoes,
  processarItemFila,
  processarPushLote,
  obterPullEstado,
};

