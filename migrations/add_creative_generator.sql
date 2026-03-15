-- Migration: Add Creative Generator Module
-- Tables: creative_generations, creative_generation_quota

CREATE TABLE IF NOT EXISTS creative_generations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  prompt_used TEXT NOT NULL,
  form_data JSONB,
  image_urls TEXT[],
  selected_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS creative_generation_quota (
  user_id INTEGER NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
