-- Migration: Add Promissory Note (Nota Promissória) module tables
-- Date: 2026-03-14

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  razao_social VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) NOT NULL,
  cidade VARCHAR(255) NOT NULL,
  uf VARCHAR(2) NOT NULL,
  endereco TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_cnpj_tenant ON companies(tenant_id, cnpj);

CREATE TABLE IF NOT EXISTS promissory_notes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  np_number VARCHAR(20) NOT NULL,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  company_razao_social VARCHAR(255) NOT NULL,
  company_cnpj VARCHAR(18) NOT NULL,
  company_cidade VARCHAR(255) NOT NULL,
  company_uf VARCHAR(2) NOT NULL,
  devedor_nome VARCHAR(255) NOT NULL,
  devedor_cpf VARCHAR(14) NOT NULL,
  devedor_endereco TEXT NOT NULL,
  valor DECIMAL(12, 2) NOT NULL,
  data_vencimento VARCHAR(10) NOT NULL,
  local_pagamento VARCHAR(255),
  multa_percentual DECIMAL(5, 2) DEFAULT 2,
  juros_percentual DECIMAL(5, 2) DEFAULT 1,
  banco_origem VARCHAR(255),
  data_pagamento VARCHAR(10),
  descricao TEXT,
  prazo_protesto INTEGER DEFAULT 5,
  local_emissao VARCHAR(255) NOT NULL,
  data_emissao VARCHAR(10) NOT NULL,
  emitido_por_id INTEGER REFERENCES users(id),
  emitido_por_nome VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_np_number_tenant ON promissory_notes(tenant_id, np_number);
