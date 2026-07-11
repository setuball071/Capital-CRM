-- Onboarding do Entrante — jornada de entrada de novos vendedores
-- All statements use IF NOT EXISTS — safe to run multiple times

-- 1. Estende vendedores_academia com os campos do onboarding
ALTER TABLE vendedores_academia
  ADD COLUMN IF NOT EXISTS experiencia_declarada BOOLEAN,
  ADD COLUMN IF NOT EXISTS bagagem_origem VARCHAR(255),
  ADD COLUMN IF NOT EXISTS onboarding_etapa VARCHAR(30) NOT NULL DEFAULT 'entrada',
  ADD COLUMN IF NOT EXISTS tour_concluido BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS produto_inicial VARCHAR(50) DEFAULT 'portabilidade',
  ADD COLUMN IF NOT EXISTS baseline_nota DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS baseline_nivel VARCHAR(30),
  ADD COLUMN IF NOT EXISTS liberado_para_prospectar BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS liberado_em TIMESTAMP,
  ADD COLUMN IF NOT EXISTS liberado_por INTEGER REFERENCES users(id);

-- 2. Distingue tentativas do onboarding das do quiz da academia
ALTER TABLE quiz_tentativas
  ADD COLUMN IF NOT EXISTS origem VARCHAR(40); -- null = quiz academia | onboarding_teste | onboarding_compreensao
