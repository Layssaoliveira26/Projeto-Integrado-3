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
  historico_datas_obra: 2,
  planilhas_base: 2,
  ciclos_medicao: 3,
  medicoes: 3,
  fotografias: 4,
};

const PRIORIDADE_OPERACAO_OBRA = {
  insert: 1,
  atualizar_dados: 2,
  arquivar: 3,
  desarquivar: 3,
  encerrar: 3,
  delete: 4,
};

const parsePayloadItem = (item) => {
  try {
    if (typeof item?.payload === "string") {
      return JSON.parse(item.payload);
    }
    return item?.payload || item?.payloadObj || {};
  } catch {
    return {};
  }
};

const inferirContextoCiclos = (itens = []) => {
  const mapaCiclos = new Map();
  const fechamentos = [];

  for (const item of itens) {
    if (!item) continue;
    const payload = parsePayloadItem(item);

    if (item.tabela_referencia === "planilhas_base") {
      if (payload?.ciclo_inicial_id) {
        mapaCiclos.set(String(payload.ciclo_inicial_id), 1);
      }
      continue;
    }

    if (item.tabela_referencia === "ciclos_medicao") {
      const ehEncerramento = Boolean(
        payload?.acao === "encerrar" ||
          item.operacao === "update" ||
          payload?.ciclo_encerrado_id ||
          payload?.novo_ciclo
      );

      if (ehEncerramento) {
        const encId = payload?.ciclo_encerrado_id || item.registro_id
          ? String(payload?.ciclo_encerrado_id || item.registro_id)
          : null;
        const novoId = payload?.novo_ciclo?.id
          ? String(payload.novo_ciclo.id)
          : null;
        const novoNum = Number(payload?.novo_ciclo?.numero_ciclo);
        const encNum = Number(payload?.numero_ciclo);

        if (Number.isFinite(novoNum) && novoNum >= 2) {
          if (encId) mapaCiclos.set(encId, novoNum - 1);
          if (novoId) mapaCiclos.set(novoId, novoNum);
        } else if (Number.isFinite(encNum) && encNum >= 1) {
          if (encId) mapaCiclos.set(encId, encNum);
          if (novoId) mapaCiclos.set(novoId, encNum + 1);
        }

        fechamentos.push({ encId, novoId });
      } else {
        const cicloId = payload?.id || item.registro_id
          ? String(payload?.id || item.registro_id)
          : null;
        const num = Number(payload?.numero_ciclo);
        if (cicloId && Number.isFinite(num) && num >= 1) {
          mapaCiclos.set(cicloId, num);
        }
      }
      continue;
    }

    if (item.tabela_referencia === "medicoes") {
      const cicloId = payload?.ciclo_id ? String(payload.ciclo_id) : null;
      const num = Number(payload?.numero_ciclo);
      if (cicloId && Number.isFinite(num) && num >= 1 && !mapaCiclos.has(cicloId)) {
        mapaCiclos.set(cicloId, num);
      }
    }
  }

  const propagarCadeiaCiclos = () => {
    for (let passo = 0; passo <= fechamentos.length; passo++) {
      let alterou = false;
      for (const { encId, novoId } of fechamentos) {
        if (encId && novoId) {
          if (mapaCiclos.has(encId) && !mapaCiclos.has(novoId)) {
            mapaCiclos.set(novoId, mapaCiclos.get(encId) + 1);
            alterou = true;
          } else if (
            mapaCiclos.has(novoId) &&
            !mapaCiclos.has(encId) &&
            mapaCiclos.get(novoId) >= 2
          ) {
            mapaCiclos.set(encId, mapaCiclos.get(novoId) - 1);
            alterou = true;
          }
        }
      }
      if (!alterou) break;
    }
  };

  propagarCadeiaCiclos();

  const todosNovosIds = new Set(
    fechamentos.map((f) => f.novoId).filter(Boolean)
  );

  // Semeia primeiro as raízes da cadeia (ciclos encerrados que não foram abertos por outro encerramento no lote)
  for (const { encId } of fechamentos) {
    if (encId && !mapaCiclos.has(encId) && !todosNovosIds.has(encId)) {
      mapaCiclos.set(encId, 1);
      propagarCadeiaCiclos();
    }
  }

  for (const { encId, novoId } of fechamentos) {
    if (encId && !mapaCiclos.has(encId)) {
      mapaCiclos.set(encId, 1);
      if (novoId && !mapaCiclos.has(novoId)) {
        mapaCiclos.set(novoId, 2);
      }
      propagarCadeiaCiclos();
    }
  }

  let cicloPadraoDesconhecido = 1;
  for (const { encId, novoId } of fechamentos) {
    if (!novoId && encId && mapaCiclos.has(encId)) {
      cicloPadraoDesconhecido = Math.max(
        cicloPadraoDesconhecido,
        mapaCiclos.get(encId) + 1
      );
    }
  }

  return { mapaCiclos, cicloPadraoDesconhecido };
};

const construirChaveOrdenacao = (item, indiceOriginal, contextoCiclos) => {
  const pTabela = PRIORIDADE_TABELA[item?.tabela_referencia] || 99;
  const tempoBruto = new Date(item?.created_at || 0).getTime();
  const timestampMs = Number.isFinite(tempoBruto) ? tempoBruto : 0;

  let cicloRank = 0;
  let subFaseCiclo = 0;

  if (item?.tabela_referencia === "ciclos_medicao") {
    const payload = parsePayloadItem(item);
    const ehEncerramento = Boolean(
      payload?.acao === "encerrar" ||
        item?.operacao === "update" ||
        payload?.ciclo_encerrado_id ||
        payload?.novo_ciclo
    );

    if (ehEncerramento) {
      const encId = payload?.ciclo_encerrado_id || item?.registro_id
        ? String(payload?.ciclo_encerrado_id || item?.registro_id)
        : null;
      const novoNum = Number(payload?.novo_ciclo?.numero_ciclo);
      const encNum = Number(payload?.numero_ciclo);

      if (encId && contextoCiclos.mapaCiclos.has(encId)) {
        cicloRank = contextoCiclos.mapaCiclos.get(encId);
      } else if (Number.isFinite(novoNum) && novoNum >= 2) {
        cicloRank = novoNum - 1;
      } else if (Number.isFinite(encNum) && encNum >= 1) {
        cicloRank = encNum;
      } else {
        cicloRank = 1;
      }
      subFaseCiclo = 2; // Encerramento do ciclo k ocorre após medições (k, 1) e antes de (k+1, 0/1)
    } else {
      const cicloId = payload?.id || item?.registro_id
        ? String(payload?.id || item?.registro_id)
        : null;
      const num = Number(payload?.numero_ciclo);
      if (Number.isFinite(num) && num >= 1) {
        cicloRank = num;
      } else if (cicloId && contextoCiclos.mapaCiclos.has(cicloId)) {
        cicloRank = contextoCiclos.mapaCiclos.get(cicloId);
      } else {
        cicloRank = 1;
      }
      subFaseCiclo = 0; // Abertura/criação do ciclo k ocorre antes das medições (k, 1)
    }
  } else if (item?.tabela_referencia === "medicoes") {
    const payload = parsePayloadItem(item);
    const cicloId = payload?.ciclo_id ? String(payload.ciclo_id) : null;
    const num = Number(payload?.numero_ciclo);

    if (Number.isFinite(num) && num >= 1) {
      cicloRank = num;
    } else if (cicloId && contextoCiclos.mapaCiclos.has(cicloId)) {
      cicloRank = contextoCiclos.mapaCiclos.get(cicloId);
    } else {
      cicloRank = contextoCiclos.cicloPadraoDesconhecido;
    }
    subFaseCiclo = 1;
  }

  let pOpObra = 0;
  if (item?.tabela_referencia === "obras") {
    pOpObra =
      PRIORIDADE_OPERACAO_OBRA[item?.acao || item?.operacao] ||
      PRIORIDADE_OPERACAO_OBRA[item?.operacao] ||
      2;
  }

  const ordemNumerica =
    item?.ordem_fila != null ? Number(item.ordem_fila) : Number.NaN;
  const temOrdemFila = Number.isFinite(ordemNumerica) ? 0 : 1;
  const ordemFilaVal = temOrdemFila === 0 ? ordemNumerica : 0;

  return [
    pTabela,
    timestampMs,
    cicloRank,
    subFaseCiclo,
    pOpObra,
    temOrdemFila,
    ordemFilaVal,
    indiceOriginal,
  ];
};

const ordenarOperacoes = (itens = []) => {
  const contextoCiclos = inferirContextoCiclos(itens);
  const decorados = itens.map((item, idx) => ({
    item,
    chave: construirChaveOrdenacao(item, idx, contextoCiclos),
  }));

  decorados.sort((a, b) => {
    for (let i = 0; i < a.chave.length; i++) {
      if (a.chave[i] !== b.chave[i]) {
        return a.chave[i] - b.chave[i];
      }
    }
    return 0;
  });

  return decorados.map((d) => d.item);
};

const arquivarObraIdempotente = async (
  obraId,
  usuarioId,
  obraFallback = null
) => {
  if (typeof obraService.arquivarObra !== "function") {
    return obraFallback || { id: obraId, status: "arquivada" };
  }
  try {
    return await obraService.arquivarObra(obraId, usuarioId);
  } catch (err) {
    if (err?.message?.includes("já está arquivada")) {
      return obraFallback
        ? { ...obraFallback, status: "arquivada" }
        : { id: obraId, status: "arquivada" };
    }
    throw err;
  }
};

const desarquivarObraIdempotente = async (
  obraId,
  usuarioId,
  obraFallback = null
) => {
  if (typeof obraService.desarquivarObra !== "function") {
    return obraFallback || { id: obraId, status: "ativa" };
  }
  try {
    return await obraService.desarquivarObra(obraId, usuarioId);
  } catch (err) {
    if (err?.message?.includes("já está ativa")) {
      return obraFallback
        ? { ...obraFallback, status: "ativa", data_arquivamento: null }
        : { id: obraId, status: "ativa", data_arquivamento: null };
    }
    throw err;
  }
};

const encerrarObraIdempotente = async (
  obraId,
  usuarioId,
  obraFallback = null
) => {
  if (typeof obraService.encerrarObra !== "function") {
    return obraFallback || { id: obraId, status: "encerrada" };
  }
  try {
    return await obraService.encerrarObra(obraId, usuarioId);
  } catch (err) {
    if (err?.message?.includes("já está encerrada")) {
      return obraFallback
        ? { ...obraFallback, status: "encerrada" }
        : { id: obraId, status: "encerrada" };
    }
    throw err;
  }
};

/**
 * Processa um único item da fila de sincronização garantindo isolamento por usuarioId
 * e idempotência por UUID.
 */
const processarItemFila = async (item, usuarioId) => {
  const { tabela_referencia, registro_id, operacao } = item;
  const payload = parsePayloadItem(item);

  switch (tabela_referencia) {
    case "obras": {
      const acao = item.acao || payload.acao || null;

      if (operacao === "insert") {
        let criada = await obraService.criarObra({
          id: payload.id || registro_id,
          nome: payload.nome,
          endereco: payload.endereco || "Não informado",
          data_inicio: payload.data_inicio,
          data_conclusao: payload.data_conclusao,
          descricao: payload.descricao,
          usuarioId,
        });
        const idCriada = criada.id || registro_id;
        if (
          payload.imagem_capa &&
          typeof syncRepository.atualizarImagemCapaObra === "function"
        ) {
          const capaSalva = await syncRepository.atualizarImagemCapaObra(
            idCriada,
            usuarioId,
            payload.imagem_capa
          );
          if (criada && capaSalva?.imagem_capa !== undefined) {
            criada = { ...criada, imagem_capa: capaSalva.imagem_capa };
          }
        }
        if (payload.status === "arquivada") {
          return await arquivarObraIdempotente(idCriada, usuarioId, criada);
        }
        if (payload.status === "encerrada") {
          return await encerrarObraIdempotente(idCriada, usuarioId, criada);
        }
        return criada;
      }
      if (operacao === "update") {
        if (acao === "arquivar") {
          return await arquivarObraIdempotente(registro_id, usuarioId);
        }
        if (acao === "desarquivar") {
          return await desarquivarObraIdempotente(registro_id, usuarioId);
        }
        if (acao === "encerrar") {
          return await encerrarObraIdempotente(registro_id, usuarioId);
        }

        if (acao === "atualizar_dados" || payload.nome) {
          let obraAtualizada = await obraService.atualizarObra(
            registro_id,
            usuarioId,
            {
              nome: payload.nome,
              endereco: payload.endereco || "Não informado",
              data_inicio: payload.data_inicio,
              data_conclusao: payload.data_conclusao,
              descricao: payload.descricao,
              pularHistoricoAutomatico: Boolean(
                payload.historico_sincronizado_separado
              ),
            }
          );

          if (
            payload.imagem_capa !== undefined &&
            typeof syncRepository.atualizarImagemCapaObra === "function"
          ) {
            const capaAtualizada = await syncRepository.atualizarImagemCapaObra(
              registro_id,
              usuarioId,
              payload.imagem_capa
            );
            if (
              obraAtualizada &&
              capaAtualizada?.imagem_capa !== undefined
            ) {
              obraAtualizada = {
                ...obraAtualizada,
                imagem_capa: capaAtualizada.imagem_capa,
              };
            }
          }

          if (!acao && payload.status === "arquivada") {
            obraAtualizada = await arquivarObraIdempotente(
              registro_id,
              usuarioId,
              obraAtualizada
            );
          } else if (!acao && payload.status === "encerrada") {
            obraAtualizada = await encerrarObraIdempotente(
              registro_id,
              usuarioId,
              obraAtualizada
            );
          } else if (!acao && payload.status === "ativa") {
            obraAtualizada = await desarquivarObraIdempotente(
              registro_id,
              usuarioId,
              obraAtualizada
            );
          }

          return obraAtualizada;
        }

        if (payload.status === "arquivada") {
          return await arquivarObraIdempotente(registro_id, usuarioId);
        }
        if (payload.status === "ativa") {
          return await desarquivarObraIdempotente(registro_id, usuarioId);
        }
        if (payload.status === "encerrada") {
          return await encerrarObraIdempotente(registro_id, usuarioId);
        }

        return await obraService.atualizarObra(registro_id, usuarioId, {
          nome: payload.nome,
          endereco: payload.endereco || "Não informado",
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
          nomeArquivo: payload.nome_arquivo || "planilha_metria.xlsx",
          etapas: payload.etapas || [],
          totais_rodape: payload.totais_rodape || {},
          cicloInicialId: payload.ciclo_inicial_id || null,
          origemSync: true,
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
          origemSync: true,
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
            numero_ciclo: payload.numero_ciclo || null,
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

    case "historico_datas_obra": {
      if (operacao === "delete") {
        return { id: registro_id, deletado: true };
      }
      return await syncRepository.upsertHistoricoDataObra({
        id: payload.id || registro_id,
        obra_id: payload.obra_id,
        usuario_id: usuarioId,
        data_anterior: payload.data_anterior,
        data_conclusao: payload.data_conclusao,
        dias_adicionados: Number(payload.dias_adicionados || 0),
        motivo: payload.motivo || null,
        created_at: payload.created_at || null,
      });
    }

    default:
      throw new Error(
        `Tabela de referência desconhecida na sincronização: "${tabela_referencia}".`
      );
  }
};

const extrairObraIdItem = (item) => {
  const payload = parsePayloadItem(item);
  if (item.tabela_referencia === "obras") {
    return payload.id || item.registro_id || null;
  }
  return payload.obra_id || payload.novo_ciclo?.obra_id || null;
};

const CODIGOS_PG_TRANSITORIOS = new Set([
  "08000",
  "08001",
  "08006",
  "40001",
  "40P01",
  "53300",
  "57P01",
  "57P02",
  "57P03",
]);

const classificarErroSync = (error, item, obrasComFalhaTransitoria) => {
  const status = error?.statusCode || error?.status || null;
  const code = error?.code || null;
  const msg = String(error?.message || "");
  const obraId = extrairObraIdItem(item);

  if (
    (status && status >= 500) ||
    (code && CODIGOS_PG_TRANSITORIOS.has(String(code))) ||
    ["ECONNREFUSED", "ETIMEDOUT", "ECONNRESET"].includes(String(code))
  ) {
    return false;
  }

  if (obraId && obrasComFalhaTransitoria.has(String(obraId))) {
    return false;
  }

  if (
    obrasComFalhaTransitoria.size > 0 &&
    (item.tabela_referencia === "medicoes" ||
      item.tabela_referencia === "fotografias") &&
    /não encontrado|não encontrada/i.test(msg)
  ) {
    return false;
  }

  if (
    status === 400 ||
    status === 403 ||
    status === 404 ||
    /sem permissão|não tem permissão|obrigatório|unidade inteira|negativa|anterior à data|não suportada|desconhecida|duplicado|inválido|inválida|não pertence à obra|não encontrada|não encontrado/i.test(
      msg
    )
  ) {
    return true;
  }

  return false;
};

/**
 * Processa um lote de operações enviadas pelo cliente (Push Sync).
 * Falhas individuais não interrompem o lote inteiro, garantindo resiliência.
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
  const obrasComFalhaTransitoria = new Set();

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
      const permanente = classificarErroSync(
        error,
        item,
        obrasComFalhaTransitoria
      );
      if (!permanente) {
        const obraId = extrairObraIdItem(item);
        if (obraId) obrasComFalhaTransitoria.add(String(obraId));
      }

      console.error(
        `[SyncService] Falha ao sincronizar item (tabela=${item.tabela_referencia}, id=${item.registro_id}, permanente=${permanente}):`,
        error.message
      );
      falhas.push({
        fila_id: item.id,
        tabela_referencia: item.tabela_referencia,
        registro_id: item.registro_id,
        operacao: item.operacao,
        permanente,
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
 * Suporta sincronização incremental (Delta Pull) quando `since` é informado.
 */
const obterPullEstado = async (usuarioId, opcoes = {}) => {
  if (!usuarioId) {
    throw new Error("Usuário autenticado é obrigatório para consultar dados.");
  }

  const timestampSnapshot = new Date().toISOString();
  const dados = await syncRepository.buscarDadosCompletosPorUsuario(
    usuarioId,
    opcoes
  );
  return {
    ...dados,
    timestamp: timestampSnapshot,
  };
};

const salvarArquivoFoto = async (fotoId, usuarioId, base64) => {
  if (!usuarioId) {
    const erro = new Error(
      "Usuário autenticado é obrigatório para enviar arquivo de fotografia."
    );
    erro.statusCode = 401;
    throw erro;
  }
  if (!fotoId || !base64 || typeof base64 !== "string") {
    const erro = new Error(
      "ID da fotografia e conteúdo base64 são obrigatórios."
    );
    erro.statusCode = 400;
    throw erro;
  }
  return await syncRepository.salvarArquivoFotografia({
    fotoId,
    usuarioId,
    base64,
  });
};

const obterArquivoFoto = async (fotoId, usuarioId) => {
  if (!usuarioId) {
    const erro = new Error(
      "Usuário autenticado é obrigatório para baixar arquivo de fotografia."
    );
    erro.statusCode = 401;
    throw erro;
  }
  if (!fotoId) {
    const erro = new Error("ID da fotografia é obrigatório.");
    erro.statusCode = 400;
    throw erro;
  }
  return await syncRepository.obterArquivoFotografia(fotoId, usuarioId);
};

module.exports = {
  ordenarOperacoes,
  processarItemFila,
  processarPushLote,
  obterPullEstado,
  salvarArquivoFoto,
  obterArquivoFoto,
};

