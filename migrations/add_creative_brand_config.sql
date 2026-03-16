-- Migration: Add Creative Brand Config Table
CREATE TABLE IF NOT EXISTS creative_brand_config (
  id SERIAL PRIMARY KEY,
  system_prompt TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  logo_base64 TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);
