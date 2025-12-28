-- Migration: Add import_run_id and base_tag to all final tables for cascading delete support
-- This allows proper cleanup when an import run is deleted

-- 1. Add columns to clientes_vinculo (if not exist)
ALTER TABLE clientes_vinculo ADD COLUMN IF NOT EXISTS import_run_id INTEGER;
ALTER TABLE clientes_vinculo ADD COLUMN IF NOT EXISTS base_tag VARCHAR(100);

-- 2. Add column to clientes_folha_mes (if not exist)  
ALTER TABLE clientes_folha_mes ADD COLUMN IF NOT EXISTS import_run_id INTEGER;

-- 3. Add column to clientes_contratos (if not exist)
ALTER TABLE clientes_contratos ADD COLUMN IF NOT EXISTS import_run_id INTEGER;

-- 4. Add columns to client_contacts (if not exist)
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS import_run_id INTEGER;
ALTER TABLE client_contacts ADD COLUMN IF NOT EXISTS base_tag VARCHAR(100);

-- Create indexes for efficient delete queries
CREATE INDEX IF NOT EXISTS idx_folha_mes_import_run ON clientes_folha_mes(import_run_id);
CREATE INDEX IF NOT EXISTS idx_contratos_import_run ON clientes_contratos(import_run_id);
CREATE INDEX IF NOT EXISTS idx_vinculo_import_run ON clientes_vinculo(import_run_id);
CREATE INDEX IF NOT EXISTS idx_contacts_import_run ON client_contacts(import_run_id);

-- Create indexes for base_tag queries
CREATE INDEX IF NOT EXISTS idx_vinculo_base_tag ON clientes_vinculo(base_tag);
CREATE INDEX IF NOT EXISTS idx_contacts_base_tag ON client_contacts(base_tag);
