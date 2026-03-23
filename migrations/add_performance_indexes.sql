-- Performance indexes for fast import and client lookup
-- All use IF NOT EXISTS — safe to run multiple times

-- Staging table indexes: speeds up merge SQL (WHERE s.import_run_id = $id)
CREATE INDEX IF NOT EXISTS idx_staging_folha_run ON staging_folha(import_run_id);
CREATE INDEX IF NOT EXISTS idx_staging_d8_run ON staging_d8(import_run_id);
CREATE INDEX IF NOT EXISTS idx_staging_contatos_run ON staging_contatos(import_run_id);

-- Matricula index: speeds up client lookup by matricula in vendas/consulta and imports
CREATE INDEX IF NOT EXISTS idx_vinculo_matricula ON clientes_vinculo(matricula);
