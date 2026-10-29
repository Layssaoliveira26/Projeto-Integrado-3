// mobile/src/repositories/fotografiaRepository.js
import { getDbConnection } from "../database/index";

export const salvarFotografia = async (dados) => {
  const db = await getDbConnection();
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
      data_hora_captura
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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

export const excluirFotografia = async (id) => {
  const db = await getDbConnection();
  await db.runAsync(`DELETE FROM fotografias WHERE id = ?;`, [id]);
};