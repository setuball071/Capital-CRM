-- Add parcelas fora de folha columns to clientes_folha_mes
-- Required for the EXC QTD / EXC SOMA banner feature (Task #17/#18)

ALTER TABLE clientes_folha_mes
  ADD COLUMN IF NOT EXISTS exc_qtd integer,
  ADD COLUMN IF NOT EXISTS exc_soma numeric(12,2);
