const crypto = require("crypto");
const { pool, query } = require("../config/db");

let estruturaObrasVerificada = false;

const garantirEstruturaBancoObras = async (executor = { query }) => {
  if (estruturaObrasVerificada) return;
  await executor.query(`
    CREATE TABLE IF NOT EXISTS fotos_medicao (
      id UUID PRIMARY KEY,
      medicao_id UUID NOT NULL REFERENCES medicoes(id) ON DELETE CASCADE,
      usuario_id UUID NOT NULL REFERENCES usuarios(id),
      caminho_arquivo VARCHAR(500) NOT NULL,
      legenda VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS historico_datas_obra (
      id UUID PRIMARY KEY,
      obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
      usuario_id UUID NOT NULL REFERENCES usuarios(id),
      data_anterior DATE NOT NULL,
      data_conclusao DATE NOT NULL,
      dias_adicionados INT NOT NULL,
      motivo TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
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
    ALTER TABLE obras ADD COLUMN IF NOT EXISTS data_arquivamento TIMESTAMP WITH TIME ZONE;
    ALTER TABLE obras DROP CONSTRAINT IF EXISTS obras_status_check;
    ALTER TABLE obras ADD CONSTRAINT obras_status_check CHECK (status IN ('ativa', 'arquivada', 'encerrada'));
  `);
  estruturaObrasVerificada = true;
};

const criar = async ({ id, nome, endereco, data_inicio, data_conclusao, descricao, usuarioId }) => {
  const obraId = id || crypto.randomUUID();
  const sql = `
    INSERT INTO obras (id, usuario_id, nome, endereco, data_inicio, data_conclusao, descricao, sync_status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'synced')
    ON CONFLICT (id) DO UPDATE SET
      nome = EXCLUDED.nome,
      endereco = EXCLUDED.endereco,
      data_inicio = EXCLUDED.data_inicio,
      data_conclusao = EXCLUDED.data_conclusao,
      descricao = EXCLUDED.descricao,
      sync_status = 'synced',
      updated_at = CURRENT_TIMESTAMP
    WHERE obras.usuario_id = EXCLUDED.usuario_id
    RETURNING *;
  `;
  const values = [
    obraId,
    usuarioId,
    nome,
    endereco,
    data_inicio || null,
    data_conclusao || null,
    descricao || null,
  ];
  const { rows } = await query(sql, values);
  if (!rows || rows.length === 0) {
    const err = new Error(
      "Sem permissão para sobrescrever uma obra pertencente a outro usuário."
    );
    err.statusCode = 403;
    throw err;
  }
  return rows[0];
};

const buscarPorId = async (id, usuarioId) => {
  const sql = `
    SELECT * FROM obras 
    WHERE id = $1 AND usuario_id = $2
  `;
  const { rows } = await query(sql, [id, usuarioId]);
  return rows[0] || null;
};

const listarPorUsuario = async (
  usuarioId,
  incluirArquivadas = false,
  incluirEncerradas = false
) => {
  let sql = `
    SELECT * FROM obras 
    WHERE usuario_id = $1
  `;
  const values = [usuarioId];

  if (!incluirArquivadas && !incluirEncerradas) {
    sql += ` AND status = 'ativa'`;
  } else if (incluirArquivadas && !incluirEncerradas) {
    sql += ` AND status IN ('ativa', 'arquivada')`;
  } else if (!incluirArquivadas && incluirEncerradas) {
    sql += ` AND status IN ('ativa', 'encerrada')`;
  }
  
  sql += ` ORDER BY created_at DESC`;

  const { rows } = await query(sql, values);
  return rows;
};

const atualizar = async (id, usuarioId, { nome, endereco, data_inicio, data_conclusao, descricao }) => {
  const sql = `
    UPDATE obras 
    SET nome = $1, endereco = $2, data_inicio = $3, data_conclusao = $4, descricao = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6 AND usuario_id = $7
    RETURNING *;
  `;
  const values = [
    nome,
    endereco,
    data_inicio || null,
    data_conclusao || null,
    descricao || null,
    id,
    usuarioId,
  ];
  const { rows } = await query(sql, values);
  return rows[0] || null;
};

const deletar = async (id, usuarioId, retentativa = false) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const obra = await client.query(
      `SELECT id FROM obras
       WHERE id = $1 AND usuario_id = $2
       FOR UPDATE;`,
      [id, usuarioId]
    );

    if (obra.rows.length === 0) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(
      `DELETE FROM fotos_medicao
       WHERE medicao_id IN (
         SELECT m.id
         FROM medicoes m
         WHERE m.ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = $1)
            OR m.servico_id IN (SELECT id FROM servicos WHERE obra_id = $1)
       );`,
      [id]
    );
    await client.query(
      `DELETE FROM fotografias
       WHERE obra_id = $1
          OR ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = $1)
          OR servico_id IN (SELECT id FROM servicos WHERE obra_id = $1);`,
      [id]
    );
    await client.query(
      `DELETE FROM medicoes
       WHERE ciclo_id IN (SELECT id FROM ciclos_medicao WHERE obra_id = $1)
          OR servico_id IN (SELECT id FROM servicos WHERE obra_id = $1);`,
      [id]
    );
    await client.query("DELETE FROM planilhas_base WHERE obra_id = $1;", [id]);
    await client.query("DELETE FROM historico_datas_obra WHERE obra_id = $1;", [
      id,
    ]);
    await client.query("DELETE FROM servicos WHERE obra_id = $1;", [id]);
    await client.query("DELETE FROM etapas WHERE obra_id = $1;", [id]);
    await client.query("DELETE FROM ciclos_medicao WHERE obra_id = $1;", [id]);

    const resultado = await client.query(
      `DELETE FROM obras
       WHERE id = $1 AND usuario_id = $2
       RETURNING *;`,
      [id, usuarioId]
    );
    await client.query("COMMIT");
    return resultado.rows[0] || null;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    if (error.code === "42P01" && !retentativa) {
      await garantirEstruturaBancoObras(client);
      client.release();
      return deletar(id, usuarioId, true);
    }
    throw error;
  } finally {
    try {
      client.release();
    } catch {}
  }
};

const mudarStatus = async (id, usuarioId, status) => {
  const sql = `
    UPDATE obras 
    SET status = $1,
        data_arquivamento = CASE
          WHEN $1 = 'arquivada' THEN COALESCE(data_arquivamento, CURRENT_TIMESTAMP)
          ELSE NULL
        END,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND usuario_id = $3
    RETURNING *;
  `;
  const values = [status, id, usuarioId];
  let obraAtualizada = null;
  try {
    const { rows } = await query(sql, values);
    obraAtualizada = rows[0] || null;
  } catch (error) {
    if (error.code === "23514" || error.code === "42703") {
      await garantirEstruturaBancoObras();
      const { rows } = await query(sql, values);
      obraAtualizada = rows[0] || null;
    } else {
      throw error;
    }
  }

  if (obraAtualizada && status === "encerrada") {
    await query(
      `UPDATE ciclos_medicao
       SET status = 'encerrado',
           data_encerramento = COALESCE(data_encerramento, NOW()),
           updated_at = NOW()
       WHERE obra_id = $1 AND status = 'aberto';`,
      [id]
    ).catch(() => {});
  }

  return obraAtualizada;
};

const registrarHistoricoConclusao = async ({
  obraId,
  usuarioId,
  dataAnterior,
  dataConclusao,
  diasAdicionados,
  motivo,
}) => {
  const id = crypto.randomUUID();
  const sql = `
    INSERT INTO historico_datas_obra (id, obra_id, usuario_id, data_anterior, data_conclusao, dias_adicionados, motivo)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *;
  `;
  const values = [
    id,
    obraId,
    usuarioId,
    dataAnterior,
    dataConclusao,
    diasAdicionados,
    motivo || null,
  ];
  try {
    const { rows } = await query(sql, values);
    return rows[0];
  } catch (error) {
    if (error.code === "42P01") {
      await garantirEstruturaBancoObras();
      const { rows } = await query(sql, values);
      return rows[0];
    }
    throw error;
  }
};

const listarHistoricoConclusao = async (obraId) => {
  const sql = `
    SELECT 
      id,
      obra_id,
      usuario_id,
      TO_CHAR(data_anterior, 'DD/MM/YYYY') as data_anterior,
      TO_CHAR(data_conclusao, 'DD/MM/YYYY') as data_conclusao,
      dias_adicionados,
      CONCAT(dias_adicionados, ' dias') as tempo_adicionado,
      motivo,
      created_at
    FROM historico_datas_obra
    WHERE obra_id = $1
    ORDER BY created_at DESC;
  `;
  try {
    const { rows } = await query(sql, [obraId]);
    return rows;
  } catch (err) {
    if (err.code === "42P01") {
      return [];
    }
    throw err;
  }
};

module.exports = {
  criar,
  buscarPorId,
  listarPorUsuario,
  atualizar,
  deletar,
  mudarStatus,
  registrarHistoricoConclusao,
  listarHistoricoConclusao,
};
