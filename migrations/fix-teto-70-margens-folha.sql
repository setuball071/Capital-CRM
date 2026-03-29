-- Task #47: Correção histórica do teto de 70% nas margens de folha
-- Aplica LEAST(margem_parcial, margem_70) para todos os registros existentes
-- onde margem_saldo_70 >= 0 e alguma margem parcial excede o teto.
-- Executado em 2026-03-29: corrigiu 301.710 linhas.

UPDATE clientes_folha_mes
SET
  margem_saldo_35 = LEAST(margem_saldo_35, margem_saldo_70),
  margem_saldo_5 = LEAST(margem_saldo_5, margem_saldo_70),
  margem_beneficio_saldo_5 = LEAST(margem_beneficio_saldo_5, margem_saldo_70)
WHERE
  margem_saldo_70 >= 0
  AND (
    margem_saldo_35 > margem_saldo_70
    OR margem_saldo_5 > margem_saldo_70
    OR margem_beneficio_saldo_5 > margem_saldo_70
  );
