-- Task #48: Correção histórica — margem_saldo_70 NULL tratado como zero
-- Quando margem_saldo_70 é ausente (NULL), significa que não há margem de 70% disponível.
-- Portanto, as margens parciais (35%, 5%, beneficio 5%) devem ser zeradas.
-- Executado em 2026-03-29: afetou ~51.112 linhas.

UPDATE clientes_folha_mes
SET
  margem_saldo_35 = 0,
  margem_saldo_5 = 0,
  margem_beneficio_saldo_5 = 0
WHERE
  margem_saldo_70 IS NULL
  AND (
    (margem_saldo_35 IS NOT NULL AND margem_saldo_35 > 0)
    OR (margem_saldo_5 IS NOT NULL AND margem_saldo_5 > 0)
    OR (margem_beneficio_saldo_5 IS NOT NULL AND margem_beneficio_saldo_5 > 0)
  );
