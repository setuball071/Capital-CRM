-- Modelos de permissão — salvar um conjunto de permissões por função para replicar
-- Idempotente (IF NOT EXISTS) — seguro rodar várias vezes.

CREATE TABLE IF NOT EXISTS user_permission_templates (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  nome        VARCHAR(120) NOT NULL,
  role        VARCHAR(50) NOT NULL,
  permissions JSONB NOT NULL,
  created_by  INTEGER REFERENCES users(id),
  created_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
