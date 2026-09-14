/**
 * Cria no CRM os clientes que tem CONTRATO no D8 mas NAO vieram na FOLHA.
 *
 * O cadastro de pessoa do CRM nasce da importacao da folha (mergeFolha), e o
 * merge do D8 so grava contrato para pessoa que ja existe (JOIN clientes_pessoa).
 * Quem falta na folha fica invisivel: a consulta responde "Cliente nao
 * localizado" mesmo com contrato ativo. Descoberto em 14/09/2026 com a
 * ANA ALODIA DA SILVA BARROSO (CPF 202.710.342-20, Ministerio da Saude).
 *
 * Em ago/2026 sao 6.709 CPFs, concentrados em UPAGs PARCIALMENTE extraidas na
 * origem (MS 762 e 1904, UFRN 7, UFCG 48). O conserto real e na extracao da
 * folha; isto so evita que o time perca esses clientes enquanto isso.
 *
 * O QUE GRAVA -- sem margem (margem so vem da folha):
 *   - clientes_pessoa   (so CPFs que ainda nao existem; ON CONFLICT (cpf) DO NOTHING)
 *   - clientes_vinculo  (matricula SEM zeros a esquerda, orgao = codigo -- o mesmo
 *                        formato da folha, para a folha futura cair no mesmo
 *                        vinculo via ON CONFLICT (cpf, matricula, orgao))
 *   - clientes_contratos (so bancos que o CRM ja conhece; numero entre parenteses,
 *                        como o D8 do CRM grava)
 * Tudo marcado com um import_run proprio. Para desfazer:
 *   DELETE FROM clientes_contratos WHERE import_run_id = <id>;
 *   DELETE FROM clientes_vinculo   WHERE import_run_id = <id>;
 *   DELETE FROM clientes_pessoa    WHERE import_run_id = <id>;
 *
 * SIMULACAO por padrao (faz tudo e da ROLLBACK). Grava so com --executar.
 *
 * Uso:  node scripts/carregar-d8-sem-folha.mjs <csv> [--executar]
 *       CSV = linhas brutas do D8 (organizador) so dos CPFs sem folha.
 */
import fs from 'node:fs';
import path from 'node:path';

import pg from 'pg';

const args = process.argv.slice(2);
const EXECUTAR = args.includes('--executar');
const CSV = args.find((a) => !a.startsWith('--'));
const COMPETENCIA = '2026-08-01';
const BASE_TAG = '202608d8';
const TENANT = 4;          // o mesmo tenant das importacoes de D8/folha de ago/2026
const USUARIO = 1;

if (!CSV || !fs.existsSync(CSV)) {
  console.error('Uso: node scripts/carregar-d8-sem-folha.mjs <csv> [--executar]');
  process.exit(1);
}
const env = fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8');
const m = env.match(/^\s*DATABASE_URL\s*=\s*["']?(.+?)["']?\s*$/m);
if (!m) {
  console.error('DATABASE_URL nao encontrada em .env');
  process.exit(1);
}

const semZeros = (v) => String(v || '').replace(/\D/g, '').replace(/^0+/, '') || '';
const num = (v) => {
  const s = String(v || '').trim();
  if (!s) return null;
  const n = parseFloat(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s);
  return Number.isFinite(n) ? n : null;
};
const bancoDoArquivo = (arq) => String(arq || '').replace(/\s+(SERV|PENS)\s+d8.*$/i, '').trim();

// ---------------------------------------------------------------- CSV
const L = fs.readFileSync(CSV, 'utf8').split(/\r?\n/);
const H = L[0].replace(/^﻿/, '').split(';');
const linhas = L.slice(1).filter(Boolean)
  .map((l) => Object.fromEntries(l.split(';').map((v, i) => [H[i], v])));
console.log(`CSV: ${linhas.length.toLocaleString('pt-BR')} linhas`);

const c = new pg.Client({ connectionString: m[1], ssl: { rejectUnauthorized: false } });
await c.connect();
const q = async (s, p = []) => (await c.query(s, p)).rows;

const cpfsCsv = [...new Set(linhas.map((r) => String(r.CPF).replace(/\D/g, '').padStart(11, '0')))];
const jaExistem = new Set((await q('SELECT cpf FROM clientes_pessoa WHERE cpf = ANY($1)', [cpfsCsv])).map((r) => r.cpf));
const bancosCrm = new Set((await q(
  'SELECT DISTINCT banco FROM clientes_contratos WHERE competencia = $1', [COMPETENCIA])).map((r) => r.banco));

// agrupa por pessoa e por vinculo
const pessoas = new Map();
let foraBanco = 0;
for (const r of linhas) {
  const cpf = String(r.CPF).replace(/\D/g, '').padStart(11, '0');
  if (cpf.length !== 11 || jaExistem.has(cpf)) continue;
  const orgao = String(r.ORGAO || '').trim();
  const matricula = semZeros(r.MATRIC);
  if (!orgao || !matricula) continue;
  if (!pessoas.has(cpf)) {
    pessoas.set(cpf, {
      nome: String(r.NOME || '').trim(), uf: String(r.UF || '').trim(),
      orgao, matricula, upag: semZeros(r.UPAG), vinculos: new Map(),
    });
  }
  const p = pessoas.get(cpf);
  const vk = `${matricula}|${orgao}`;
  if (!p.vinculos.has(vk)) p.vinculos.set(vk, { matricula, orgao, upag: semZeros(r.UPAG), contratos: new Map() });
  const banco = bancoDoArquivo(r.ARQUIVO_ORIGEM);
  const nc = String(r.N_CONTRATO || '').trim();
  if (!nc) continue;
  if (!bancosCrm.has(banco)) { foraBanco++; continue; }
  const numero = nc.startsWith('(') ? nc : `(${nc})`;
  p.vinculos.get(vk).contratos.set(numero, {
    banco, numero, tipo: String(r.TIPO || '').trim(),
    parcela: num(r.PMT), prazo: parseInt(String(r.PRAZO || '').replace(/\D/g, ''), 10) || null,
  });
}
const nVinc = [...pessoas.values()].reduce((a, p) => a + p.vinculos.size, 0);
const nCt = [...pessoas.values()].reduce((a, p) => a + [...p.vinculos.values()].reduce((b, v) => b + v.contratos.size, 0), 0);
console.log(`ja existiam no CRM (ignorados): ${jaExistem.size.toLocaleString('pt-BR')}`);
console.log(`a criar: ${pessoas.size.toLocaleString('pt-BR')} pessoas | ${nVinc.toLocaleString('pt-BR')} vinculos | ${nCt.toLocaleString('pt-BR')} contratos`);
console.log(`linhas de entidades que o CRM nao carrega (GEAP, sindicatos...): ${foraBanco.toLocaleString('pt-BR')}`);

// ---------------------------------------------------------------- grava
await c.query('BEGIN');
try {
  const [run] = await q(`
    INSERT INTO import_runs (tenant_id, tipo_import, competencia, banco, arquivo_origem, status,
                             total_rows, processed_rows, success_rows, error_rows, base_tag, convenio,
                             created_by_id, started_at, completed_at)
    VALUES ($1, 'd8', $2, 'DIVERSOS', 'Bigdata: D8 sem folha ago/2026 (carregar-d8-sem-folha.mjs)',
            'concluido', $3, $3, $3, 0, $4, 'SIAPE', $5, now(), now())
    RETURNING id`, [TENANT, COMPETENCIA, nCt, BASE_TAG, USUARIO]);

  let np = 0; let nv = 0; let nc = 0;
  for (const [cpf, p] of pessoas) {
    const pr = await q(`
      INSERT INTO clientes_pessoa (tenant_id, cpf, matricula, nome, orgaodesc, upag, uf, convenio,
                                   base_tag_ultima, import_run_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,'SIAPE',$8,$9)
      ON CONFLICT (cpf) DO NOTHING RETURNING id`,
      [TENANT, cpf, p.matricula, p.nome, p.orgao, p.upag, p.uf, BASE_TAG, run.id]);
    if (!pr.length) continue;
    np++;
    const pessoaId = pr[0].id;
    for (const v of p.vinculos.values()) {
      const vr = await q(`
        INSERT INTO clientes_vinculo (tenant_id, cpf, matricula, orgao, convenio, pessoa_id, upag,
                                      import_run_id, base_tag)
        VALUES ($1,$2,$3,$4,'SIAPE',$5,$6,$7,$8)
        ON CONFLICT (cpf, matricula, orgao) DO NOTHING RETURNING id`,
        [TENANT, cpf, v.matricula, v.orgao, pessoaId, v.upag, run.id, BASE_TAG]);
      if (!vr.length) continue;
      nv++;
      for (const ct of v.contratos.values()) {
        const cr = await q(`
          INSERT INTO clientes_contratos (pessoa_id, vinculo_id, banco, numero_contrato, tipo_contrato,
                                          valor_parcela, parcelas_restantes, competencia, import_run_id, base_tag)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
          ON CONFLICT (pessoa_id, numero_contrato) DO NOTHING RETURNING id`,
          [pessoaId, vr[0].id, ct.banco, ct.numero, ct.tipo, ct.parcela, ct.prazo, COMPETENCIA, run.id, BASE_TAG]);
        nc += cr.length;
      }
    }
  }
  console.log(`\ngravado (dentro da transacao): ${np} pessoas | ${nv} vinculos | ${nc} contratos | import_run ${run.id}`);

  if (EXECUTAR) {
    await c.query('COMMIT');
    console.log(`\n>>> GRAVADO. import_run_id = ${run.id} (use para desfazer)`);
  } else {
    await c.query('ROLLBACK');
    console.log('\n>>> SIMULACAO: nada foi gravado. Rode com --executar para gravar.');
  }
} catch (e) {
  await c.query('ROLLBACK');
  console.error('ERRO, nada gravado:', e.message);
  process.exitCode = 1;
}
await c.end();
