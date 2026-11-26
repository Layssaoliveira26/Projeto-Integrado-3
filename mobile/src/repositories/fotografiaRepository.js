// mobile/src/repositories/fotografiaRepository.js
import { getDbConnection } from "../database/index";
import { enfileirarOperacao } from "./syncQueueRepository";

const normalizarUsuarioIdFoto = (usuarioId) => {
  if (usuarioId === null || usuarioId === undefined) return null;
  const limpo = String(usuarioId).trim();
  if (!limpo || limpo === "local_user") return null;
  return limpo;
};

export const salvarFotografia = async (dados, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  let usuarioEfetivo = normalizarUsuarioIdFoto(dados.usuario_id);
  if (!usuarioEfetivo && dados.obra_id) {
    const obra = await db
      .getFirstAsync(`SELECT usuario_id FROM obras WHERE id = ?;`, [
        String(dados.obra_id),
      ])
      .catch(() => null);
    usuarioEfetivo = normalizarUsuarioIdFoto(obra?.usuario_id);
  }

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
      usuarioEfetivo,
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
      acao: "registrar_foto",
      usuarioId: usuarioEfetivo,
      payload: {
        id: String(dados.id),
        obra_id: dados.obra_id,
        ciclo_id: dados.ciclo_id,
        servico_id: dados.servico_id,
        usuario_id: usuarioEfetivo,
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
  if (cicloId) {
    return await db.getAllAsync(
      `SELECT * FROM fotografias WHERE ciclo_id = ? OR ciclo_id = ? ORDER BY data_hora_captura DESC;`,
      [cicloId, String(cicloId)]
    );
  }
  return await db.getAllAsync(
    `SELECT * FROM fotografias ORDER BY data_hora_captura DESC;`
  );
};

/**
 * Lista todas as fotografias de uma obra até um determinado ciclo (ciclo atual e ciclos anteriores).
 * Garante que o relatório fotográfico exiba todos os registros acumulados da obra.
 */
export const listarFotografiasAteCiclo = async (obraId, cicloId = null, numeroCicloMax = null) => {
  const db = await getDbConnection();
  if (!obraId) {
    return await db.getAllAsync(
      `SELECT f.*, c.numero_ciclo AS numero_ciclo_foto
       FROM fotografias f
       LEFT JOIN ciclos_medicao c ON f.ciclo_id = c.id
       ORDER BY data_hora_captura DESC;`
    );
  }

  let maxNumero =
    numeroCicloMax !== null && numeroCicloMax !== undefined
      ? Number(numeroCicloMax)
      : null;

  if ((maxNumero === null || isNaN(maxNumero)) && cicloId) {
    const cicloAlvo = await db
      .getFirstAsync(
        `SELECT numero_ciclo FROM ciclos_medicao WHERE id = ? OR id = ?;`,
        [String(cicloId), cicloId]
      )
      .catch(() => null);
    if (cicloAlvo?.numero_ciclo !== undefined && cicloAlvo?.numero_ciclo !== null) {
      maxNumero = Number(cicloAlvo.numero_ciclo);
    }
  }

  if (maxNumero === null || isNaN(maxNumero)) {
    return await db.getAllAsync(
      `SELECT f.*, c.numero_ciclo AS numero_ciclo_foto
       FROM fotografias f
       LEFT JOIN ciclos_medicao c ON f.ciclo_id = c.id
       WHERE f.obra_id = ? OR f.obra_id = ?
       ORDER BY COALESCE(c.numero_ciclo, 9999) ASC, f.data_hora_captura ASC;`,
      [String(obraId), obraId]
    );
  }

  return await db.getAllAsync(
    `SELECT f.*, c.numero_ciclo AS numero_ciclo_foto
     FROM fotografias f
     LEFT JOIN ciclos_medicao c ON f.ciclo_id = c.id
     WHERE (f.obra_id = ? OR f.obra_id = ?)
       AND (c.numero_ciclo IS NULL OR c.numero_ciclo <= ?)
     ORDER BY COALESCE(c.numero_ciclo, 9999) ASC, f.data_hora_captura ASC;`,
    [String(obraId), obraId, maxNumero]
  );
};

export const excluirFotografia = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const foto = await db
    .getFirstAsync(
      `SELECT f.usuario_id, f.obra_id, o.usuario_id AS obra_usuario_id
       FROM fotografias f
       LEFT JOIN obras o ON f.obra_id = o.id
       WHERE f.id = ?;`,
      [String(id)]
    )
    .catch(() => null);
  const usuarioEfetivo =
    normalizarUsuarioIdFoto(foto?.usuario_id) ||
    normalizarUsuarioIdFoto(foto?.obra_usuario_id);

  await db.runAsync(`DELETE FROM fotografias WHERE id = ?;`, [String(id)]);

  await enfileirarOperacao(
    {
      tabelaReferencia: "fotografias",
      registroId: String(id),
      operacao: "delete",
      acao: "deletar_foto",
      usuarioId: usuarioEfetivo,
      payload: { id: String(id), usuario_id: usuarioEfetivo },
    },
    db
  );
};

export const listarFotografiasPendentesUploadBinario = async (
  usuarioId = null,
  dbOverride = null
) => {
  const usuarioNormalizado = normalizarUsuarioIdFoto(usuarioId);
  if (!usuarioNormalizado) {
    return [];
  }
  const db = dbOverride || (await getDbConnection());
  const sql = `SELECT * FROM fotografias
     WHERE (url_nuvem IS NULL OR url_nuvem = '')
       AND (caminho_comprimido IS NOT NULL OR caminho_local IS NOT NULL)
       AND COALESCE(sync_status, 'pending') != 'error'
       AND usuario_id = ?
     ORDER BY data_hora_captura ASC;`;
  return (await db.getAllAsync(sql, [usuarioNormalizado])) || [];
};

export const marcarErroUploadFotografia = async (id, dbOverride = null) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE fotografias
     SET sync_status = 'error',
         updated_at = ?
     WHERE id = ?;`,
    [agora, String(id)]
  );
};

export const listarFotografiasComUrlNuvem = async (
  usuarioId = null,
  dbOverride = null
) => {
  const usuarioNormalizado = normalizarUsuarioIdFoto(usuarioId);
  if (!usuarioNormalizado) {
    return [];
  }
  const db = dbOverride || (await getDbConnection());
  const sql = `SELECT * FROM fotografias
     WHERE url_nuvem IS NOT NULL AND url_nuvem != ''
       AND usuario_id = ?
     ORDER BY data_hora_captura DESC;`;
  return (await db.getAllAsync(sql, [usuarioNormalizado])) || [];
};

export const atualizarCaminhoLocalFotografia = async (
  id,
  caminhoLocal,
  dbOverride = null
) => {
  const db = dbOverride || (await getDbConnection());
  const agora = new Date().toISOString();
  await db.runAsync(
    `UPDATE fotografias
     SET caminho_local = ?,
         caminho_comprimido = ?,
         sincronizado = 1,
         sync_status = 'synced',
         updated_at = ?
     WHERE id = ?;`,
    [String(caminhoLocal), String(caminhoLocal), agora, String(id)]
  );
};
