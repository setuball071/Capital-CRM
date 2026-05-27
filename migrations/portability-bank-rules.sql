-- Regras dos bancos do Simulador de Portabilidade
-- Tira essa config do localStorage (por navegador/usuário) e move para o banco (por tenant).
-- Edição via API restrita a usuários master.
-- Idempotente (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS portability_bank_rules (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  banco         VARCHAR(100) NOT NULL,
  entrada_min   NUMERIC(10,6) NOT NULL DEFAULT 0,
  taxa_refim    NUMERIC(10,6) NOT NULL DEFAULT 0,
  saldo_min     NUMERIC(14,2) NOT NULL DEFAULT 0,
  min_troco     NUMERIC(14,2) NOT NULL DEFAULT 0,
  taxa_livre    BOOLEAN NOT NULL DEFAULT FALSE,
  taxa_sugerida NUMERIC(10,6),
  obs           JSONB,
  ordem         INTEGER NOT NULL DEFAULT 0,
  updated_by    INTEGER REFERENCES users(id),
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS portability_bank_rules_tenant_banco_unique
  ON portability_bank_rules (tenant_id, banco);

CREATE INDEX IF NOT EXISTS portability_bank_rules_tenant_idx
  ON portability_bank_rules (tenant_id);

-- Seeds (regras padrão atualmente hardcoded no ferramentas-portabilidade.html).
-- Inseridas para todos os tenants existentes. ON CONFLICT preserva customizações.
INSERT INTO portability_bank_rules
  (tenant_id, banco, entrada_min, taxa_refim, saldo_min, min_troco, taxa_livre, taxa_sugerida, obs, ordem)
SELECT t.id, 'Digio', 1.35, 1.65, 5500, 250, FALSE, NULL,
  '[
    {"tipo":"ok","txt":"Saldo mínimo de R$ 5.500,00 (SIAPE)"},
    {"tipo":"ok","txt":"Troco mínimo de R$ 250,00"},
    {"tipo":"ok","txt":"Taxa de entrada mínima: 1,35% a.m."},
    {"tipo":"ok","txt":"Taxa de refinanciamento: 1,65% a.m."}
  ]'::jsonb, 1
FROM tenants t
ON CONFLICT (tenant_id, banco) DO NOTHING;

INSERT INTO portability_bank_rules
  (tenant_id, banco, entrada_min, taxa_refim, saldo_min, min_troco, taxa_livre, taxa_sugerida, obs, ordem)
SELECT t.id, 'Inter', 0.70, 1.65, 1000, 300, FALSE, NULL,
  '[
    {"tipo":"ok","txt":"Saldo mínimo de R$ 1.000,00"},
    {"tipo":"ok","txt":"Liberação mínima (troco) de R$ 300,00"},
    {"tipo":"ok","txt":"Taxa ponderada de entrada: 0,70% a.m."},
    {"tipo":"ok","txt":"PORT + REFIN obrigatórios para comissionamento"},
    {"tipo":"ok","txt":"Porta todos os bancos com 0 pagas, sem acordo e sem travas"},
    {"tipo":"info","txt":"Limite operacional: até R$ 270.000,00"},
    {"tipo":"info","txt":"Coobrigação: 90 dias"},
    {"tipo":"aviso","txt":"Idade limite: 75 anos (sem seguro)"}
  ]'::jsonb, 2
FROM tenants t
ON CONFLICT (tenant_id, banco) DO NOTHING;

INSERT INTO portability_bank_rules
  (tenant_id, banco, entrada_min, taxa_refim, saldo_min, min_troco, taxa_livre, taxa_sugerida, obs, ordem)
SELECT t.id, 'Caixa', 0, 0, 0, 250, TRUE, 1.40,
  '[
    {"tipo":"ok","txt":"Taxa de entrada = taxa de refim (mesma operação)"},
    {"tipo":"ok","txt":"Sem trava de taxa de entrada"},
    {"tipo":"ok","txt":"Troco mínimo de R$ 250,00"},
    {"tipo":"info","txt":"Informe a taxa negociada no campo acima"}
  ]'::jsonb, 3
FROM tenants t
ON CONFLICT (tenant_id, banco) DO NOTHING;
