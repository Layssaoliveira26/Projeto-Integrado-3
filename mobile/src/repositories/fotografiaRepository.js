// mobile/src/repositories/fotografiaRepository.js
import { getDbConnection } from "../database/index";
import { enfileirarOperacao } from "./syncQueueRepository";

export const salvarFotografia = async (dados, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  await db.runAsync(
    `INSERT INTO fotografias (
      id,
      obra_id,
      ciclo_id,
      servico_id,
      usuario_id,
      caminho_local,
      caminho_comprimido,
      latitude,
      longitude,
      possui_localizacao,
      data_hora_captura,
      sincronizado,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'pending');`,
    [
      dados.id,
      dados.obra_id,
      dados.ciclo_id,
      dados.servico_id,
      dados.usuario_id,
      dados.caminho_local,
      dados.caminho_comprimido,
      dados.latitude,
      dados.longitude,
      dados.possui_localizacao,
      dados.data_hora_captura,
    ]
  );

  await enfileirarOperacao(
    {
      tabelaReferencia: "fotografias",
      registroId: String(dados.id),
      operacao: "insert",
      payload: {
        id: String(dados.id),
        obra_id: dados.obra_id,
        ciclo_id: dados.ciclo_id,
        servico_id: dados.servico_id,
        usuario_id: dados.usuario_id,
        caminho_local: dados.caminho_local,
        caminho_comprimido: dados.caminho_comprimido,
        latitude: dados.latitude,
        longitude: dados.longitude,
        possui_localizacao: dados.possui_localizacao,
        data_hora_captura: dados.data_hora_captura,
      },
    },
    db
  );
};

export const upsertFotografiaSincronizada = async (foto, dbOverride = null) => {
  if (!foto || !foto.id) return;
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO fotografias (
      id, obra_id, ciclo_id, servico_id, usuario_id,
      caminho_local, caminho_comprimido, url_nuvem,
      latitude, longitude, possui_localizacao, data_hora_captura,
      sincronizado, sync_status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'synced', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      url_nuvem = COALESCE(excluded.url_nuvem, fotografias.url_nuvem),
      sincronizado = 1,
      sync_status = 'synced',
      updated_at = excluded.updated_at;`,
    [
      String(foto.id),
      foto.obra_id || null,
      foto.ciclo_id || null,
      foto.servico_id || null,
      foto.usuario_id || null,
      foto.caminho_local || foto.caminho_arquivo || "",
      foto.caminho_comprimido || foto.caminho_arquivo || "",
      foto.url_nuvem || foto.caminho_arquivo || null,
      foto.latitude ?? null,
      foto.longitude ?? null,
      foto.possui_localizacao ? 1 : 0,
      foto.data_hora_captura || foto.created_at || agora,
      foto.created_at || agora,
      agora,
    ]
  );
};

export const marcarFotografiaComoSincronizada = async (
  id,
  urlNuvem = null,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE fotografias
     SET sincronizado = 1, sync_status = 'synced', url_nuvem = COALESCE(?, url_nuvem), updated_at = ?
     WHERE id = ?;`,
    [urlNuvem, agora, String(id)]
  );
};

export const listarFotografiasBD = async () => {
  const db = await getDbConnection();
  const rows = await db.getAllAsync(
    `SELECT * FROM fotografias ORDER BY created_at DESC;`
  );
  return rows;
};

export const listarFotografiasPorServico = async (servicoId) => {
  const db = await getDbConnection();
  const rows = await db.getAllAsync(
    `SELECT * FROM fotografias WHERE servico_id = ? ORDER BY created_at DESC;`,
    [servicoId]
  );
  return rows;
};

export const contarFotografiasPorServico = async (servicoId) => {
  const db = await getDbConnection();
  const result = await db.getFirstAsync(
    `SELECT COUNT(*) AS total FROM fotografias WHERE servico_id = ?;`,
    [servicoId]
  );
  return result?.total || 0;
};

export const listarFotografiasPorObra = async (obraId, cicloId) => {
  const db = await getDbConnection();
  if (obraId && cicloId) {
    return await db.getAllAsync(
      `SELECT * FROM fotografias WHERE (obra_id = ? OR obra_id = ?) AND (ciclo_id = ? OR ciclo_id = ?) ORDER BY data_hora_captura DESC;`,
      [obraId, String(obraId), cicloId, String(cicloId)]
    );
  }
  if (obraId) {
    return await db.getAllAsync(
      `SELECT * FROM fotografias WHERE obra_id = ? OR obra_id = ? ORDER BY data_hora_captura DESC;`,
      [obraId, String(obraId)]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM fotografias ORDER BY data_hora_captura DESC;`
  );
};

export const excluirFotografia = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  await db.runAsync(`DELETE FROM fotografias WHERE id = ?;`, [id]);

  await enfileirarOperacao(
    {
      tabelaReferencia: "fotografias",
      registroId: String(id),
      operacao: "delete",
      payload: { id: String(id) },
    },
    db
  );
};
