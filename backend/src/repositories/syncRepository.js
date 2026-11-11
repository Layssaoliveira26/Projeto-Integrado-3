const crypto = require("node:crypto");
const { pool, query } = require("../config/db");

/**
 * Garante que a tabela de fotografias existe no PostgreSQL para ambientes onde o banco já havia sido inicializado.
 */
const garantirTabelaFotografias = async () => {
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

  const cicloCheck = cicloAlvoId
    ? await query(`SELECT id FROM ciclos_medicao WHERE id = $1;`, [
        cicloAlvoId,
      ]).catch(() => ({ rows: [] }))
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
         id = COALESCE($1::uuid, ciclos_medicao.id),
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

  const cicloCheck = await query(
    `SELECT id FROM ciclos_medicao WHERE id = $1;`,
    [ciclo_id]
  );

  if (cicloCheck.rows.length === 0 && servico_id) {
    const servicoRes = await query(
      `SELECT obra_id FROM servicos WHERE id = $1;`,
      [servico_id]
    );
    const obraId = servicoRes.rows[0]?.obra_id;
    if (obraId) {
      const cicloObra = await query(
        `SELECT id FROM ciclos_medicao WHERE obra_id = $1 ORDER BY numero_ciclo ASC LIMIT 1;`,
        [obraId]
      );
      if (cicloObra.rows[0]?.id) {
        cicloAlvoId = cicloObra.rows[0].id;
      }
    }
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

/**
 * Busca todos os dados pertencentes ao usuário autenticado para hidratação local (Pull Sync).
 */
const buscarDadosCompletosPorUsuario = async (usuarioId) => {
  await garantirTabelaFotografias();

  const obrasRes = await query(
    `SELECT * FROM obras WHERE usuario_id = $1 AND deleted_at IS NULL ORDER BY created_at DESC;`,
    [usuarioId]
  );

  const etapasRes = await query(
    `SELECT e.* FROM etapas e
     INNER JOIN obras o ON e.obra_id = o.id
     WHERE o.usuario_id = $1
     ORDER BY e.ordem ASC;`,
    [usuarioId]
  );

  const servicosRes = await query(
    `SELECT s.* FROM servicos s
     INNER JOIN obras o ON s.obra_id = o.id
     WHERE o.usuario_id = $1
     ORDER BY s.ordem ASC;`,
    [usuarioId]
  );

  const ciclosRes = await query(
    `SELECT c.* FROM ciclos_medicao c
     INNER JOIN obras o ON c.obra_id = o.id
     WHERE o.usuario_id = $1
     ORDER BY c.numero_ciclo ASC;`,
    [usuarioId]
  );

  const medicoesRes = await query(
    `SELECT m.* FROM medicoes m
     INNER JOIN ciclos_medicao c ON m.ciclo_id = c.id
     INNER JOIN obras o ON c.obra_id = o.id
     WHERE o.usuario_id = $1;`,
    [usuarioId]
  );

  const fotosRes = await query(
    `SELECT f.* FROM fotografias f
     INNER JOIN obras o ON f.obra_id = o.id
     WHERE o.usuario_id = $1
     ORDER BY f.data_hora_captura DESC;`,
    [usuarioId]
  );

  return {
    obras: obrasRes.rows || [],
    etapas: etapasRes.rows || [],
    servicos: servicosRes.rows || [],
    ciclos: ciclosRes.rows || [],
    medicoes: medicoesRes.rows || [],
    fotografias: fotosRes.rows || [],
  };
};

module.exports = {
  garantirTabelaFotografias,
  upsertFotografia,
  deletarFotografia,
  encerrarCicloIdempotente,
  upsertMedicaoSincronizadaDireta,
  buscarDadosCompletosPorUsuario,
};

