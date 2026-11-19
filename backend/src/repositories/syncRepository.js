const crypto = require("node:crypto");
const { pool, query } = require("../config/db");

let tabelaFotografiasVerificada = false;
let tabelaExclusoesVerificada = false;
let tabelaObrasCapaVerificada = false;

const resetarCacheVerificacaoTabelas = () => {
  tabelaFotografiasVerificada = false;
  tabelaExclusoesVerificada = false;
  tabelaObrasCapaVerificada = false;
};

/**
 * Garante que a tabela de fotografias existe no PostgreSQL (executado apenas 1x por processo).
 */
const garantirTabelaFotografias = async () => {
  if (tabelaFotografiasVerificada) return;
  await query(`
    CREATE TABLE IF NOT EXISTS fotografias (
      id VARCHAR(100) PRIMARY KEY,
      obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      ciclo_id UUID NOT NULL REFERENCES ciclos_medicao(id) ON DELETE CASCADE,
      servico_id UUID REFERENCES servicos(id) ON DELETE CASCADE,
      usuario_id UUID NOT NULL REFERENCES usuarios(id),
      caminho_local TEXT,
      caminho_comprimido TEXT,
      url_nuvem TEXT,
      arquivo_base64 TEXT,
      latitude NUMERIC(12,8),
      longitude NUMERIC(12,8),
      possui_localizacao INT NOT NULL DEFAULT 0,
      data_hora_captura TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Garante compatibilidade com IDs gerados localmente no mobile (ex: Date.now() ou UUID)
  await query(
    `ALTER TABLE fotografias ALTER COLUMN id TYPE VARCHAR(100) USING id::text;`
  ).catch(() => {});
  await query(
    `ALTER TABLE fotografias ADD COLUMN IF NOT EXISTS arquivo_base64 TEXT;`
  ).catch(() => {});
  tabelaFotografiasVerificada = true;
};

const atualizarImagemCapaObra = async (obraId, usuarioId, imagemCapa) => {
  if (!obraId || !usuarioId) return null;
  if (!tabelaObrasCapaVerificada) {
    await query(
      `ALTER TABLE obras ADD COLUMN IF NOT EXISTS imagem_capa TEXT;`
    ).catch(() => {});
    tabelaObrasCapaVerificada = true;
  }
  const { rows } = await query(
    `UPDATE obras
     SET imagem_capa = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND usuario_id = $3
     RETURNING id, imagem_capa, updated_at;`,
    [imagemCapa || null, obraId, usuarioId]
  );
  return rows[0] || null;
};

/**
 * Garante que a tabela de tombstones (registros excluídos para Delta Pull) existe no PostgreSQL.
 */
const garantirTabelaExclusoesSync = async () => {
  if (tabelaExclusoesVerificada) return;
  await query(`
    CREATE TABLE IF NOT EXISTS registros_excluidos_sync (
      id UUID PRIMARY KEY,
      usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      tabela_referencia VARCHAR(50) NOT NULL,
      registro_id VARCHAR(100) NOT NULL,
      deleted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_excluidos_sync_usuario_data
      ON registros_excluidos_sync(usuario_id, deleted_at);
  `);
  tabelaExclusoesVerificada = true;
};

/**
 * Registra um tombstone de exclusão para propagação aos dispositivos via Delta Pull.
 */
const registrarExclusaoSync = async (
  usuarioId,
  tabelaReferencia,
  registroId
) => {
  if (!usuarioId || !tabelaReferencia || !registroId) return null;
  await garantirTabelaExclusoesSync();
  const id = crypto.randomUUID();
  const { rows } = await query(
    `INSERT INTO registros_excluidos_sync (id, usuario_id, tabela_referencia, registro_id, deleted_at)
     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
     RETURNING *;`,
    [id, usuarioId, tabelaReferencia, String(registroId)]
  );
  return rows[0] || null;
};

/**
 * Salva ou atualiza uma fotografia sincronizada pelo dispositivo móvel (idempotente por UUID).
 */
const upsertFotografia = async ({
  id,
  obra_id,
  ciclo_id,
  servico_id,
  usuario_id,
  caminho_local,
  caminho_comprimido,
  url_nuvem,
  latitude,
  longitude,
  possui_localizacao,
  data_hora_captura,
}) => {
  await garantirTabelaFotografias();
  const fotoId = String(id || crypto.randomUUID());
  let obraAlvoId = obra_id;
  let cicloAlvoId = ciclo_id;
  const servicoAlvoId = servico_id || null;

  // Caso obra_id não tenha vindo no payload mas servico_id sim, resolve obra_id pelo serviço
  if (!obraAlvoId && servicoAlvoId) {
    const srvRes = await query(`SELECT obra_id FROM servicos WHERE id = $1;`, [
      servicoAlvoId,
    ]).catch(() => ({ rows: [] }));
    obraAlvoId = srvRes.rows[0]?.obra_id || null;
  }

  // Se ainda não encontrou obra_id e ciclo_id foi informado, busca pelo ciclo
  if (!obraAlvoId && cicloAlvoId) {
    const cicRes = await query(
      `SELECT obra_id FROM ciclos_medicao WHERE id = $1;`,
      [cicloAlvoId]
    ).catch(() => ({ rows: [] }));
    obraAlvoId = cicRes.rows[0]?.obra_id || null;
  }

  if (!obraAlvoId) {
    throw new Error("Obra de referência da fotografia não encontrada.");
  }

  const obraPermRes = await query(
    `SELECT usuario_id FROM obras WHERE id = $1;`,
    [obraAlvoId]
  );
  if (obraPermRes.rows.length === 0) {
    throw new Error("Obra de referência da fotografia não encontrada.");
  }
  if (obraPermRes.rows[0].usuario_id !== usuario_id) {
    throw new Error("Sem permissão para sincronizar fotografia nesta obra.");
  }

  if (servicoAlvoId) {
    const srvObraRes = await query(
      `SELECT id FROM servicos WHERE id = $1 AND obra_id = $2;`,
      [servicoAlvoId, obraAlvoId]
    );
    if (srvObraRes.rows.length === 0) {
      throw new Error("Serviço informado não pertence à obra da fotografia.");
    }
  }

  const cicloCheck = cicloAlvoId
    ? await query(
        `SELECT id FROM ciclos_medicao WHERE id = $1 AND obra_id = $2;`,
        [cicloAlvoId, obraAlvoId]
      ).catch(() => ({ rows: [] }))
    : { rows: [] };

  if (cicloCheck.rows.length === 0 && obraAlvoId) {
    const cicloObra = await query(
      `SELECT id FROM ciclos_medicao WHERE obra_id = $1 ORDER BY numero_ciclo DESC LIMIT 1;`,
      [obraAlvoId]
    );
    if (cicloObra.rows[0]?.id) {
      cicloAlvoId = cicloObra.rows[0].id;
    }
  }

  const sql = `
    INSERT INTO fotografias (
      id, obra_id, ciclo_id, servico_id, usuario_id,
      caminho_local, caminho_comprimido, url_nuvem,
      latitude, longitude, possui_localizacao, data_hora_captura, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, COALESCE($12::timestamptz, CURRENT_TIMESTAMP), CURRENT_TIMESTAMP)
    ON CONFLICT (id) DO UPDATE SET
      caminho_local = EXCLUDED.caminho_local,
      caminho_comprimido = EXCLUDED.caminho_comprimido,
      url_nuvem = COALESCE(EXCLUDED.url_nuvem, fotografias.url_nuvem),
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      possui_localizacao = EXCLUDED.possui_localizacao,
      updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  const values = [
    fotoId,
    obraAlvoId,
    cicloAlvoId,
    servicoAlvoId,
    usuario_id,
    caminho_local || "",
    caminho_comprimido || "",
    url_nuvem || null,
    latitude ?? null,
    longitude ?? null,
    possui_localizacao ? 1 : 0,
    data_hora_captura || null,
  ];
  const { rows } = await query(sql, values);
  return rows[0];
};

const deletarFotografia = async (id, usuarioId) => {
  await garantirTabelaFotografias();
  const { rows } = await query(
    `DELETE FROM fotografias WHERE id = $1 AND usuario_id = $2 RETURNING *;`,
    [id, usuarioId]
  );
  if (rows[0]) {
    await registrarExclusaoSync(usuarioId, "fotografias", id).catch(() => {});
  }
  return rows[0] || null;
};

/**
 * Encerra um ciclo e cria o próximo ciclo de forma idempotente (preservando o UUID gerado offline pelo cliente).
 */
const encerrarCicloIdempotente = async ({
  cicloEncerradoId,
  obraId,
  novoCiclo,
  dataEncerramento,
  usuarioId,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let cicloRes = await client.query(
      `SELECT c.*, o.usuario_id
       FROM ciclos_medicao c
       JOIN obras o ON c.obra_id = o.id
       WHERE c.id = $1 FOR UPDATE;`,
      [cicloEncerradoId]
    );

    const obraAlvoId = obraId || novoCiclo?.obra_id || null;
    const numeroCicloEncerrado = novoCiclo?.numero_ciclo
      ? Math.max(1, Number(novoCiclo.numero_ciclo) - 1)
      : 1;

    if (cicloRes.rows.length === 0 && obraAlvoId) {
      cicloRes = await client.query(
        `SELECT c.*, o.usuario_id
         FROM ciclos_medicao c
         JOIN obras o ON c.obra_id = o.id
         WHERE c.obra_id = $1 AND c.numero_ciclo = $2 FOR UPDATE;`,
        [obraAlvoId, numeroCicloEncerrado]
      );
    }

    if (cicloRes.rows.length === 0) {
      throw new Error("Ciclo para encerramento não encontrado no servidor.");
    }

    const cicloAtual = cicloRes.rows[0];
    if (cicloAtual.usuario_id !== usuarioId) {
      throw new Error("Sem permissão para encerrar ciclo desta obra.");
    }

    await client.query(
      `UPDATE ciclos_medicao
       SET status = 'encerrado',
           data_encerramento = COALESCE($2::timestamptz, NOW()),
           updated_at = NOW()
       WHERE id = $1;`,
      [cicloAtual.id, dataEncerramento || null]
    );

    const novoCicloId = novoCiclo?.id || crypto.randomUUID();
    const proximoNumero =
      Number(novoCiclo?.numero_ciclo) || Number(cicloAtual.numero_ciclo) + 1;

    const novoRes = await client.query(
      `INSERT INTO ciclos_medicao (id, obra_id, numero_ciclo, status, data_inicio)
       VALUES ($1, $2, $3, 'aberto', COALESCE($4::timestamptz, NOW()))
       ON CONFLICT (obra_id, numero_ciclo) DO UPDATE SET
         id = CASE
           WHEN EXISTS (SELECT 1 FROM medicoes WHERE ciclo_id = ciclos_medicao.id)
             OR EXISTS (SELECT 1 FROM fotografias WHERE ciclo_id = ciclos_medicao.id)
           THEN ciclos_medicao.id
           ELSE COALESCE($1::uuid, ciclos_medicao.id)
         END,
         status = 'aberto',
         updated_at = NOW()
       RETURNING *;`,
      [
        novoCicloId,
        cicloAtual.obra_id,
        proximoNumero,
        novoCiclo?.data_inicio || null,
      ]
    );

    const cicloCriado = novoRes.rows[0];

    await client.query(
      `INSERT INTO medicoes (
        id, ciclo_id, servico_id, usuario_id,
        quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
        saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
        valor_acumulado_atual, percentual_execucao, updated_at
      )
      SELECT
        gen_random_uuid(), $1, servico_id, usuario_id,
        0, quantidade_acumulada_atual, quantidade_acumulada_atual,
        saldo_quantidade, 0, valor_acumulado_atual,
        valor_acumulado_atual, percentual_execucao, NOW()
      FROM medicoes
      WHERE ciclo_id = $2
      ON CONFLICT (ciclo_id, servico_id) DO NOTHING;`,
      [cicloCriado.id, cicloAtual.id]
    );

    await client.query("COMMIT");
    return cicloCriado;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Persiste diretamente uma medição sincronizada (fallback resiliente quando o ciclo já foi
 * encerrado no mesmo lote offline ou quando o UUID do Ciclo 1 precisa ser resolvido pela obra).
 */
const upsertMedicaoSincronizadaDireta = async ({
  id,
  ciclo_id,
  numero_ciclo = null,
  servico_id,
  usuario_id,
  quantidade_medida_periodo,
  quantidade_acumulada_anterior,
  quantidade_acumulada_atual,
  saldo_quantidade,
  valor_medido_periodo,
  valor_acumulado_anterior,
  valor_acumulado_atual,
  percentual_execucao,
}) => {
  const medicaoId = id || crypto.randomUUID();
  let cicloAlvoId = ciclo_id;

  if (!servico_id) {
    throw new Error("Serviço é obrigatório para sincronizar medição.");
  }

  const servicoRes = await query(
    `SELECT s.id, s.obra_id, o.usuario_id
     FROM servicos s
     INNER JOIN obras o ON s.obra_id = o.id
     WHERE s.id = $1;`,
    [servico_id]
  );
  if (servicoRes.rows.length === 0) {
    throw new Error("Serviço não encontrado para sincronizar medição.");
  }

  const { obra_id: obraId, usuario_id: donoObraId } = servicoRes.rows[0];
  if (donoObraId !== usuario_id) {
    throw new Error("Sem permissão para sincronizar medição nesta obra.");
  }

  const cicloCheck = ciclo_id
    ? await query(
        `SELECT id FROM ciclos_medicao WHERE id = $1 AND obra_id = $2;`,
        [ciclo_id, obraId]
      )
    : { rows: [] };

  if (cicloCheck.rows.length === 0) {
    let cicloAlternativo = null;

    if (numero_ciclo !== null && numero_ciclo !== undefined) {
      const porNumero = await query(
        `SELECT id FROM ciclos_medicao WHERE obra_id = $1 AND numero_ciclo = $2 LIMIT 1;`,
        [obraId, Number(numero_ciclo)]
      );
      cicloAlternativo = porNumero.rows[0]?.id || null;
    }

    if (!cicloAlternativo) {
      const cicloAberto = await query(
        `SELECT id FROM ciclos_medicao WHERE obra_id = $1 AND status = 'aberto' ORDER BY numero_ciclo DESC LIMIT 1;`,
        [obraId]
      );
      cicloAlternativo = cicloAberto.rows[0]?.id || null;
    }

    if (!cicloAlternativo) {
      throw new Error(
        "Ciclo de medição correspondente não encontrado para sincronizar medição."
      );
    }
    cicloAlvoId = cicloAlternativo;
  }

  const sql = `
    INSERT INTO medicoes (
      id, ciclo_id, servico_id, usuario_id,
      quantidade_medida_periodo, quantidade_acumulada_anterior, quantidade_acumulada_atual,
      saldo_quantidade, valor_medido_periodo, valor_acumulado_anterior,
      valor_acumulado_atual, percentual_execucao, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    ON CONFLICT (ciclo_id, servico_id) DO UPDATE SET
      quantidade_medida_periodo = EXCLUDED.quantidade_medida_periodo,
      quantidade_acumulada_anterior = EXCLUDED.quantidade_acumulada_anterior,
      quantidade_acumulada_atual = EXCLUDED.quantidade_acumulada_atual,
      saldo_quantidade = EXCLUDED.saldo_quantidade,
      valor_medido_periodo = EXCLUDED.valor_medido_periodo,
      valor_acumulado_anterior = EXCLUDED.valor_acumulado_anterior,
      valor_acumulado_atual = EXCLUDED.valor_acumulado_atual,
      percentual_execucao = EXCLUDED.percentual_execucao,
      usuario_id = EXCLUDED.usuario_id,
      updated_at = NOW()
    RETURNING *;
  `;

  const values = [
    medicaoId,
    cicloAlvoId,
    servico_id,
    usuario_id,
    Number(quantidade_medida_periodo ?? 0),
    Number(quantidade_acumulada_anterior ?? 0),
    Number(quantidade_acumulada_atual ?? 0),
    Number(saldo_quantidade ?? 0),
    Number(valor_medido_periodo ?? 0),
    Number(valor_acumulado_anterior ?? 0),
    Number(valor_acumulado_atual ?? 0),
    Number(percentual_execucao ?? 0),
  ];

  const { rows } = await query(sql, values);
  return rows[0];
};

const salvarArquivoFotografia = async ({ fotoId, usuarioId, base64 }) => {
  await garantirTabelaFotografias();

  const busca = await query(
    `SELECT f.id, o.usuario_id AS obra_usuario_id
     FROM fotografias f
     INNER JOIN obras o ON f.obra_id = o.id
     WHERE f.id = $1;`,
    [String(fotoId)]
  );

  if (busca.rows.length === 0) {
    const err = new Error("Fotografia não encontrada.");
    err.statusCode = 404;
    throw err;
  }

  if (busca.rows[0].obra_usuario_id !== usuarioId) {
    const err = new Error(
      "Sem permissão para enviar arquivo desta fotografia."
    );
    err.statusCode = 403;
    throw err;
  }

  const urlNuvem = `/sync/fotos/${encodeURIComponent(String(fotoId))}/arquivo`;
  const { rows } = await query(
    `UPDATE fotografias
     SET arquivo_base64 = $1,
         url_nuvem = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $3
     RETURNING id, url_nuvem, updated_at;`,
    [String(base64), urlNuvem, String(fotoId)]
  );
  return rows[0];
};

const obterArquivoFotografia = async (fotoId, usuarioId) => {
  await garantirTabelaFotografias();

  const { rows } = await query(
    `SELECT f.id, f.arquivo_base64, f.url_nuvem, f.updated_at, o.usuario_id AS obra_usuario_id
     FROM fotografias f
     INNER JOIN obras o ON f.obra_id = o.id
     WHERE f.id = $1;`,
    [String(fotoId)]
  );

  if (rows.length === 0) {
    const err = new Error("Fotografia não encontrada.");
    err.statusCode = 404;
    throw err;
  }

  if (rows[0].obra_usuario_id !== usuarioId) {
    const err = new Error(
      "Sem permissão para acessar arquivo desta fotografia."
    );
    err.statusCode = 403;
    throw err;
  }

  if (!rows[0].arquivo_base64) {
    const err = new Error(
      "Arquivo da fotografia ainda não foi enviado para a nuvem."
    );
    err.statusCode = 404;
    throw err;
  }

  return {
    id: rows[0].id,
    base64: rows[0].arquivo_base64,
    url_nuvem: rows[0].url_nuvem,
    updated_at: rows[0].updated_at,
  };
};

const COLUNAS_FOTOGRAFIA_PULL = `
  f.id, f.obra_id, f.ciclo_id, f.servico_id, f.usuario_id,
  f.caminho_local, f.caminho_comprimido, f.url_nuvem,
  f.latitude, f.longitude, f.possui_localizacao,
  f.data_hora_captura, f.created_at, f.updated_at,
  (f.arquivo_base64 IS NOT NULL) AS possui_arquivo_nuvem
`;

/**
 * Busca os dados do usuário autenticado para hidratação local (Full ou Delta Pull via `since`).
 * Em Full Pull, respeita a RN15 omitindo detalhes pesados de obras arquivadas há mais de 6 meses.
 * Omite arquivo_base64 de fotografias para manter o Pull JSON leve.
 */
const buscarDadosCompletosPorUsuario = async (usuarioId, opcoes = {}) => {
  await garantirTabelaFotografias();

  const { since = null } = opcoes || {};
  let sinceIso = null;
  if (since) {
    const dt = new Date(since);
    if (!isNaN(dt.getTime())) {
      sinceIso = dt.toISOString();
    }
  }

  if (sinceIso) {
    const params = [usuarioId, sinceIso];

    const obrasRes = await query(
      `SELECT * FROM obras
       WHERE usuario_id = $1 AND deleted_at IS NULL AND updated_at > $2::timestamptz
       ORDER BY created_at DESC;`,
      params
    );

    const etapasRes = await query(
      `SELECT e.* FROM etapas e
       INNER JOIN obras o ON e.obra_id = o.id
       WHERE o.usuario_id = $1 AND o.deleted_at IS NULL AND e.updated_at > $2::timestamptz
       ORDER BY e.ordem ASC;`,
      params
    );

    const servicosRes = await query(
      `SELECT s.* FROM servicos s
       INNER JOIN obras o ON s.obra_id = o.id
       WHERE o.usuario_id = $1 AND o.deleted_at IS NULL AND s.updated_at > $2::timestamptz
       ORDER BY s.ordem ASC;`,
      params
    );

    const ciclosRes = await query(
      `SELECT c.* FROM ciclos_medicao c
       INNER JOIN obras o ON c.obra_id = o.id
       WHERE o.usuario_id = $1 AND o.deleted_at IS NULL AND c.updated_at > $2::timestamptz
       ORDER BY c.numero_ciclo ASC;`,
      params
    );

    const medicoesRes = await query(
      `SELECT m.* FROM medicoes m
       INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
       INNER JOIN obras o ON c.obra_id = o.id
       WHERE o.usuario_id = $1 AND o.deleted_at IS NULL AND m.updated_at > $2::timestamptz;`,
      params
    );

    const fotosRes = await query(
      `SELECT ${COLUNAS_FOTOGRAFIA_PULL} FROM fotografias f
       INNER JOIN obras o ON f.obra_id = o.id
       WHERE o.usuario_id = $1 AND o.deleted_at IS NULL AND f.updated_at > $2::timestamptz
       ORDER BY f.data_hora_captura DESC;`,
      params
    );

    const historicoRes = await query(
      `SELECT h.* FROM historico_datas_obra h
       INNER JOIN obras o ON h.obra_id = o.id
       WHERE o.usuario_id = $1 AND o.deleted_at IS NULL AND h.created_at > $2::timestamptz
       ORDER BY h.created_at DESC;`,
      params
    ).catch(() => ({ rows: [] }));

    let excluidosRows = [];
    try {
      await garantirTabelaExclusoesSync();
      const excluidosRes = await query(
        `SELECT tabela_referencia, registro_id, deleted_at
         FROM registros_excluidos_sync
         WHERE usuario_id = $1 AND deleted_at > $2::timestamptz
         ORDER BY deleted_at ASC;`,
        params
      );
      excluidosRows = excluidosRes.rows || [];
    } catch {
      excluidosRows = [];
    }

    return {
      modo: "delta",
      obras: obrasRes.rows || [],
      etapas: etapasRes.rows || [],
      servicos: servicosRes.rows || [],
      ciclos: ciclosRes.rows || [],
      medicoes: medicoesRes.rows || [],
      fotografias: fotosRes.rows || [],
      historico_datas_obra: historicoRes.rows || [],
      excluidos: excluidosRows,
    };
  }

  const obrasRes = await query(
    `SELECT * FROM obras WHERE usuario_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC;`,
    [usuarioId]
  );

  const etapasRes = await query(
    `SELECT e.* FROM etapas e
     INNER JOIN obras o ON e.obra_id = o.id
     WHERE o.usuario_id = $1
       AND o.deleted_at IS NULL
       AND NOT (o.status = 'arquivada' AND o.data_arquivamento IS NOT NULL AND o.data_arquivamento < NOW() - INTERVAL '6 months')
     ORDER BY e.ordem ASC;`,
    [usuarioId]
  );

  const servicosRes = await query(
    `SELECT s.* FROM servicos s
     INNER JOIN obras o ON s.obra_id = o.id
     WHERE o.usuario_id = $1
       AND o.deleted_at IS NULL
       AND NOT (o.status = 'arquivada' AND o.data_arquivamento IS NOT NULL AND o.data_arquivamento < NOW() - INTERVAL '6 months')
     ORDER BY s.ordem ASC;`,
    [usuarioId]
  );

  const ciclosRes = await query(
    `SELECT c.* FROM ciclos_medicao c
     INNER JOIN obras o ON c.obra_id = o.id
     WHERE o.usuario_id = $1
       AND o.deleted_at IS NULL
       AND NOT (o.status = 'arquivada' AND o.data_arquivamento IS NOT NULL AND o.data_arquivamento < NOW() - INTERVAL '6 months')
     ORDER BY c.numero_ciclo ASC;`,
    [usuarioId]
  );

  const medicoesRes = await query(
    `SELECT m.* FROM medicoes m
     INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
     INNER JOIN obras o ON c.obra_id = o.id
     WHERE o.usuario_id = $1
       AND o.deleted_at IS NULL
       AND NOT (o.status = 'arquivada' AND o.data_arquivamento IS NOT NULL AND o.data_arquivamento < NOW() - INTERVAL '6 months');`,
    [usuarioId]
  );

  const fotosRes = await query(
    `SELECT ${COLUNAS_FOTOGRAFIA_PULL} FROM fotografias f
     INNER JOIN obras o ON f.obra_id = o.id
     WHERE o.usuario_id = $1
       AND o.deleted_at IS NULL
       AND NOT (o.status = 'arquivada' AND o.data_arquivamento IS NOT NULL AND o.data_arquivamento < NOW() - INTERVAL '6 months')
     ORDER BY f.data_hora_captura DESC;`,
    [usuarioId]
  );

  const historicoRes = await query(
    `SELECT h.* FROM historico_datas_obra h
     INNER JOIN obras o ON h.obra_id = o.id
     WHERE o.usuario_id = $1 AND o.deleted_at IS NULL
     ORDER BY h.created_at DESC;`,
    [usuarioId]
  ).catch(() => ({ rows: [] }));

  return {
    modo: "full",
    obras: obrasRes.rows || [],
    etapas: etapasRes.rows || [],
    servicos: servicosRes.rows || [],
    ciclos: ciclosRes.rows || [],
    medicoes: medicoesRes.rows || [],
    fotografias: fotosRes.rows || [],
    historico_datas_obra: historicoRes.rows || [],
    excluidos: [],
  };
};

module.exports = {
  resetarCacheVerificacaoTabelas,
  garantirTabelaFotografias,
  garantirTabelaExclusoesSync,
  registrarExclusaoSync,
  atualizarImagemCapaObra,
  salvarArquivoFotografia,
  obterArquivoFotografia,
  upsertFotografia,
  deletarFotografia,
  encerrarCicloIdempotente,
  upsertMedicaoSincronizadaDireta,
  buscarDadosCompletosPorUsuario,
};

