-- Migration: Tabela de contracheques SIAPE
-- Armazena o JSON completo do contracheque de cada servidor federal
-- Retenção: máximo 3 meses por CPF (gerenciado pelo script de importação)

CREATE TABLE IF NOT EXISTS contracheques_siape (
    id              SERIAL PRIMARY KEY,
    cpf             CHAR(11)        NOT NULL,
    cpf_formatado   VARCHAR(14),
    nome            VARCHAR(200),
    mes_pagamento   VARCHAR(10)     NOT NULL,   -- ex: "ABR2026"
    tipo_relacao    VARCHAR(20),                -- SERVIDOR | APOSENTADO | PENSAO
    orgao_nome      VARCHAR(300),
    total_bruto     NUMERIC(12,2),
    total_descontos NUMERIC(12,2),
    total_liquido   NUMERIC(12,2),
    json_dados      JSONB           NOT NULL,   -- JSON completo do contracheque
    importado_em    TIMESTAMP       DEFAULT NOW(),
    UNIQUE (cpf, mes_pagamento)
);

CREATE INDEX IF NOT EXISTS idx_contracheques_cpf ON contracheques_siape(cpf);
CREATE INDEX IF NOT EXISTS idx_contracheques_mes ON contracheques_siape(mes_pagamento);
CREATE INDEX IF NOT EXISTS idx_contracheques_tipo ON contracheques_siape(tipo_relacao);
