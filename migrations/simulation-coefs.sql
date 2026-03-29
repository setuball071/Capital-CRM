ALTER TABLE portfolio_rules ADD COLUMN IF NOT EXISTS default_coef_consignado DECIMAL(8,6);
ALTER TABLE portfolio_rules ADD COLUMN IF NOT EXISTS default_coef_cartao_credito DECIMAL(8,6);
ALTER TABLE portfolio_rules ADD COLUMN IF NOT EXISTS default_coef_cartao_beneficio DECIMAL(8,6);
