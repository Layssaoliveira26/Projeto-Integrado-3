// mobile/src/database/index.js
import * as SQLite from "expo-sqlite";

let db = null;

export const SCHEMA_FOTOGRAFIAS_SQL = `
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
`;

export const SCHEMA_USUARIOS_SQL = `
  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT DEFAULT '',
    foto_url TEXT,
    foto_local TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS fila_sincronizacao (
    id TEXT PRIMARY KEY NOT NULL,
    tabela_referencia TEXT NOT NULL,
    registro_id TEXT NOT NULL,
    operacao TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'pendente',
    tentativas INTEGER NOT NULL DEFAULT 0,
    ultimo_erro TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_fila_status ON fila_sincronizacao(status);
`;

export const getDbConnection = async () => {
  if (!db) {
    db = await SQLite.openDatabaseAsync("pies3_local.db");
  }
  return db;
};

export const initDb = async () => {
  const database = await getDbConnection();
  await database.execAsync(SCHEMA_FOTOGRAFIAS_SQL);
  await database.execAsync(SCHEMA_USUARIOS_SQL);

  const colMigrations = [
    "ALTER TABLE usuarios ADD COLUMN foto_url TEXT;",
    "ALTER TABLE usuarios ADD COLUMN foto_local TEXT;",
  ];

  for (const sql of colMigrations) {
    try {
      await database.execAsync(sql);
    } catch {}
  }
};