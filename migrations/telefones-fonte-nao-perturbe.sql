-- Fonte do telefone e aviso do cadastro Nao Me Perturbe (07/10/2026).
-- Espelho da auto-migracao em server/index.ts -- o deploy aplica sozinho.
-- fonte: LEMIT | ANATEL | SERASA  (vazio e mostrado como ANATEL)
-- nao_perturbe: so AVISO na ficha; nada bloqueia o numero.

ALTER TABLE clientes_telefones
  ADD COLUMN IF NOT EXISTS fonte VARCHAR(20),
  ADD COLUMN IF NOT EXISTS nao_perturbe BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE client_contacts
  ADD COLUMN IF NOT EXISTS nao_perturbe BOOLEAN NOT NULL DEFAULT FALSE;
