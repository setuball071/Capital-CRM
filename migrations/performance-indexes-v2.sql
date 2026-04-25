-- Performance indexes v2 — todos usam IF NOT EXISTS, seguro re-executar
-- Aplicado automaticamente no startup via seed.ts

-- ─── clientes_pessoa ────────────────────────────────────────────────────────
-- tenant_id: toda query filtra por tenant, esse índice elimina full-scans
CREATE INDEX IF NOT EXISTS idx_pessoa_tenant_id
  ON clientes_pessoa(tenant_id);

-- matricula direto na pessoa (lookup de consulta rápida)
CREATE INDEX IF NOT EXISTS idx_pessoa_matricula
  ON clientes_pessoa(matricula);

-- base_tag_ultima: filtragem de base nas telas de lista
CREATE INDEX IF NOT EXISTS idx_pessoa_base_tag
  ON clientes_pessoa(base_tag_ultima);

-- ─── clientes_folha_mes ─────────────────────────────────────────────────────
-- índice composto para o DISTINCT ON que busca a folha mais recente por pessoa:
--   SELECT DISTINCT ON (pessoa_id) * FROM clientes_folha_mes ORDER BY pessoa_id, competencia DESC
-- sem esse índice → sort + seq-scan em milhões de linhas a cada busca com filtro de margem
CREATE INDEX IF NOT EXISTS idx_folha_pessoa_competencia
  ON clientes_folha_mes(pessoa_id, competencia DESC);

-- base_tag: filtro de competência de referência (base_ref + 'fo')
CREATE INDEX IF NOT EXISTS idx_folha_base_tag
  ON clientes_folha_mes(base_tag);

-- ─── clientes_contratos ─────────────────────────────────────────────────────
-- banco: filtro de banco nas campanhas — crítico para o JOIN de contratos
CREATE INDEX IF NOT EXISTS idx_contratos_banco
  ON clientes_contratos(banco);

-- tipo_contrato: filtro por tipo nas campanhas
CREATE INDEX IF NOT EXISTS idx_contratos_tipo
  ON clientes_contratos(tipo_contrato);

-- base_tag: escopo de referência d8
CREATE INDEX IF NOT EXISTS idx_contratos_base_tag
  ON clientes_contratos(base_tag);

-- status: parcelas ativas, quitadas, etc.
CREATE INDEX IF NOT EXISTS idx_contratos_status
  ON clientes_contratos(status);

-- ─── pg_trgm — ILIKE com % em qualquer posição ──────────────────────────────
-- Habilita trigramas para busca textual eficiente (convenio, orgao, nome)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- convenio: ILIKE '%valor%' sem trigrama → full-scan em toda a tabela
CREATE INDEX IF NOT EXISTS idx_pessoa_convenio_trgm
  ON clientes_pessoa USING gin(convenio gin_trgm_ops);

-- orgaodesc: mesmo problema, mesma solução
CREATE INDEX IF NOT EXISTS idx_pessoa_orgao_trgm
  ON clientes_pessoa USING gin(orgaodesc gin_trgm_ops);

-- sit_func na folha: ILIKE '%ativo%', '%aposentado%'
CREATE INDEX IF NOT EXISTS idx_folha_sitfunc_trgm
  ON clientes_folha_mes USING gin(sit_func_no_mes gin_trgm_ops);
