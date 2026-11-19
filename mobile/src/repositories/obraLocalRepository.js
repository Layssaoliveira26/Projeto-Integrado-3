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
      imagem_capa, orcamento_total, status, data_arquivamento, created_at, updated_at, deleted_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)
    ON CONFLICT(id) DO UPDATE SET
      nome = CASE WHEN obras.sync_status = 'pending' THEN obras.nome ELSE excluded.nome END,
      endereco = CASE WHEN obras.sync_status = 'pending' THEN obras.endereco ELSE excluded.endereco END,
      data_inicio = CASE WHEN obras.sync_status = 'pending' THEN obras.data_inicio ELSE excluded.data_inicio END,
      data_conclusao = CASE WHEN obras.sync_status = 'pending' THEN obras.data_conclusao ELSE excluded.data_conclusao END,
      descricao = CASE WHEN obras.sync_status = 'pending' THEN obras.descricao ELSE excluded.descricao END,
      imagem_capa = COALESCE(excluded.imagem_capa, obras.imagem_capa),
      orcamento_total = CASE WHEN excluded.orcamento_total > 0 THEN excluded.orcamento_total ELSE obras.orcamento_total END,
      status = CASE WHEN obras.sync_status = 'pending' THEN obras.status ELSE excluded.status END,
      data_arquivamento = CASE WHEN obras.sync_status = 'pending' THEN obras.data_arquivamento ELSE excluded.data_arquivamento END,
      updated_at = CASE WHEN obras.sync_status = 'pending' THEN obras.updated_at ELSE excluded.updated_at END,
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
      obra.imagem_capa || null,
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
  { id, usuarioId, nome, endereco, data_inicio, data_conclusao, descricao, imagem_capa = null },
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
    imagem_capa: imagem_capa || null,
    orcamento_total: 0,
    status: "ativa",
    created_at: agora,
    updated_at: agora,
    sync_status: "pending",
    version: 1,
  };

  await db.runAsync(
    `INSERT INTO obras (
      id, usuario_id, nome, endereco, data_inicio, data_conclusao, descricao, imagem_capa,
      orcamento_total, status, created_at, updated_at, sync_status, version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'ativa', ?, ?, 'pending', 1);`,
    [
      novaObra.id,
      novaObra.usuario_id,
      novaObra.nome,
      novaObra.endereco,
      novaObra.data_inicio,
      novaObra.data_conclusao,
      novaObra.descricao,
      novaObra.imagem_capa,
      novaObra.created_at,
      novaObra.updated_at,
    ]
  );

  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: novaObra.id,
      operacao: "insert",
      acao: "criar",
      usuarioId: novaObra.usuario_id,
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
    sql += ` AND usuario_id = ?`;
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

const calcularDiferencaDiasIso = (dataAntIso, dataNovaIso) => {
  if (!dataAntIso || !dataNovaIso) return 0;
  const [a1, m1, d1] = dataAntIso.split("-").map(Number);
  const [a2, m2, d2] = dataNovaIso.split("-").map(Number);
  const utc1 = Date.UTC(a1, m1 - 1, d1);
  const utc2 = Date.UTC(a2, m2 - 1, d2);
  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
};

/**
 * Atualiza os dados cadastrais de uma obra localmente e enfileira a operação.
 */
export const atualizarObraLocal = async (
  id,
  { nome, endereco, data_inicio, data_conclusao, descricao, imagem_capa },
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  const dataInicioNorm = normalizarDataLocal(data_inicio);
  const dataConclusaoNorm = normalizarDataLocal(data_conclusao);
  const obraAnterior = await obterObraLocalPorId(id, db);

  await db.runAsync(
    `UPDATE obras
     SET nome = ?, endereco = ?, data_inicio = ?, data_conclusao = ?, descricao = ?,
         imagem_capa = CASE WHEN ? = 1 THEN ? ELSE imagem_capa END,
         sync_status = 'pending', updated_at = ?
     WHERE id = ?;`,
    [
      (nome || "").trim(),
      (endereco || "").trim(),
      dataInicioNorm,
      dataConclusaoNorm,
      descricao ? descricao.trim() : null,
      imagem_capa !== undefined ? 1 : 0,
      imagem_capa || null,
      agora,
      String(id),
    ]
  );

  const atualizada = await obterObraLocalPorId(id, db);
  if (atualizada) {
    const dataAnteriorIso = normalizarDataLocal(obraAnterior?.data_conclusao);
    const alterouPrazo = Boolean(
      dataAnteriorIso &&
        dataConclusaoNorm &&
        dataAnteriorIso !== dataConclusaoNorm
    );

    if (alterouPrazo) {
      const histId = gerarUUID();
      const diasAdicionados = calcularDiferencaDiasIso(
        dataAnteriorIso,
        dataConclusaoNorm
      );
      try {
        await db.runAsync(
          `INSERT INTO historico_datas_obra (
            id, obra_id, usuario_id, data_anterior, data_conclusao, dias_adicionados, motivo, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?);`,
          [
            histId,
            String(id),
            atualizada.usuario_id || null,
            dataAnteriorIso,
            dataConclusaoNorm,
            diasAdicionados,
            agora,
          ]
        );
      } catch {
        // Ignora caso tabela ainda não exista em mocks unitários mínimos
      }

      await enfileirarOperacao(
        {
          tabelaReferencia: "historico_datas_obra",
          registroId: histId,
          operacao: "insert",
          acao: "registrar_historico_prazo",
          usuarioId: atualizada.usuario_id,
          payload: {
            id: histId,
            obra_id: String(id),
            usuario_id: atualizada.usuario_id || null,
            data_anterior: dataAnteriorIso,
            data_conclusao: dataConclusaoNorm,
            dias_adicionados: diasAdicionados,
            motivo: null,
            created_at: agora,
          },
        },
        db
      );
    }

    await enfileirarOperacao(
      {
        tabelaReferencia: "obras",
        registroId: String(id),
        operacao: "update",
        acao: "atualizar_dados",
        usuarioId: atualizada.usuario_id,
        payload: {
          ...atualizada,
          acao: "atualizar_dados",
          historico_sincronizado_separado: alterouPrazo,
        },
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
  const obraAnterior = await obterObraLocalPorId(id, db).catch(() => null);
  if (obraAnterior?.status === "encerrada") {
    throw new Error("Não é possível arquivar uma obra já encerrada.");
  }
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
      acao: "arquivar",
      usuarioId: obra?.usuario_id || null,
      payload: { ...(obra || { id }), status: "arquivada", acao: "arquivar" },
    },
    db
  );
  return obra;
};

/**
 * Desarquiva uma obra localmente no SQLite e registra na fila de sincronização.
 */
export const desarquivarObraLocal = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const obraAnterior = await obterObraLocalPorId(id, db).catch(() => null);
  if (obraAnterior?.status === "encerrada") {
    throw new Error("Não é possível reativar uma obra já encerrada.");
  }
  const agora = new Date().toISOString();

  await db.runAsync(
    `UPDATE obras
     SET status = 'ativa', data_arquivamento = NULL, sync_status = 'pending', updated_at = ?
     WHERE id = ?;`,
    [agora, String(id)]
  );

  const obra = await obterObraLocalPorId(id, db);
  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: String(id),
      operacao: "update",
      acao: "desarquivar",
      usuarioId: obra?.usuario_id || null,
      payload: {
        ...(obra || { id }),
        status: "ativa",
        data_arquivamento: null,
        acao: "desarquivar",
      },
    },
    db
  );
  return obra;
};

/**
 * Encerra uma obra localmente no SQLite e registra na fila de sincronização.
 */
export const encerrarObraLocal = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `UPDATE obras
     SET status = 'encerrada', data_arquivamento = NULL, sync_status = 'pending', updated_at = ?
     WHERE id = ?;`,
    [agora, String(id)]
  );

  await db
    .runAsync(
      `UPDATE ciclos_medicao
       SET status = 'encerrado',
           data_encerramento = COALESCE(data_encerramento, ?),
           updated_at = ?
       WHERE obra_id = ? AND status = 'aberto';`,
      [agora, agora, String(id)]
    )
    .catch(() => {});

  const obra = await obterObraLocalPorId(id, db);
  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: String(id),
      operacao: "update",
      acao: "encerrar",
      usuarioId: obra?.usuario_id || null,
      payload: { ...(obra || { id }), status: "encerrada", acao: "encerrar" },
    },
    db
  );
  return obra;
};

/**
 * Exclui uma obra localmente, incluindo registros filhos e pendências órfãs na fila de sincronização.
 */
export const deletarObraLocal = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const obraIdStr = String(id);
  const obraExistente = await obterObraLocalPorId(id, db).catch(() => null);
  const usuarioId = obraExistente?.usuario_id || null;

  await db.runAsync(
    `DELETE FROM fila_sincronizacao
     WHERE status IN ('pendente', 'erro')
       AND (
         (tabela_referencia = 'planilhas_base' AND registro_id = ?)
         OR (tabela_referencia = 'ciclos_medicao' AND registro_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = ?))
         OR (tabela_referencia = 'medicoes' AND registro_id IN (
               SELECT id FROM medicoes
               WHERE ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = ?)
                  OR servico_id IN (SELECT id FROM servicos WHERE obra_id = ?)
             ))
         OR (tabela_referencia = 'fotografias' AND registro_id IN (SELECT id FROM fotografias WHERE obra_id = ?))
         OR (tabela_referencia = 'historico_datas_obra' AND registro_id IN (SELECT id FROM historico_datas_obra WHERE obra_id = ?))
       );`,
    [obraIdStr, obraIdStr, obraIdStr, obraIdStr, obraIdStr, obraIdStr]
  );

  await db.runAsync(
    `DELETE FROM medicoes
     WHERE ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = ?)
        OR servico_id IN (SELECT id FROM servicos WHERE obra_id = ?);`,
    [obraIdStr, obraIdStr]
  );
  await db.runAsync(`DELETE FROM fotografias WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM relatorios_fotograficos WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM historico_datas_obra WHERE obra_id = ?;`, [obraIdStr]).catch(() => {});
  await db.runAsync(`DELETE FROM servicos WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM etapas WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM ciclos_medicao WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM planilhas_base WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM obras WHERE id = ?;`, [obraIdStr]);

  await enfileirarOperacao(
    {
      tabelaReferencia: "obras",
      registroId: obraIdStr,
      operacao: "delete",
      acao: "deletar",
      usuarioId,
      payload: { id: obraIdStr, usuario_id: usuarioId },
    },
    db
  );
  return { id: obraIdStr, deletada: true };
};

/**
 * Salva a estrutura completa de etapas, serviços e ciclo inicial no SQLite local.
 * Quando sincronizado = false (importação feita offline), enfileira na fila_sincronizacao.
 */
const converterNumeroOrcamentoLocal = (valor, padrao = 0) => {
  if (valor === null || valor === undefined || valor === "") return padrao;
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : padrao;
  }
  let limpo = String(valor)
    .trim()
    .replace(/^R\$\s*/i, "")
    .trim();
  if (!limpo) return padrao;
  if (limpo.includes(",") && limpo.includes(".")) {
    if (limpo.lastIndexOf(",") > limpo.lastIndexOf(".")) {
      limpo = limpo.replace(/\./g, "").replace(",", ".");
    } else {
      limpo = limpo.replace(/,/g, "");
    }
  } else if (limpo.includes(",")) {
    limpo = limpo.replace(",", ".");
  }
  limpo = limpo.replace(/[^0-9.-]/g, "");
  const num = Number(limpo);
  return Number.isFinite(num) ? num : padrao;
};

export const salvarEstruturaPlanilhaLocal = async (
  { obraId, nomeArquivo = "planilha_padrao.xlsx", etapas = [], sincronizado = false },
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  if (!sincronizado) {
    const obraCheck = await obterObraLocalPorId(obraId, db).catch(() => null);
    if (obraCheck?.status && obraCheck.status !== "ativa") {
      throw new Error(
        `Não é possível importar planilha orçamentária em uma obra ${obraCheck.status}.`
      );
    }

    const medCheck = await db
      .getFirstAsync(
        `SELECT COUNT(m.id) AS total
         FROM medicoes m
         INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
         WHERE c.obra_id = ?;`,
        [String(obraId)]
      )
      .catch(() => null);
    if (Number(medCheck?.total || 0) > 0) {
      throw new Error(
        "Esta obra já possui medições registradas. Não é possível sobrescrever a planilha orçamentária base."
      );
    }
  }

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
      const qtdOrcada = converterNumeroOrcamentoLocal(
        sRaw.quantidade_orcada ?? sRaw.quantidade,
        0
      );
      const precoUnit = converterNumeroOrcamentoLocal(
        sRaw.preco_unitario ?? sRaw.valor_unitario,
        0
      );
      const precoTotalInformado =
        sRaw.preco_total !== undefined &&
        sRaw.preco_total !== null &&
        String(sRaw.preco_total).trim() !== ""
          ? converterNumeroOrcamentoLocal(sRaw.preco_total, NaN)
          : sRaw.preco_total_orcado !== undefined &&
              sRaw.preco_total_orcado !== null
            ? converterNumeroOrcamentoLocal(sRaw.preco_total_orcado, NaN)
            : NaN;
      const precoTotal =
        Number.isFinite(precoTotalInformado) && precoTotalInformado > 0
          ? precoTotalInformado
          : Number((qtdOrcada * precoUnit).toFixed(4));
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
    const obraLocal = await obterObraLocalPorId(obraId, db).catch(() => null);
    await enfileirarOperacao(
      {
        tabelaReferencia: "planilhas_base",
        registroId: String(obraId),
        operacao: "insert",
        acao: "importar_planilha",
        usuarioId: obraLocal?.usuario_id || null,
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
      `SELECT * FROM ciclos_medicao WHERE id = ? AND obra_id = ?;`,
      [String(cicloIdParam), String(obraId)]
    );
    if (!ciclo) return null;
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
    status: obra.status || "ativa",
    endereco: obra.endereco || "",
    ciclo_ativo: ciclo || null,
    progresso_geral_percentual: Number(progressoGeral.toFixed(2)),
    valor_executado_total: Number(valorExecutadoObra.toFixed(2)),
    valor_orcado_total: Number(valorOrcadoObra.toFixed(2)),
    etapas,
  };
};

export const contarObrasLocaisPorUsuario = async (
  usuarioId = null,
  dbOverride = null
) => {
  const limpo = usuarioId ? String(usuarioId).trim() : "";
  if (!limpo || limpo === "local_user") {
    return 0;
  }
  const db = dbOverride || (await getDbConnection());
  const row = await db.getFirstAsync(
    `SELECT COUNT(*) AS total FROM obras WHERE deleted_at IS NULL AND usuario_id = ?;`,
    [limpo]
  );
  return Number(row?.total || 0);
};

/**
 * Remove localmente uma obra e seus filhos por tombstone vindo do servidor (sem enfileirar delete).
 */
export const removerObraPorTombstoneLocal = async (
  id,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const obraIdStr = String(id);
  await db.runAsync(
    `DELETE FROM medicoes
     WHERE ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = ?)
        OR servico_id IN (SELECT id FROM servicos WHERE obra_id = ?);`,
    [obraIdStr, obraIdStr]
  );
  await db.runAsync(`DELETE FROM fotografias WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM relatorios_fotograficos WHERE obra_id = ?;`, [
    obraIdStr,
  ]);
  await db
    .runAsync(`DELETE FROM historico_datas_obra WHERE obra_id = ?;`, [
      obraIdStr,
    ])
    .catch(() => {});
  await db.runAsync(`DELETE FROM servicos WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM etapas WHERE obra_id = ?;`, [obraIdStr]);
  await db.runAsync(`DELETE FROM ciclos_medicao WHERE obra_id = ?;`, [
    obraIdStr,
  ]);
  await db.runAsync(`DELETE FROM planilhas_base WHERE obra_id = ?;`, [
    obraIdStr,
  ]);
  await db.runAsync(`DELETE FROM obras WHERE id = ?;`, [obraIdStr]);
};

/**
 * Expurga localmente detalhes pesados de obras arquivadas há mais de 6 meses já sincronizadas (RN15).
 */
export const expurgarObrasArquivadasAntigasLocal = async (
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const limite = new Date();
  limite.setMonth(limite.getMonth() - 6);
  const limiteIso = limite.toISOString();

  const antigas =
    (await db.getAllAsync(
      `SELECT id FROM obras
       WHERE status = 'arquivada'
         AND sync_status = 'synced'
         AND data_arquivamento IS NOT NULL
         AND data_arquivamento < ?;`,
      [limiteIso]
    )) || [];

  for (const obra of antigas) {
    const pend = await db
      .getFirstAsync(
        `SELECT id FROM fila_sincronizacao
         WHERE registro_id = ? AND status IN ('pendente', 'enviando')
         LIMIT 1;`,
        [String(obra.id)]
      )
      .catch(() => null);
    if (pend) continue;

    await db.runAsync(
      `DELETE FROM medicoes
       WHERE ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = ?);`,
      [String(obra.id)]
    );
    await db.runAsync(`DELETE FROM fotografias WHERE obra_id = ?;`, [
      String(obra.id),
    ]);
    await db.runAsync(`DELETE FROM servicos WHERE obra_id = ?;`, [
      String(obra.id),
    ]);
    await db.runAsync(`DELETE FROM etapas WHERE obra_id = ?;`, [
      String(obra.id),
    ]);
    await db.runAsync(`DELETE FROM ciclos_medicao WHERE obra_id = ?;`, [
      String(obra.id),
    ]);
    await db.runAsync(`DELETE FROM planilhas_base WHERE obra_id = ?;`, [
      String(obra.id),
    ]);
  }
};

const formatarDataPtBrLocal = (valor) => {
  if (!valor) return "";
  const str = String(valor).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return str;
  const iso = str.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [ano, mes, dia] = iso.split("-");
    return `${dia}/${mes}/${ano}`;
  }
  return str;
};

/**
 * Salva um registro de histórico de prazo vindo do Pull ou da API no SQLite local.
 */
export const upsertHistoricoDataObraLocal = async (
  item,
  dbOverride = null
) => {
  if (!item || !item.id || !item.obra_id) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO historico_datas_obra (
      id, obra_id, usuario_id, data_anterior, data_conclusao, dias_adicionados, motivo, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      data_anterior = excluded.data_anterior,
      data_conclusao = excluded.data_conclusao,
      dias_adicionados = excluded.dias_adicionados,
      motivo = excluded.motivo;`,
    [
      String(item.id),
      String(item.obra_id),
      item.usuario_id ? String(item.usuario_id) : null,
      normalizarDataLocal(item.data_anterior) || String(item.data_anterior || ""),
      normalizarDataLocal(item.data_conclusao) || String(item.data_conclusao || ""),
      Number(item.dias_adicionados || 0),
      item.motivo || null,
      item.created_at || agora,
    ]
  );
};

/**
 * Lista o histórico de conclusão de uma obra a partir do SQLite local (mesmo formato do backend).
 */
export const listarHistoricoConclusaoLocal = async (
  obraId,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const rows =
    (await db.getAllAsync(
      `SELECT * FROM historico_datas_obra
       WHERE obra_id = ?
       ORDER BY created_at DESC;`,
      [String(obraId)]
    )) || [];

  const historico = rows.map((r) => ({
    id: r.id,
    obra_id: r.obra_id,
    usuario_id: r.usuario_id,
    data_anterior: formatarDataPtBrLocal(r.data_anterior),
    data_conclusao: formatarDataPtBrLocal(r.data_conclusao),
    dias_adicionados: Number(r.dias_adicionados || 0),
    tempo_adicionado: `${Number(r.dias_adicionados || 0)} dias`,
    motivo: r.motivo || null,
    created_at: r.created_at,
  }));

  let ultimaAtualizacao = null;
  if (historico.length > 0 && historico[0].created_at) {
    const d = new Date(historico[0].created_at);
    if (!isNaN(d.getTime())) {
      const dia = String(d.getDate()).padStart(2, "0");
      const mes = String(d.getMonth() + 1).padStart(2, "0");
      const ano = d.getFullYear();
      const horas = String(d.getHours()).padStart(2, "0");
      const minutos = String(d.getMinutes()).padStart(2, "0");
      ultimaAtualizacao = `${dia}/${mes}/${ano} às ${horas}:${minutos}`;
    }
  }

  return {
    ultima_atualizacao: ultimaAtualizacao,
    historico,
  };
};

export const obterResumoFiltrosObraLocal = async (
  obraId,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const resumo = await db.getFirstAsync(
    `SELECT
       (SELECT COUNT(*)
        FROM ciclos_medicao
        WHERE obra_id = ?) AS quantidade_ciclos,
       (SELECT MAX(COALESCE(m.updated_at, m.created_at))
        FROM medicoes m
        INNER JOIN ciclos_medicao c ON c.id = m.ciclo_id
        WHERE c.obra_id = ?
          AND CAST(COALESCE(m.quantidade_medida_periodo, 0) AS REAL) > 0) AS data_ultima_medicao;`,
    [String(obraId), String(obraId)]
  );

  return {
    quantidade_ciclos: Number(resumo?.quantidade_ciclos || 0),
    data_ultima_medicao: resumo?.data_ultima_medicao || null,
  };
};

export default {
  upsertObraSincronizada,
  criarObraLocal,
  listarObrasLocais,
  obterObraLocalPorId,
  contarObrasLocaisPorUsuario,
  atualizarObraLocal,
  arquivarObraLocal,
  desarquivarObraLocal,
  encerrarObraLocal,
  deletarObraLocal,
  removerObraPorTombstoneLocal,
  expurgarObrasArquivadasAntigasLocal,
  upsertHistoricoDataObraLocal,
  listarHistoricoConclusaoLocal,
  salvarEstruturaPlanilhaLocal,
  obterEstruturaObraLocal,
  obterResumoFiltrosObraLocal,
};

