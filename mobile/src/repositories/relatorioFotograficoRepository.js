import { getDbConnection } from "../database/index";

export const SCHEMA_RELATORIOS_FOTOGRAFICOS_SQL = `
  CREATE TABLE IF NOT EXISTS relatorios_fotograficos (
    id TEXT PRIMARY KEY NOT NULL,
    obra_id TEXT NOT NULL,
    ciclo_id TEXT NOT NULL,
    caminho_arquivo TEXT,
    formato TEXT NOT NULL DEFAULT 'pdf',
    data_geracao TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

export const inicializarTabelaRelatorios = async () => {
  const db = await getDbConnection();
  await db.execAsync(SCHEMA_RELATORIOS_FOTOGRAFICOS_SQL);
};

export const salvarRegistroRelatorio = async ({
  id,
  obra_id,
  ciclo_id,
  caminho_arquivo,
  formato = "pdf",
}) => {
  const db = await getDbConnection();
  await db.runAsync(
    `INSERT INTO relatorios_fotograficos (
      id,
      obra_id,
      ciclo_id,
      caminho_arquivo,
      formato,
      data_geracao
    ) VALUES (?, ?, ?, ?, ?, datetime('now'));`,
    [id, String(obra_id), String(ciclo_id), caminho_arquivo || "", formato]
  );
};

export const listarRelatoriosPorCiclo = async (obraId, cicloId) => {
  const db = await getDbConnection();
  return await db.getAllAsync(
    `SELECT * FROM relatorios_fotograficos 
     WHERE (obra_id = ? OR obra_id = ?) 
       AND (ciclo_id = ? OR ciclo_id = ?) 
     ORDER BY data_geracao DESC;`,
    [String(obraId), obraId, String(cicloId), cicloId]
  );
};
