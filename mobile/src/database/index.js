// mobile/src/database/index.js
import * as SQLite from "expo-sqlite";

let db = null;

export const getDbConnection = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync("pies3_local.db");
  }
  return db;
};

export const initDb = async () => {
  const database = await getDbConnection();
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS fotografias (
      id TEXT PRIMARY KEY NOT NULL,
      obra_id TEXT,
      ciclo_id TEXT,
      servico_id TEXT,
      usuario_id TEXT,
      caminho_local TEXT,
      caminho_comprimido TEXT,
      latitude REAL,
      longitude REAL,
      possui_localizacao INTEGER,
      data_hora_captura TEXT,
      sincronizado INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
};