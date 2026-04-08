-- Migration: Change client_observations from single-observation-per-CPF to multi-observation
-- Removes UNIQUE(tenant_id, cpf) and adds UNIQUE(tenant_id, cpf, observation) instead

ALTER TABLE client_observations DROP CONSTRAINT IF EXISTS client_observations_tenant_id_cpf_key;

ALTER TABLE client_observations DROP CONSTRAINT IF EXISTS client_observations_tenant_id_cpf_observation_key;
ALTER TABLE client_observations ADD CONSTRAINT client_observations_tenant_id_cpf_observation_key UNIQUE (tenant_id, cpf, observation);
