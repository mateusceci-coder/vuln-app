-- Schema do Aurora Chamados (item 2 da especificação).
-- Nomes de tabelas/colunas em português, seguindo o modelo de dados.

DO $$ BEGIN
  CREATE TYPE papel_usuario AS ENUM ('cliente', 'agente', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_chamado AS ENUM ('aberto', 'em_andamento', 'resolvido', 'fechado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE prioridade_chamado AS ENUM ('baixa', 'media', 'alta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS usuarios (
  id         SERIAL PRIMARY KEY,
  nome       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  papel      papel_usuario NOT NULL DEFAULT 'cliente',
  telefone   TEXT,
  cpf        TEXT,
  empresa    TEXT,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chamados (
  id            SERIAL PRIMARY KEY,
  titulo        TEXT NOT NULL,
  descricao     TEXT,
  status        status_chamado NOT NULL DEFAULT 'aberto',
  prioridade    prioridade_chamado NOT NULL DEFAULT 'media',
  solicitante_id INTEGER NOT NULL REFERENCES usuarios(id),
  agente_id      INTEGER REFERENCES usuarios(id),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comentarios (
  id         SERIAL PRIMARY KEY,
  chamado_id INTEGER NOT NULL REFERENCES chamados(id),
  autor_id   INTEGER NOT NULL REFERENCES usuarios(id),
  corpo      TEXT NOT NULL,
  interno    BOOLEAN NOT NULL DEFAULT false,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS anexos (
  id           SERIAL PRIMARY KEY,
  chamado_id   INTEGER NOT NULL REFERENCES chamados(id),
  nome_arquivo TEXT NOT NULL,
  caminho      TEXT NOT NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);
