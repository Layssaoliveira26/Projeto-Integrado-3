-- =====================================================================
-- Schema SQLite - Sistema de Registro e Acompanhamento de Medições
-- Convenções:
--   * IDs em UUID (TEXT) - gerados no cliente, evita conflito no sync
--   * created_at / updated_at em todas as tabelas (rastreabilidade)
--   * deleted_at para soft delete
--   * sync_status controla o estado de sincronização com a nuvem
-- =====================================================================

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------
-- USUARIOS
-- ---------------------------------------------------------------------
CREATE TABLE usuarios (
  id            TEXT PRIMARY KEY,
  nome          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  senha_hash    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- OBRAS
-- ---------------------------------------------------------------------
CREATE TABLE obras (
  id                 TEXT PRIMARY KEY,
  usuario_id         TEXT NOT NULL REFERENCES usuarios(id),
  nome               TEXT NOT NULL,
  endereco           TEXT,
  status             TEXT NOT NULL DEFAULT 'ativa'
                       CHECK (status IN ('ativa','arquivada')),
  data_arquivamento  TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at         TEXT,
  sync_status        TEXT NOT NULL DEFAULT 'pending'
                       CHECK (sync_status IN ('pending','synced','conflict')),
  version            INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_obras_usuario ON obras(usuario_id);

-- ---------------------------------------------------------------------
-- PLANILHAS_BASE
-- ---------------------------------------------------------------------
CREATE TABLE planilhas_base (
  id                    TEXT PRIMARY KEY,
  obra_id               TEXT NOT NULL REFERENCES obras(id),
  nome_arquivo          TEXT NOT NULL,
  caminho_local         TEXT,
  status_validacao      TEXT NOT NULL DEFAULT 'pendente'
                          CHECK (status_validacao IN ('pendente','valida','invalida')),
  mensagens_validacao   TEXT,             -- JSON com erros encontrados, se houver
  data_importacao       TEXT NOT NULL DEFAULT (datetime('now')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_planilhas_obra ON planilhas_base(obra_id);

-- ---------------------------------------------------------------------
-- ETAPAS (hierarquia Obra -> Etapas -> Serviços)
-- ---------------------------------------------------------------------
CREATE TABLE etapas (
  id            TEXT PRIMARY KEY,
  obra_id       TEXT NOT NULL REFERENCES obras(id),
  etapa_pai_id  TEXT REFERENCES etapas(id),   -- permite sub-etapas, se necessário
  nome          TEXT NOT NULL,
  ordem         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_etapas_obra ON etapas(obra_id);

-- ---------------------------------------------------------------------
-- SERVICOS (dados orçamentários vindos da planilha-base)
-- ---------------------------------------------------------------------
CREATE TABLE servicos (
  id                 TEXT PRIMARY KEY,
  obra_id            TEXT NOT NULL REFERENCES obras(id),
  etapa_id           TEXT REFERENCES etapas(id),
  codigo_servico     TEXT NOT NULL,       -- identificador único vindo da planilha
  descricao          TEXT NOT NULL,
  fonte_origem       TEXT,
  unidade_medida     TEXT NOT NULL,       -- un, m², kg... usado no RF do campo dinâmico
  quantidade_orcada  REAL NOT NULL DEFAULT 0,
  preco_unitario     REAL NOT NULL DEFAULT 0,
  preco_total        REAL NOT NULL DEFAULT 0,
  ordem              INTEGER NOT NULL DEFAULT 0,   -- ordem original na planilha
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (obra_id, codigo_servico)
);
CREATE INDEX idx_servicos_obra ON servicos(obra_id);
CREATE INDEX idx_servicos_etapa ON servicos(etapa_id);

-- ---------------------------------------------------------------------
-- CICLOS_MEDICAO
-- ---------------------------------------------------------------------
CREATE TABLE ciclos_medicao (
  id                 TEXT PRIMARY KEY,
  obra_id            TEXT NOT NULL REFERENCES obras(id),
  numero_ciclo       INTEGER NOT NULL,
  status             TEXT NOT NULL DEFAULT 'aberto'
                       CHECK (status IN ('aberto','encerrado')),
  data_inicio        TEXT NOT NULL DEFAULT (datetime('now')),
  data_encerramento  TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (obra_id, numero_ciclo)
);
CREATE INDEX idx_ciclos_obra ON ciclos_medicao(obra_id);

-- ---------------------------------------------------------------------
-- MEDICOES (um registro por serviço a cada ciclo)
-- ---------------------------------------------------------------------
CREATE TABLE medicoes (
  id                              TEXT PRIMARY KEY,
  ciclo_id                        TEXT NOT NULL REFERENCES ciclos_medicao(id),
  servico_id                      TEXT NOT NULL REFERENCES servicos(id),
  usuario_id                      TEXT NOT NULL REFERENCES usuarios(id), -- rastreabilidade
  quantidade_medida_periodo       REAL NOT NULL DEFAULT 0,
  quantidade_acumulada_anterior   REAL NOT NULL DEFAULT 0,
  quantidade_acumulada_atual      REAL NOT NULL DEFAULT 0,
  saldo_quantidade                REAL NOT NULL DEFAULT 0,
  valor_medido_periodo            REAL NOT NULL DEFAULT 0,
  valor_acumulado_anterior        REAL NOT NULL DEFAULT 0,
  valor_acumulado_atual           REAL NOT NULL DEFAULT 0,
  percentual_execucao             REAL NOT NULL DEFAULT 0,
  created_at                      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at                      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (ciclo_id, servico_id)
);
CREATE INDEX idx_medicoes_ciclo ON medicoes(ciclo_id);
CREATE INDEX idx_medicoes_servico ON medicoes(servico_id);

-- ---------------------------------------------------------------------
-- FOTOGRAFIAS
-- ---------------------------------------------------------------------
CREATE TABLE fotografias (
  id                    TEXT PRIMARY KEY,
  obra_id               TEXT NOT NULL REFERENCES obras(id),
  ciclo_id              TEXT NOT NULL REFERENCES ciclos_medicao(id),
  servico_id            TEXT REFERENCES servicos(id),
  usuario_id            TEXT NOT NULL REFERENCES usuarios(id),
  caminho_local         TEXT NOT NULL,
  caminho_comprimido    TEXT,             -- versão otimizada
  url_nuvem             TEXT,             -- preenchido após upload/backup
  latitude              REAL,
  longitude             REAL,
  possui_localizacao    INTEGER NOT NULL DEFAULT 0,
  data_hora_captura     TEXT NOT NULL DEFAULT (datetime('now')),
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at            TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fotos_obra_ciclo ON fotografias(obra_id, ciclo_id);
CREATE INDEX idx_fotos_servico ON fotografias(servico_id);

-- ---------------------------------------------------------------------
-- RELATORIOS_FOTOGRAFICOS (histórico de exportações)
-- ---------------------------------------------------------------------
CREATE TABLE relatorios_fotograficos (
  id               TEXT PRIMARY KEY,
  obra_id          TEXT NOT NULL REFERENCES obras(id),
  ciclo_id         TEXT NOT NULL REFERENCES ciclos_medicao(id),
  caminho_arquivo  TEXT,
  formato          TEXT NOT NULL DEFAULT 'pdf',
  data_geracao     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- FILA_SINCRONIZACAO (base do funcionamento offline-first)
-- ---------------------------------------------------------------------
CREATE TABLE fila_sincronizacao (
  id                 TEXT PRIMARY KEY,
  tabela_referencia  TEXT NOT NULL,       -- ex: 'obras', 'medicoes', 'fotografias'
  registro_id        TEXT NOT NULL,       -- id do registro afetado
  operacao           TEXT NOT NULL CHECK (operacao IN ('insert','update','delete')),
  payload            TEXT,                -- snapshot em JSON do registro
  status             TEXT NOT NULL DEFAULT 'pendente'
                       CHECK (status IN ('pendente','sincronizado','erro')),
  tentativas         INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_fila_status ON fila_sincronizacao(status);

-- ---------------------------------------------------------------------
-- CONTROLE DE MIGRATIONS
-- ---------------------------------------------------------------------
CREATE TABLE schema_migrations (
  version      TEXT PRIMARY KEY,
  applied_at   TEXT NOT NULL DEFAULT (datetime('now'))
);