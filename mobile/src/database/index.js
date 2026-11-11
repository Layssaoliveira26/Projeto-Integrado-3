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
    url_nuvem TEXT,
    latitude REAL,
    longitude REAL,
    possui_localizacao INTEGER,
    data_hora_captura TEXT,
    sincronizado INTEGER DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
`;

export const SCHEMA_OFFLINE_FIRST_SQL = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS usuarios (
    id TEXT PRIMARY KEY NOT NULL,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS obras (
    id TEXT PRIMARY KEY NOT NULL,
    usuario_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    endereco TEXT,
    data_inicio TEXT,
    data_conclusao TEXT,
    descricao TEXT,
    orcamento_total REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ativa',
    data_arquivamento TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    version INTEGER NOT NULL DEFAULT 1
  );
  CREATE INDEX IF NOT EXISTS idx_obras_usuario ON obras(usuario_id);

  CREATE TABLE IF NOT EXISTS planilhas_base (
    id TEXT PRIMARY KEY NOT NULL,
    obra_id TEXT NOT NULL,
    nome_arquivo TEXT NOT NULL,
    caminho_local TEXT,
    status_validacao TEXT NOT NULL DEFAULT 'valida',
    mensagens_validacao TEXT,
    data_importacao TEXT DEFAULT CURRENT_TIMESTAMP,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_planilhas_obra ON planilhas_base(obra_id);

  CREATE TABLE IF NOT EXISTS etapas (
    id TEXT PRIMARY KEY NOT NULL,
    obra_id TEXT NOT NULL,
    etapa_pai_id TEXT,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_etapas_obra ON etapas(obra_id);

  CREATE TABLE IF NOT EXISTS servicos (
    id TEXT PRIMARY KEY NOT NULL,
    obra_id TEXT NOT NULL,
    etapa_id TEXT,
    codigo_servico TEXT NOT NULL,
    descricao TEXT NOT NULL,
    fonte_origem TEXT,
    unidade_medida TEXT NOT NULL,
    quantidade_orcada REAL NOT NULL DEFAULT 0,
    preco_unitario REAL NOT NULL DEFAULT 0,
    preco_total REAL NOT NULL DEFAULT 0,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (obra_id, codigo_servico)
  );
  CREATE INDEX IF NOT EXISTS idx_servicos_obra ON servicos(obra_id);
  CREATE INDEX IF NOT EXISTS idx_servicos_etapa ON servicos(etapa_id);

  CREATE TABLE IF NOT EXISTS ciclos_medicao (
    id TEXT PRIMARY KEY NOT NULL,
    obra_id TEXT NOT NULL,
    numero_ciclo INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'aberto',
    data_inicio TEXT DEFAULT CURRENT_TIMESTAMP,
    data_encerramento TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (obra_id, numero_ciclo)
  );
  CREATE INDEX IF NOT EXISTS idx_ciclos_obra ON ciclos_medicao(obra_id);

  CREATE TABLE IF NOT EXISTS medicoes (
    id TEXT PRIMARY KEY NOT NULL,
    ciclo_id TEXT NOT NULL,
    servico_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    quantidade_medida_periodo REAL NOT NULL DEFAULT 0,
    quantidade_acumulada_anterior REAL NOT NULL DEFAULT 0,
    quantidade_acumulada_atual REAL NOT NULL DEFAULT 0,
    saldo_quantidade REAL NOT NULL DEFAULT 0,
    valor_medido_periodo REAL NOT NULL DEFAULT 0,
    valor_acumulado_anterior REAL NOT NULL DEFAULT 0,
    valor_acumulado_atual REAL NOT NULL DEFAULT 0,
    percentual_execucao REAL NOT NULL DEFAULT 0,
    sync_status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (ciclo_id, servico_id)
  );
  CREATE INDEX IF NOT EXISTS idx_medicoes_ciclo ON medicoes(ciclo_id);
  CREATE INDEX IF NOT EXISTS idx_medicoes_servico ON medicoes(servico_id);

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
  await database.execAsync(SCHEMA_OFFLINE_FIRST_SQL);

  // Garante migrações incrementais para bancos preexistentes no dispositivo
  const colMigrations = [
    "ALTER TABLE fotografias ADD COLUMN url_nuvem TEXT;",
    "ALTER TABLE fotografias ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';",
    "ALTER TABLE fotografias ADD COLUMN updated_at TEXT DEFAULT CURRENT_TIMESTAMP;",
    "ALTER TABLE obras ADD COLUMN data_inicio TEXT;",
    "ALTER TABLE obras ADD COLUMN data_conclusao TEXT;",
    "ALTER TABLE obras ADD COLUMN descricao TEXT;",
    "ALTER TABLE obras ADD COLUMN orcamento_total REAL NOT NULL DEFAULT 0;",
    "ALTER TABLE medicoes ADD COLUMN sync_status TEXT NOT NULL DEFAULT 'pending';",
    "ALTER TABLE fila_sincronizacao ADD COLUMN ultimo_erro TEXT;",
  ];

  for (const sql of colMigrations) {
    try {
      await database.execAsync(sql);
    } catch {
      // Coluna já existe, ignora silenciosamente
    }
  }
};
