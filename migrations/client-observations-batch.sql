-- Migration: Add batch_id and filename to track observation imports as batches

ALTER TABLE client_observations ADD COLUMN IF NOT EXISTS batch_id TEXT;
ALTER TABLE client_observations ADD COLUMN IF NOT EXISTS filename TEXT;

CREATE INDEX IF NOT EXISTS idx_client_obs_batch ON client_observations(batch_id);
