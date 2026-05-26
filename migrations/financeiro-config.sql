-- Tabela para persistir configurações do módulo Financeiro por tenant
-- (grupos de repasse, tabelas de comissão, corretores, contratos)
CREATE TABLE IF NOT EXISTS financeiro_config (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  dados JSONB,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT financeiro_config_tenant_unique UNIQUE (tenant_id)
);
