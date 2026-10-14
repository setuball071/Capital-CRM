-- Bases de GOVERNO compradas por assinantes (ES = Leticia Santos, PR = Elisandra Cassol).
-- Ficam FORA da base global de clientes (clientes_pessoa / clientes_telefones), que todo
-- ambiente enxerga. Cada base so abre para os ambientes liberados em tenant_bases e para
-- o master. Espelho do bloco de auto-migration em server/index.ts.

CREATE TABLE IF NOT EXISTS gov_bases (
  codigo            VARCHAR(20) PRIMARY KEY,
  nome              VARCHAR(120) NOT NULL,
  uf                VARCHAR(2),
  descricao         TEXT,
  total_servidores  INTEGER NOT NULL DEFAULT 0,
  atualizado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenant_bases (
  tenant_id    INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  base_codigo  VARCHAR(20) NOT NULL REFERENCES gov_bases(codigo) ON DELETE CASCADE,
  criado_em    TIMESTAMP NOT NULL DEFAULT NOW(),
  PRIMARY KEY (tenant_id, base_codigo)
);

CREATE TABLE IF NOT EXISTS gov_servidores (
  id               BIGSERIAL PRIMARY KEY,
  base_codigo      VARCHAR(20) NOT NULL REFERENCES gov_bases(codigo) ON DELETE CASCADE,
  cpf              VARCHAR(11) NOT NULL,
  nome             TEXT,
  sexo             VARCHAR(1),
  data_nascimento  DATE,
  nome_mae         TEXT,
  matricula        TEXT,
  orgao            TEXT,
  lotacao          TEXT,
  cargo            TEXT,
  regime           TEXT,
  situacao         VARCHAR(30),
  tipo_cargo       TEXT,
  admissao         DATE,
  desligamento     DATE,
  remuneracao      NUMERIC(12,2),
  renda_estimada   NUMERIC(12,2),
  endereco         TEXT,
  numero           TEXT,
  complemento      TEXT,
  bairro           TEXT,
  cidade           TEXT,
  uf               VARCHAR(2),
  cep              VARCHAR(8),
  margens          JSONB,
  extras           JSONB,
  carregado_em     TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_gov_serv_base_cpf  ON gov_servidores (base_codigo, cpf);
CREATE INDEX IF NOT EXISTS idx_gov_serv_cpf       ON gov_servidores (cpf);
CREATE INDEX IF NOT EXISTS idx_gov_serv_base_nome ON gov_servidores (base_codigo, nome text_pattern_ops);

CREATE TABLE IF NOT EXISTS gov_contatos (
  id            BIGSERIAL PRIMARY KEY,
  base_codigo   VARCHAR(20) NOT NULL REFERENCES gov_bases(codigo) ON DELETE CASCADE,
  cpf           VARCHAR(11) NOT NULL,
  tipo          VARCHAR(10) NOT NULL,          -- telefone | email
  valor         TEXT NOT NULL,
  fonte         VARCHAR(20),                   -- BASE | ANATEL | SERASA | LEMIT
  celular       BOOLEAN NOT NULL DEFAULT FALSE,
  nao_perturbe  BOOLEAN NOT NULL DEFAULT FALSE,
  ordem         SMALLINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_gov_cont_base_cpf ON gov_contatos (base_codigo, cpf);
CREATE INDEX IF NOT EXISTS idx_gov_cont_valor    ON gov_contatos (valor) WHERE tipo = 'telefone';

INSERT INTO gov_bases (codigo, nome, uf) VALUES
  ('GOV-ES', 'Governo do Espírito Santo', 'ES'),
  ('GOV-PR', 'Governo do Paraná', 'PR'),
  ('GOV-MA', 'Governo do Maranhão', 'MA')
ON CONFLICT (codigo) DO NOTHING;
