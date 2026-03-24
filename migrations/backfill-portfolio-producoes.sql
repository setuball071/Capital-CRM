-- Backfill client_portfolio from producoes_contratos
-- Maps is_cartao=true -> CARTAO (3 months), is_cartao=false -> type from tipo_contrato (6 months)
-- Uses data_pagamento (DD/MM/YYYY) as the start date; falls back to NOW() if unparseable.

INSERT INTO client_portfolio (
  tenant_id,
  cpf,
  client_name,
  vendor_id,
  product_type,
  origin,
  origin_id,
  started_at,
  expires_at,
  status,
  created_at
)
SELECT
  pc.tenant_id,
  REGEXP_REPLACE(pc.cpf_cliente, '\D', '', 'g'),
  pc.nome_cliente,
  pc.vendedor_id,
  CASE
    WHEN pc.is_cartao = true THEN 'CARTAO'
    WHEN UPPER(pc.tipo_contrato) LIKE '%PORTAB%' THEN 'PORTABILIDADE'
    WHEN UPPER(pc.tipo_contrato) LIKE '%REFIN%' THEN 'REFINANCIAMENTO'
    ELSE 'CONSIGNADO'
  END AS product_type,
  'IMPORTACAO' AS origin,
  pc.id AS origin_id,
  COALESCE(
    TO_DATE(pc.data_pagamento, 'DD/MM/YYYY'),
    NOW()
  ) AS started_at,
  COALESCE(
    TO_DATE(pc.data_pagamento, 'DD/MM/YYYY'),
    NOW()::date
  ) + (
    CASE
      WHEN pc.is_cartao = true THEN INTERVAL '3 months'
      ELSE INTERVAL '6 months'
    END
  ) AS expires_at,
  CASE
    WHEN COALESCE(
      TO_DATE(pc.data_pagamento, 'DD/MM/YYYY'),
      NOW()::date
    ) + (
      CASE
        WHEN pc.is_cartao = true THEN INTERVAL '3 months'
        ELSE INTERVAL '6 months'
      END
    ) > NOW() THEN 'ATIVO'
    ELSE 'EXPIRADO'
  END AS status,
  NOW() AS created_at
FROM producoes_contratos pc
WHERE
  pc.vendedor_id IS NOT NULL
  AND pc.cpf_cliente IS NOT NULL
  AND pc.cpf_cliente != ''
ON CONFLICT DO NOTHING;
