-- Central de Atualizações: system_updates and system_update_reads tables

CREATE TABLE IF NOT EXISTS system_updates (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  raw_input TEXT NOT NULL,
  content_what TEXT NOT NULL,
  content_how TEXT NOT NULL,
  content_impact TEXT NOT NULL,
  target_roles TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  published_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_update_reads (
  id SERIAL PRIMARY KEY,
  update_id INTEGER NOT NULL REFERENCES system_updates(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(update_id, user_id)
);
