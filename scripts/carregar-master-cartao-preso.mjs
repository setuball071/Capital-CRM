/**
 * Carrega no CRM a lista de clientes com CARTAO do BANCO MASTER (ex-Banco Maxima).
 *
 * O Master entrou em liquidacao e o cartao consignado parou de ser descontado em
 * NOVEMBRO/2025 -- a rubrica 35014 cai de 20.171 contratos para 2 em dez/25.
 * A parcela sumiu da folha MAS A AVERBACAO CONTINUA PRESA no banco: o cliente
 * precisa liquidar para soltar. O SIAPE devolve a margem de CARTAO BENEFICIO
 * como se estivesse livre e outro banco nao consegue averbar.
 *
 * O CRM nao descobre isso sozinho: a base dele so guarda contratos de jul e
 * ago/2026. A lista vem do Bigdata, via CSV gerado por
 * _scripts/build_master_cartao_preso.py.
 *
 * Idempotente: TRUNCATE + recarga. Rodar de novo nao duplica.
 *
 * Uso:  node scripts/carregar-master-cartao-preso.mjs [caminho-do-csv]
 */
import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

const CSV = process.argv[2] || String.raw`C:\Users\Fabio Setubal\Desktop\COWORK\Bigdata\SIAPE\Leads\Master\master_cartao_preso.csv`;
const ENV = path.resolve(process.cwd(), '.env');

const env = fs.readFileSync(ENV, 'utf8');
const m = env.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
if (!m) {
  console.error('DATABASE_URL nao encontrada em .env');
  process.exit(1);
}

if (!fs.existsSync(CSV)) {
  console.error(`CSV nao encontrado: ${CSV}`);
  console.error('Rode antes: python _scripts/build_master_cartao_preso.py');
  process.exit(1);
}
const linhas = fs.readFileSync(CSV, 'utf8')
  .split(/\r?\n/).slice(1).filter(Boolean)
  .map((l) => {
    const [cpf, parcela, contratos] = l.split(';');
    return {
      cpf: String(cpf).replace(/\D/g, '').padStart(11, '0'),
      parcela: parseFloat(parcela) || 0,
      contratos: (contratos || '').slice(0, 500),
    };
  })
  .filter((l) => l.cpf.length === 11);
console.log(`CSV: ${linhas.length.toLocaleString('pt-BR')} CPFs`);

const c = new pg.Client({ connectionString: m[1], ssl: { rejectUnauthorized: false } });
await c.connect();

await c.query(`
  CREATE TABLE IF NOT EXISTS master_cartao_preso (
    cpf             varchar(11) PRIMARY KEY,
    parcela_nov2025 numeric(15,2),
    contratos       text,
    atualizado_em   timestamp NOT NULL DEFAULT now()
  )`);

await c.query('BEGIN');
await c.query('TRUNCATE master_cartao_preso');
const LOTE = 1000;
let n = 0;
for (let i = 0; i < linhas.length; i += LOTE) {
  const bloco = linhas.slice(i, i + LOTE);
  const vals = [];
  const params = [];
  bloco.forEach((l, j) => {
    const b = j * 3;
    vals.push(`($${b + 1},$${b + 2},$${b + 3})`);
    params.push(l.cpf, l.parcela, l.contratos);
  });
  await c.query(
    `INSERT INTO master_cartao_preso (cpf, parcela_nov2025, contratos)
     VALUES ${vals.join(',')} ON CONFLICT (cpf) DO NOTHING`, params);
  n += bloco.length;
}
await c.query('COMMIT');

const [{ total }] = (await c.query('SELECT COUNT(*)::int AS total FROM master_cartao_preso')).rows;
console.log(`CRM: ${Number(total).toLocaleString('pt-BR')} CPFs gravados`);

const [{ n: casados }] = (await c.query(`
    SELECT COUNT(*)::int AS n FROM master_cartao_preso mp
    JOIN clientes_pessoa p ON regexp_replace(p.cpf,'[^0-9]','','g') = mp.cpf`)).rows;
console.log(`Destes, ${Number(casados).toLocaleString('pt-BR')} batem com uma pessoa do CRM`);

await c.end();
