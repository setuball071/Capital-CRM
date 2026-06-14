-- Migração: tabela api_keys
-- Rodar no Database tab do Replit (ou via psql $DATABASE_URL)

CREATE TABLE IF NOT EXISTS api_keys (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nome VARCHAR(255) NOT NULL,
  chave_hash VARCHAR(64) NOT NULL UNIQUE,
  prefixo VARCHAR(12),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_uso TIMESTAMP,
  total_requisicoes INTEGER NOT NULL DEFAULT 0,
  criado_por INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_id ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_chave_hash ON api_keys(chave_hash);
