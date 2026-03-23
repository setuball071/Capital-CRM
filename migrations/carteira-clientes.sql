-- Carteira de Clientes — Client Portfolio Lock System
-- All statements use IF NOT EXISTS — safe to run multiple times

-- 1. Tabela de Regras de Prazo por Produto
CREATE TABLE IF NOT EXISTS portfolio_rules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  product_type VARCHAR(50) NOT NULL, -- CARTAO, CONSIGNADO, NOVO, PORTABILIDADE, REFINANCIAMENTO
  duration_months INTEGER NOT NULL DEFAULT 6,
  updated_by INTEGER REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, product_type)
);

-- 2. Tabela principal de carteira de clientes
CREATE TABLE IF NOT EXISTS client_portfolio (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cpf VARCHAR(14) NOT NULL,
  client_name VARCHAR(255),
  vendor_id INTEGER NOT NULL REFERENCES users(id),
  product_type VARCHAR(50) NOT NULL,
  origin VARCHAR(20) NOT NULL, -- IMPORTACAO ou CONTRATO
  origin_id INTEGER,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'ATIVO', -- ATIVO ou EXPIRADO
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. Tabela de transferências de carteira
CREATE TABLE IF NOT EXISTS portfolio_transfers (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  portfolio_id INTEGER NOT NULL REFERENCES client_portfolio(id),
  from_vendor_id INTEGER NOT NULL REFERENCES users(id),
  to_vendor_id INTEGER NOT NULL REFERENCES users(id),
  transferred_by INTEGER NOT NULL REFERENCES users(id),
  reason TEXT,
  transferred_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_portfolio_cpf ON client_portfolio(tenant_id, cpf);
CREATE INDEX IF NOT EXISTS idx_portfolio_vendor ON client_portfolio(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_status ON client_portfolio(tenant_id, status);

-- Regras padrão para tenant_id = 1
INSERT INTO portfolio_rules (tenant_id, product_type, duration_months)
VALUES
  (1, 'CARTAO', 3),
  (1, 'CONSIGNADO', 6),
  (1, 'NOVO', 6),
  (1, 'PORTABILIDADE', 6),
  (1, 'REFINANCIAMENTO', 6)
ON CONFLICT (tenant_id, product_type) DO NOTHING;
