const crypto = require("node:crypto");
const { pool, query } = require("../config/db");

/**
 * Garante que a tabela de fotografias existe no PostgreSQL para ambientes onde o banco já havia sido inicializado.
 */
const garantirTabelaFotografias = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS fotografias (
      id UUID PRIMARY KEY,
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
  const fotoId = id || crypto.randomUUID();
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
    obra_id,
    ciclo_id,
    servico_id || null,
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
  novoCiclo,
  dataEncerramento,
  usuarioId,
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cicloRes = await client.query(
      `SELECT c.*, o.usuario_id
       FROM ciclos_medicao c
       JOIN obras o ON c.obra_id = o.id
       WHERE c.id = $1 FOR UPDATE;`,
      [cicloEncerradoId]
    );

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
      [cicloEncerradoId, dataEncerramento || null]
    );

    const novoCicloId = novoCiclo?.id || crypto.randomUUID();
    const proximoNumero =
      Number(novoCiclo?.numero_ciclo) || Number(cicloAtual.numero_ciclo) + 1;

    const novoRes = await client.query(
      `INSERT INTO ciclos_medicao (id, obra_id, numero_ciclo, status, data_inicio)
       VALUES ($1, $2, $3, 'aberto', COALESCE($4::timestamptz, NOW()))
       ON CONFLICT (obra_id, numero_ciclo) DO UPDATE SET
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
  buscarDadosCompletosPorUsuario,
};
