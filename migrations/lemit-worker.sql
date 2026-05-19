-- Migration: Lemit Worker — cache de enriquecimento e fila de jobs
-- Aplicar manualmente no NeonDB ou via endpoint /api/admin/run-migration

-- 1) Campos de cache na tabela clientes_pessoa
ALTER TABLE clientes_pessoa
  ADD COLUMN IF NOT EXISTS lemit_data JSONB,
  ADD COLUMN IF NOT EXISTS lemit_consultado_em TIMESTAMP;

-- 2) Tabela de fila de jobs
CREATE TABLE IF NOT EXISTS lemit_jobs (
  id                SERIAL PRIMARY KEY,
  tenant_id         INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  pessoa_id         INTEGER REFERENCES clientes_pessoa(id) ON DELETE CASCADE,
  cpf               VARCHAR(20) NOT NULL,
  requested_by      INTEGER,
  status            VARCHAR(20) NOT NULL DEFAULT 'pending',
  error_msg         TEXT,
  created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
  started_at        TIMESTAMP,
  done_at           TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lemit_jobs_status ON lemit_jobs(status);
CREATE INDEX IF NOT EXISTS idx_lemit_jobs_cpf    ON lemit_jobs(cpf);
