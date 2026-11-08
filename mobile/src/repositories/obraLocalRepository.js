// mobile/src/repositories/obraLocalRepository.js
import { getDbConnection } from "../database/index";
import { gerarUUID } from "../utils/uuid";
import { enfileirarOperacao } from "./syncQueueRepository";

const normalizarDataLocal = (dataStr) => {
  if (!dataStr || typeof dataStr !== "string" || !dataStr.trim()) return null;
  const limpa = dataStr.trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(limpa)) {
    const [dia, mes, ano] = limpa.split("/");
    return `${ano}-${mes.padStart(2, "0")}-${dia.padStart(2, "0")}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(limpa)) {
    return limpa.split("T")[0];
  }
  return limpa;
};

/**
 * Salva ou atualiza uma obra vinda do servidor sem enfileirar mutação (cache local).
 */
export const upsertObraSincronizada = async (obra, dbOverride = null) => {
  if (!obra || !obra.id) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO obras (
      id, usuario_id, nome, endereco, data_inicio, data_conclusao, descricao,
      orcamento_total, status, data_arquivamento, created_at, updated_at, deleted_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
    ON CONFLICT(id) DO UPDATE SET
      nome = excluded.nome,
      endereco = excluded.endereco,
      data_inicio = excluded.data_inicio,
      data_conclusao = excluded.data_conclusao,
      descricao = excluded.descricao,
      orcamento_total = excluded.orcamento_total,
      status = excluded.status,
      data_arquivamento = excluded.data_arquivamento,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at,
      sync_status = CASE WHEN obras.sync_status = 'pending' THEN 'pending' ELSE 'synced' END;`,
    [
      String(obra.id),
      String(obra.usuario_id || ""),
      obra.nome || "",
      obra.endereco || null,
      obra.data_inicio || null,
      obra.data_conclusao || null,
      obra.descricao || null,
      Number(obra.orcamento_total || 0),
      obra.status || "ativa",
      obra.data_arquivamento || null,
      obra.created_at || agora,
      obra.updated_at || agora,
      obra.deleted_at || null,
      Number(obra.version || 1),
    ]
  );
};

/**
 * Cria uma nova obra localmente no SQLite e registra na fila de sincronização.
 */
export const criarObraLocal = async (
  { id, usuarioId, nome, endereco, data_inicio, data_conclusao, descricao },
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const obraId = id || gerarUUID();
  const agora = new Date().toISOString();
  const dataInicioNorm = normalizarDataLocal(data_inicio);
  const dataConclusaoNorm = normalizarDataLocal(data_conclusao);

  const novaObra = {
    id: obraId,
    usuario_id: String(usuarioId || ""),
    nome: (nome || "").trim(),
    endereco: (endereco || "").trim(),
    data_inicio: dataInicioNorm,
    data_conclusao: dataConclusaoNorm,
    descricao: descricao ? descricao.trim() : null,
    orcamento_total: 0,
    status: "ativa",
    created_at: agora,
    updated_at: agora,
    sync_status: "pending",
    version: 1,
  };

  await db.runAsync(
    `INSERT INTO obras (
      id, usuario_id, nome, endereco, data_inicio, data_conclusao, descricao,
      orcamento_total, status, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'ativa', ?, ?, 'pending', 1);`,
    [
      novaObra.id,
      novaObra.usuario_id,
      novaObra.nome,
      novaObra.endereco,
      novaObra.data_inicio,
      novaObra.data_conclusao,
      novaObra.descricao,
      novaObra.created_at,
      novaObra.updated_at,
    ]
  );

  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: novaObra.id,
      operacao: "insert",
      payload: novaObra,
    },
    db
  );

  return novaObra;
};

/**
 * Lista as obras salvas no SQLite local para o usuário informado.
 */
export const listarObrasLocais = async (
  usuarioId = null,
  incluirArquivadas = false,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  let sql = `SELECT * FROM obras WHERE deleted_at IS NULL`;
  const params = [];

  if (usuarioId) {
    sql += ` AND (usuario_id = ? OR usuario_id = '')`;
    params.push(String(usuarioId));
  }

  if (!incluirArquivadas) {
    sql += ` AND status = 'ativa'`;
  }

  sql += ` ORDER BY created_at DESC;`;
  return (await db.getAllAsync(sql, params)) || [];
};

/**
 * Busca uma obra pelo ID no SQLite local.
 */
export const obterObraLocalPorId = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  return await db.getFirstAsync(
    `SELECT * FROM obras WHERE id = ? AND deleted_at IS NULL;`,
    [String(id)]
  );
};

/**
 * Atualiza os dados cadastrais de uma obra localmente e enfileira a operação.
 */
export const atualizarObraLocal = async (
  id,
  { nome, endereco, data_inicio, data_conclusao, descricao },
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  const dataInicioNorm = normalizarDataLocal(data_inicio);
  const dataConclusaoNorm = normalizarDataLocal(data_conclusao);

  await db.runAsync(
    `UPDATE obras
     SET nome = ?, endereco = ?, data_inicio = ?, data_conclusao = ?, descricao = ?,
         sync_status = 'pending', updated_at = ?
     WHERE id = ?;`,
    [
      (nome || "").trim(),
      (endereco || "").trim(),
      dataInicioNorm,
      dataConclusaoNorm,
      descricao ? descricao.trim() : null,
      agora,
      String(id),
    ]
  );

  const atualizada = await obterObraLocalPorId(id, db);
  if (atualizada) {
    await enfileirarOperacao(
      {
        tabelaReferencia: "obras",
        registroId: String(id),
        operacao: "update",
        payload: atualizada,
      },
      db
    );
  }
  return atualizada;
};

/**
 * Arquiva uma obra localmente no SQLite e registra na fila de sincronização.
 */
export const arquivarObraLocal = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `UPDATE obras
     SET status = 'arquivada', data_arquivamento = ?, sync_status = 'pending', updated_at = ?
     WHERE id = ?;`,
    [agora, agora, String(id)]
  );

  const obra = await obterObraLocalPorId(id, db);
  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: String(id),
      operacao: "update",
      payload: { ...(obra || { id }), status: "arquivada", acao: "arquivar" },
    },
    db
  );
  return obra;
};

/**
 * Exclui uma obra localmente e registra na fila de sincronização.
 */
export const deletarObraLocal = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  await db.runAsync(`DELETE FROM servicos WHERE obra_id = ?;`, [String(id)]);
  await db.runAsync(`DELETE FROM etapas WHERE obra_id = ?;`, [String(id)]);
  await db.runAsync(`DELETE FROM ciclos_medicao WHERE obra_id = ?;`, [String(id)]);
  await db.runAsync(`DELETE FROM planilhas_base WHERE obra_id = ?;`, [String(id)]);
  await db.runAsync(`DELETE FROM obras WHERE id = ?;`, [String(id)]);

  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: String(id),
      operacao: "delete",
      payload: { id: String(id) },
    },
    db
  );
  return { id: String(id), deletada: true };
};

/**
 * Salva a estrutura completa de etapas, serviços e ciclo inicial no SQLite local.
 * Quando sincronizado = false (importação feita offline), enfileira na fila_sincronizacao.
 */
export const salvarEstruturaPlanilhaLocal = async (
  { obraId, nomeArquivo = "planilha_padrao.xlsx", etapas = [], sincronizado = false },
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  // Limpa estrutura anterior se ainda não houver medições
  await db.runAsync(`DELETE FROM servicos WHERE obra_id = ?;`, [String(obraId)]);
  await db.runAsync(`DELETE FROM etapas WHERE obra_id = ?;`, [String(obraId)]);

  let orcamentoTotal = 0;
  const etapasPersistidas = [];

  for (let i = 0; i < etapas.length; i++) {
    const etapaRaw = etapas[i];
    const etapaId = etapaRaw.id || gerarUUID();
    const ordemEtapa = typeof etapaRaw.ordem === "number" ? etapaRaw.ordem : i + 1;

    await db.runAsync(
      `INSERT OR REPLACE INTO etapas (id, obra_id, etapa_pai_id, nome, ordem, created_at, updated_at)
       VALUES (?, ?, NULL, ?, ?, ?, ?);`,
      [etapaId, String(obraId), etapaRaw.nome, ordemEtapa, agora, agora]
    );

    const servicosDaEtapa = [];
    const listaServicos = Array.isArray(etapaRaw.servicos) ? etapaRaw.servicos : [];

    for (let j = 0; j < listaServicos.length; j++) {
      const sRaw = listaServicos[j];
      const servicoId = sRaw.id || gerarUUID();
      const codigo = String(sRaw.codigo_servico || sRaw.codigo || `SRV-${i + 1}-${j + 1}`);
      const descricao = sRaw.descricao || "";
      const fonte = sRaw.fonte_origem || sRaw.fonte || null;
      const unidade = sRaw.unidade_medida || sRaw.unidade || "UN";
      const qtdOrcada = Number(sRaw.quantidade_orcada ?? sRaw.quantidade ?? 0);
      const precoUnit = Number(sRaw.preco_unitario ?? sRaw.valor_unitario ?? 0);
      const precoTotal = Number(
        sRaw.preco_total ?? sRaw.preco_total_orcado ?? qtdOrcada * precoUnit
      );
      const ordemServico = typeof sRaw.ordem === "number" ? sRaw.ordem : j + 1;

      orcamentoTotal += precoTotal;

      await db.runAsync(
        `INSERT OR REPLACE INTO servicos (
          id, obra_id, etapa_id, codigo_servico, descricao, fonte_origem,
          unidade_medida, quantidade_orcada, preco_unitario, preco_total, ordem, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          servicoId,
          String(obraId),
          etapaId,
          codigo,
          descricao,
          fonte,
          unidade,
          qtdOrcada,
          precoUnit,
          precoTotal,
          ordemServico,
          agora,
          agora,
        ]
      );

      servicosDaEtapa.push({
        id: servicoId,
        obra_id: String(obraId),
        etapa_id: etapaId,
        codigo_servico: codigo,
        descricao,
        fonte_origem: fonte,
        unidade_medida: unidade,
        quantidade_orcada: qtdOrcada,
        preco_unitario: precoUnit,
        preco_total: precoTotal,
        ordem: ordemServico,
      });
    }

    etapasPersistidas.push({
      id: etapaId,
      obra_id: String(obraId),
      nome: etapaRaw.nome,
      ordem: ordemEtapa,
      servicos: servicosDaEtapa,
    });
  }

  // Atualiza orçamento total da obra
  await db.runAsync(
    `UPDATE obras SET orcamento_total = ?, updated_at = ? WHERE id = ?;`,
    [Number(orcamentoTotal.toFixed(2)), agora, String(obraId)]
  );

  // Garante Ciclo 1 aberto caso não exista nenhum ciclo na obra
  const cicloExistente = await db.getFirstAsync(
    `SELECT * FROM ciclos_medicao WHERE obra_id = ? AND numero_ciclo = 1;`,
    [String(obraId)]
  );
  let cicloInicialId = cicloExistente?.id;
  if (!cicloExistente) {
    cicloInicialId = gerarUUID();
    await db.runAsync(
      `INSERT INTO ciclos_medicao (id, obra_id, numero_ciclo, status, data_inicio, created_at, updated_at)
       VALUES (?, ?, 1, 'aberto', ?, ?, ?);`,
      [cicloInicialId, String(obraId), agora, agora, agora]
    );
  }

  // Salva registro na tabela planilhas_base
  const planilhaId = gerarUUID();
  await db.runAsync(
    `INSERT OR REPLACE INTO planilhas_base (
      id, obra_id, nome_arquivo, status_validacao, data_importacao, created_at, updated_at
    ) VALUES (?, ?, ?, 'valida', ?, ?, ?);`,
    [planilhaId, String(obraId), nomeArquivo, agora, agora, agora]
  );

  if (!sincronizado) {
    await enfileirarOperacao(
      {
        tabelaReferencia: "planilhas_base",
        registroId: String(obraId),
        operacao: "insert",
        payload: {
          obra_id: String(obraId),
          nome_arquivo: nomeArquivo,
          ciclo_inicial_id: cicloInicialId,
          etapas: etapasPersistidas,
        },
      },
      db
    );
  }

  return {
    obra_id: String(obraId),
    orcamento_total: Number(orcamentoTotal.toFixed(2)),
    ciclo_inicial_id: cicloInicialId,
    etapas: etapasPersistidas,
  };
};

/**
 * Monta a estrutura completa de acompanhamento da obra a partir do SQLite local,
 * retornando o mesmo contrato de GET /obras/estrutura/:obraId.
 */
export const obterEstruturaObraLocal = async (
  obraId,
  cicloIdParam = null,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const obra = await obterObraLocalPorId(obraId, db);
  if (!obra) return null;

  let ciclo = null;
  if (cicloIdParam) {
    ciclo = await db.getFirstAsync(
      `SELECT * FROM ciclos_medicao WHERE id = ?;`,
      [String(cicloIdParam)]
    );
  } else {
    ciclo = await db.getFirstAsync(
      `SELECT * FROM ciclos_medicao
       WHERE obra_id = ?
       ORDER BY CASE WHEN status = 'aberto' THEN 0 ELSE 1 END, numero_ciclo DESC
       LIMIT 1;`,
      [String(obraId)]
    );
  }

  const etapasRows = await db.getAllAsync(
    `SELECT * FROM etapas WHERE obra_id = ? ORDER BY ordem ASC;`,
    [String(obraId)]
  );

  if (!etapasRows || etapasRows.length === 0) {
    return null;
  }

  const servicosRows = await db.getAllAsync(
    `SELECT * FROM servicos WHERE obra_id = ? ORDER BY ordem ASC;`,
    [String(obraId)]
  );

  // Busca medições do ciclo alvo (ou a última medição de cada serviço da obra)
  const medicoesPorServico = new Map();
  if (ciclo?.id) {
    const medRows = await db.getAllAsync(
      `SELECT * FROM medicoes WHERE ciclo_id = ?;`,
      [String(ciclo.id)]
    );
    for (const m of medRows || []) {
      medicoesPorServico.set(String(m.servico_id), m);
    }
  }

  let valorOrcadoObra = 0;
  let valorExecutadoObra = 0;
  const etapasMap = new Map();

  for (const e of etapasRows) {
    etapasMap.set(String(e.id), {
      id: e.id,
      nome: e.nome,
      ordem: e.ordem,
      total_servicos: 0,
      valor_orcado_etapa: 0,
      valor_executado_etapa: 0,
      progresso_etapa_percentual: 0,
      servicos: [],
    });
  }

  for (const s of servicosRows || []) {
    const etapa = etapasMap.get(String(s.etapa_id));
    if (!etapa) continue;

    const medicao = medicoesPorServico.get(String(s.id));
    const precoTotalServico = Number(s.preco_total || 0);
    const valorExecutadoServico = Number(medicao?.valor_acumulado_atual || 0);
    const percentualExecucao = Number(medicao?.percentual_execucao || 0);

    valorOrcadoObra += precoTotalServico;
    valorExecutadoObra += valorExecutadoServico;

    etapa.total_servicos += 1;
    etapa.valor_orcado_etapa += precoTotalServico;
    etapa.valor_executado_etapa += valorExecutadoServico;

    etapa.servicos.push({
      id: s.id,
      codigo_servico: s.codigo_servico,
      descricao: s.descricao,
      fonte_origem: s.fonte_origem,
      unidade_medida: s.unidade_medida,
      quantidade_orcada: Number(s.quantidade_orcada || 0),
      preco_unitario: Number(s.preco_unitario || 0),
      preco_total_orcado: precoTotalServico,
      valor_acumulado_atual: valorExecutadoServico,
      percentual_execucao: percentualExecucao,
    });
  }

  const etapas = Array.from(etapasMap.values()).map((etapa) => {
    const progressoEtapa =
      etapa.valor_orcado_etapa > 0
        ? (etapa.valor_executado_etapa / etapa.valor_orcado_etapa) * 100
        : 0;
    return {
      ...etapa,
      progresso_etapa_percentual: Number(progressoEtapa.toFixed(2)),
    };
  });

  const progressoGeral =
    valorOrcadoObra > 0 ? (valorExecutadoObra / valorOrcadoObra) * 100 : 0;

  return {
    obra_id: obra.id,
    nome: obra.nome,
    ciclo_ativo: ciclo || null,
    progresso_geral_percentual: Number(progressoGeral.toFixed(2)),
    valor_executado_total: Number(valorExecutadoObra.toFixed(2)),
    valor_orcado_total: Number(valorOrcadoObra.toFixed(2)),
    etapas,
  };
};

export default {
  upsertObraSincronizada,
  criarObraLocal,
  listarObrasLocais,
  obterObraLocalPorId,
  atualizarObraLocal,
  arquivarObraLocal,
  deletarObraLocal,
  salvarEstruturaPlanilhaLocal,
  obterEstruturaObraLocal,
};

