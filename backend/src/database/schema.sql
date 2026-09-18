-- Definição do schema da tabela de usuários no PostgreSQL para autenticação e rastreabilidade
CREATE TABLE IF NOT EXISTS usuarios (
  id UUID PRIMARY KEY,
  nome VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  senha_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS obras (
  id UUID PRIMARY KEY,
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  nome VARCHAR(255) NOT NULL,
  endereco TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','arquivada')),
  data_arquivamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE,
  sync_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending','synced','conflict')),
  version INT NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS etapas (
  id UUID PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES obras(id),
  etapa_pai_id UUID REFERENCES etapas(id),
  nome VARCHAR(255) NOT NULL,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servicos (
  id UUID PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES obras(id),
  etapa_id UUID REFERENCES etapas(id),
  codigo_servico VARCHAR(100) NOT NULL,
  descricao TEXT NOT NULL,
  fonte_origem VARCHAR(100),
  unidade_medida VARCHAR(50) NOT NULL,
  quantidade_orcada NUMERIC(15,4) NOT NULL DEFAULT 0,
  preco_unitario NUMERIC(15,4) NOT NULL DEFAULT 0,
  preco_total NUMERIC(15,4) NOT NULL DEFAULT 0,
  ordem INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (obra_id, codigo_servico)
);

CREATE TABLE IF NOT EXISTS ciclos_medicao (
  id UUID PRIMARY KEY,
  obra_id UUID NOT NULL REFERENCES obras(id),
  numero_ciclo INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','encerrado')),
  data_inicio TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  data_encerramento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (obra_id, numero_ciclo)
);

CREATE TABLE IF NOT EXISTS medicoes (
  id UUID PRIMARY KEY,
  ciclo_id UUID NOT NULL REFERENCES ciclos_medicao(id),
  servico_id UUID NOT NULL REFERENCES servicos(id),
  usuario_id UUID NOT NULL REFERENCES usuarios(id),
  quantidade_medida_periodo NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantidade_acumulada_anterior NUMERIC(15,4) NOT NULL DEFAULT 0,
  quantidade_acumulada_atual NUMERIC(15,4) NOT NULL DEFAULT 0,
  saldo_quantidade NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_medido_periodo NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_acumulado_anterior NUMERIC(15,4) NOT NULL DEFAULT 0,
  valor_acumulado_atual NUMERIC(15,4) NOT NULL DEFAULT 0,
  percentual_execucao NUMERIC(7,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (ciclo_id, servico_id)
);