-- Busca por telefone: índices + backfill de clientes_telefones
-- Idempotente. Pode rodar múltiplas vezes sem efeito colateral.

-- =============================================================
-- 1. Índice em clientes_telefones para busca rápida por número
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_clientes_telefones_telefone
  ON clientes_telefones (telefone);

-- =============================================================
-- 2. Índices funcionais nas tabelas de origem (fallback ao vivo)
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_staging_contatos_tel1_digits
  ON staging_contatos ((regexp_replace(coalesce(telefone_1,''), '\D', '', 'g')))
  WHERE telefone_1 IS NOT NULL AND telefone_1 != '';
CREATE INDEX IF NOT EXISTS idx_staging_contatos_tel2_digits
  ON staging_contatos ((regexp_replace(coalesce(telefone_2,''), '\D', '', 'g')))
  WHERE telefone_2 IS NOT NULL AND telefone_2 != '';
CREATE INDEX IF NOT EXISTS idx_staging_contatos_tel3_digits
  ON staging_contatos ((regexp_replace(coalesce(telefone_3,''), '\D', '', 'g')))
  WHERE telefone_3 IS NOT NULL AND telefone_3 != '';
CREATE INDEX IF NOT EXISTS idx_staging_contatos_tel4_digits
  ON staging_contatos ((regexp_replace(coalesce(telefone_4,''), '\D', '', 'g')))
  WHERE telefone_4 IS NOT NULL AND telefone_4 != '';
CREATE INDEX IF NOT EXISTS idx_staging_contatos_tel5_digits
  ON staging_contatos ((regexp_replace(coalesce(telefone_5,''), '\D', '', 'g')))
  WHERE telefone_5 IS NOT NULL AND telefone_5 != '';

CREATE INDEX IF NOT EXISTS idx_sales_leads_tel1_digits
  ON sales_leads ((regexp_replace(coalesce(telefone_1,''), '\D', '', 'g')))
  WHERE telefone_1 IS NOT NULL AND telefone_1 != '';
CREATE INDEX IF NOT EXISTS idx_sales_leads_tel2_digits
  ON sales_leads ((regexp_replace(coalesce(telefone_2,''), '\D', '', 'g')))
  WHERE telefone_2 IS NOT NULL AND telefone_2 != '';
CREATE INDEX IF NOT EXISTS idx_sales_leads_tel3_digits
  ON sales_leads ((regexp_replace(coalesce(telefone_3,''), '\D', '', 'g')))
  WHERE telefone_3 IS NOT NULL AND telefone_3 != '';

CREATE INDEX IF NOT EXISTS idx_producoes_contratos_tel_digits
  ON producoes_contratos ((regexp_replace(coalesce(telefone_cliente,''), '\D', '', 'g')))
  WHERE telefone_cliente IS NOT NULL AND telefone_cliente != '';

-- =============================================================
-- 3. Backfill: copiar telefones distintos das origens para clientes_telefones
--    Match por CPF normalizado (lpad 11). Skippa duplicados via ON CONFLICT.
--    Aceita só telefones com 10 ou 11 dígitos (padrão BR).
-- =============================================================

-- 3.1 staging_contatos (5 colunas de telefone)
INSERT INTO clientes_telefones (pessoa_id, telefone, tipo, base_tag, principal)
SELECT DISTINCT cp.id, src.tel, 'backfill', 'backfill_staging', false
FROM (
  SELECT
    lpad(regexp_replace(coalesce(cpf,''), '\D', '', 'g'), 11, '0') AS cpf_norm,
    regexp_replace(coalesce(t,''), '\D', '', 'g') AS tel
  FROM staging_contatos sc
  CROSS JOIN LATERAL unnest(ARRAY[sc.telefone_1, sc.telefone_2, sc.telefone_3, sc.telefone_4, sc.telefone_5]) AS t
  WHERE sc.cpf IS NOT NULL AND sc.cpf != ''
) src
JOIN clientes_pessoa cp ON cp.cpf = src.cpf_norm
WHERE length(src.tel) BETWEEN 10 AND 11
ON CONFLICT (pessoa_id, telefone) DO NOTHING;

-- 3.2 sales_leads (3 colunas)
INSERT INTO clientes_telefones (pessoa_id, telefone, tipo, base_tag, principal)
SELECT DISTINCT cp.id, src.tel, 'backfill', 'backfill_leads', false
FROM (
  SELECT
    lpad(regexp_replace(coalesce(cpf,''), '\D', '', 'g'), 11, '0') AS cpf_norm,
    regexp_replace(coalesce(t,''), '\D', '', 'g') AS tel
  FROM sales_leads sl
  CROSS JOIN LATERAL unnest(ARRAY[sl.telefone_1, sl.telefone_2, sl.telefone_3]) AS t
  WHERE sl.cpf IS NOT NULL AND sl.cpf != ''
) src
JOIN clientes_pessoa cp ON cp.cpf = src.cpf_norm
WHERE length(src.tel) BETWEEN 10 AND 11
ON CONFLICT (pessoa_id, telefone) DO NOTHING;

-- 3.3 producoes_contratos (1 coluna; cpf_cliente)
INSERT INTO clientes_telefones (pessoa_id, telefone, tipo, base_tag, principal)
SELECT DISTINCT cp.id, src.tel, 'backfill', 'backfill_producoes', false
FROM (
  SELECT
    lpad(regexp_replace(coalesce(cpf_cliente,''), '\D', '', 'g'), 11, '0') AS cpf_norm,
    regexp_replace(coalesce(telefone_cliente,''), '\D', '', 'g') AS tel
  FROM producoes_contratos pc
  WHERE cpf_cliente IS NOT NULL AND cpf_cliente != '' AND telefone_cliente IS NOT NULL AND telefone_cliente != ''
) src
JOIN clientes_pessoa cp ON cp.cpf = src.cpf_norm
WHERE length(src.tel) BETWEEN 10 AND 11
ON CONFLICT (pessoa_id, telefone) DO NOTHING;

-- Estatísticas finais
SELECT 'clientes_telefones total' AS info, COUNT(*) AS valor FROM clientes_telefones
UNION ALL SELECT 'pessoas com telefone', COUNT(DISTINCT pessoa_id) FROM clientes_telefones;
