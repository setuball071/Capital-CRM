CREATE TABLE IF NOT EXISTS client_observations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  cpf VARCHAR(14) NOT NULL,
  observation TEXT NOT NULL,
  imported_by INTEGER REFERENCES users(id),
  imported_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, cpf)
);
CREATE INDEX IF NOT EXISTS idx_client_obs_cpf ON client_observations(tenant_id, cpf);
