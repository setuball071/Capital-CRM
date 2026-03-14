-- Migration: Add Contracts Module (Módulo de Contratos) — Phase 1
-- Date: 2026-03-14
-- All statements use CREATE TABLE IF NOT EXISTS — safe and idempotent

-- 1. commission_groups
CREATE TABLE IF NOT EXISTS commission_groups (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  percentage DECIMAL(5,4) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_groups_tenant ON commission_groups(tenant_id);

-- 2. contract_flows
CREATE TABLE IF NOT EXISTS contract_flows (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  bank VARCHAR(255) NOT NULL,
  convenio VARCHAR(255) NOT NULL,
  product VARCHAR(50) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_flows_tenant ON contract_flows(tenant_id);

-- 3. contract_flow_steps
CREATE TABLE IF NOT EXISTS contract_flow_steps (
  id SERIAL PRIMARY KEY,
  flow_id INTEGER NOT NULL REFERENCES contract_flows(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  required_role VARCHAR(50),
  requires_documents BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contract_flow_steps_flow ON contract_flow_steps(flow_id);

-- 4. proposals
CREATE TABLE IF NOT EXISTS proposals (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- Dados do cliente
  client_name VARCHAR(255) NOT NULL,
  client_cpf VARCHAR(14) NOT NULL,
  client_matricula VARCHAR(100),
  client_convenio VARCHAR(255),
  -- Dados da operação
  bank VARCHAR(255),
  product VARCHAR(50),
  table_id INTEGER REFERENCES coefficient_tables(id),
  contract_value DECIMAL(12,2),
  installment_value DECIMAL(12,2),
  term INTEGER,
  -- Controle de fluxo
  flow_id INTEGER REFERENCES contract_flows(id),
  current_step_id INTEGER REFERENCES contract_flow_steps(id),
  status VARCHAR(50) NOT NULL DEFAULT 'CADASTRADA',
  is_paused BOOLEAN NOT NULL DEFAULT FALSE,
  paused_at_step_id INTEGER REFERENCES contract_flow_steps(id),
  -- Dados bancários
  ade VARCHAR(100),
  -- Comissão
  commission_percentage DECIMAL(5,4),
  corretor_commission_percentage DECIMAL(5,4),
  corretor_commission_value DECIMAL(12,2),
  company_commission_value DECIMAL(12,2),
  commission_status VARCHAR(20) DEFAULT 'PENDENTE',
  commission_paid_at TIMESTAMP,
  -- Controle geral
  vendor_id INTEGER REFERENCES users(id),
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant_status ON proposals(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_proposals_tenant_vendor ON proposals(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_proposals_tenant_created ON proposals(tenant_id, created_at);

-- 5. proposal_history
CREATE TABLE IF NOT EXISTS proposal_history (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  from_status VARCHAR(50),
  to_status VARCHAR(50),
  from_step_id INTEGER REFERENCES contract_flow_steps(id),
  to_step_id INTEGER REFERENCES contract_flow_steps(id),
  action VARCHAR(50) NOT NULL,
  notes TEXT,
  performed_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_history_proposal ON proposal_history(proposal_id);

-- 6. proposal_messages
CREATE TABLE IF NOT EXISTS proposal_messages (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  message TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_messages_proposal ON proposal_messages(proposal_id);

-- 7. proposal_documents
CREATE TABLE IF NOT EXISTS proposal_documents (
  id SERIAL PRIMARY KEY,
  proposal_id INTEGER NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL,
  file_url TEXT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  message_id INTEGER REFERENCES proposal_messages(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposal_documents_proposal ON proposal_documents(proposal_id);

-- 8. financial_debits
CREATE TABLE IF NOT EXISTS financial_debits (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  vendor_id INTEGER NOT NULL REFERENCES users(id),
  proposal_id INTEGER REFERENCES proposals(id),
  type VARCHAR(50) NOT NULL,
  value DECIMAL(12,2) NOT NULL,
  description TEXT,
  reference_date DATE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_debits_tenant_vendor ON financial_debits(tenant_id, vendor_id);
CREATE INDEX IF NOT EXISTS idx_financial_debits_proposal ON financial_debits(proposal_id);
