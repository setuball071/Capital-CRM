// Dados FICTÍCIOS do ambiente de demonstração (tenant "Demo"), para gravar
// tutoriais. Só toca tabelas privadas do ambiente; NUNCA a base de clientes
// global (clientes_pessoa/vínculo/folha), que todos os ambientes enxergam.
//
//   node scripts/demo-seed.mjs            -> cria (recusa se já existir)
//   node scripts/demo-seed.mjs --limpar   -> apaga tudo que este script criou
//
// CPF com dígito verificador errado (não pertence a ninguém) e telefone com
// DDD 00 (não existe): clicar no WhatsApp durante a gravação não chama ninguém.
import "dotenv/config";
import pg from "pg";

const TENANT = 12;
const USUARIO = 10;
const CAMPANHA = "Campanha Demonstração SIAPE";
const EQUIPE = "Equipe Demonstração";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const [t] = (await c.query(`SELECT id, name FROM tenants WHERE id = $1`, [TENANT])).rows;
if (!t || !/demo/i.test(t.name)) throw new Error(`Tenant ${TENANT} não é o Demo (achei: ${t?.name})`);

if (process.argv.includes("--limpar")) {
  await c.query("BEGIN");
  await c.query(`DELETE FROM sales_campaigns WHERE tenant_id = $1 AND nome = $2`, [TENANT, CAMPANHA]); // leads/atribuições caem em cascata
  await c.query(`DELETE FROM proposals WHERE tenant_id = $1 AND client_meta->>'demo' = 'true'`, [TENANT]);
  await c.query(`DELETE FROM producoes_contratos WHERE tenant_id = $1 AND contrato_id LIKE 'DEMO-%'`, [TENANT]);
  await c.query(`DELETE FROM appointments WHERE tenant_id = $1 AND payload->>'demo' = 'true'`, [TENANT]);
  await c.query(`DELETE FROM commercial_teams WHERE tenant_id = $1 AND nome_equipe = $2`, [TENANT, EQUIPE]); // metas/membros em cascata
  await c.query("COMMIT");
  console.log("Dados de demonstração apagados.");
  await c.end();
  process.exit(0);
}

const ja = (await c.query(`SELECT 1 FROM sales_campaigns WHERE tenant_id = $1 AND nome = $2`, [TENANT, CAMPANHA])).rowCount;
if (ja) throw new Error("Já existe dado de demonstração. Rode com --limpar antes.");

// ── geradores ───────────────────────────────────────────────────────────────
let semente = 42;
const rnd = () => ((semente = (semente * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const entre = (a, b) => Math.round((a + rnd() * (b - a)) * 100) / 100;

function cpfFalso(i) {
  const base = String(100000000 + i * 7919).padStart(9, "0").slice(0, 9).split("").map(Number);
  const dv = (nums, peso) => {
    const s = nums.reduce((acc, n, k) => acc + n * (peso - k), 0);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(base, 10);
  const d2 = dv([...base, d1], 11);
  const errado = (d2 + 1) % 10; // dígito final propositalmente inválido
  return [...base, d1, errado].join("");
}
const fmtCpf = (s) => `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
const telFalso = (i) => `0090000${String(1000 + i).slice(-4)}`;

const NOMES = [
  "Ana Beatriz Moreira", "Carlos Eduardo Lima", "Juliana Ferreira Souza", "Roberto Alves Pinto",
  "Mariana Costa Ribeiro", "Paulo Henrique Duarte", "Fernanda Rocha Melo", "Ricardo Nogueira Dias",
  "Patrícia Gomes Teixeira", "Marcos Vinícius Araújo", "Luciana Barbosa Cardoso", "José Antônio Freitas",
  "Camila Martins Lopes", "Eduardo Santana Reis", "Renata Oliveira Campos", "Sérgio Monteiro Vieira",
  "Aline Cristina Rezende", "Gustavo Pereira Neves", "Débora Fonseca Lima", "Antônio Carlos Batista",
  "Simone Azevedo Prado", "Fábio Augusto Moura", "Cláudia Ramos Pacheco", "Rodrigo Tavares Brito",
  "Vanessa Cunha Machado", "Leonardo Siqueira Rocha", "Helena Marques Diniz", "Márcio Andrade Lacerda",
  "Tatiana Correia Sales", "Wagner Ribeiro Fontes",
];
const UFS = ["DF", "GO", "SP", "RJ", "MG", "SC", "RS", "PR", "BA", "PE"];
const MARCADORES = [
  ["NOVO", 10], ["EM_ATENDIMENTO", 6], ["AGUARDANDO_RETORNO", 4], ["INTERESSADO", 4],
  ["PROPOSTA_ENVIADA", 3], ["VENDIDO", 2], ["SEM_INTERESSE", 1],
];
const marcadores = MARCADORES.flatMap(([m, n]) => Array(n).fill(m));
const BANCOS = ["CAIXA", "BRB RED", "INTER", "SAFRA", "DIGIO", "PARANA", "NEO"];

await c.query("BEGIN");
try {
  // ── campanha + 30 leads atribuídos ao usuário ─────────────────────────────
  const [camp] = (await c.query(
    `INSERT INTO sales_campaigns (tenant_id, nome, descricao, convenio, status, total_leads, leads_disponiveis, leads_distribuidos, created_by)
     VALUES ($1, $2, 'Dados fictícios para gravação de tutoriais', 'SIAPE', 'ativa', 30, 0, 30, $3) RETURNING id`,
    [TENANT, CAMPANHA, USUARIO])).rows;

  for (let i = 0; i < NOMES.length; i++) {
    const marcador = marcadores[i];
    const margem = entre(180, 1400);
    const [lead] = (await c.query(
      `INSERT INTO sales_leads (tenant_id, campaign_id, cpf, nome, telefone_1, cidade, uf, lead_marker,
         current_margin, current_proposal, matricula, ultimo_contato_em, retorno_em, observacoes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [TENANT, camp.id, cpfFalso(i + 1), NOMES[i], telFalso(i + 1), "Cidade Exemplo", pick(UFS), marcador,
        margem, Math.round(margem * 45), String(1000000 + i * 37),
        marcador === "NOVO" ? null : new Date(Date.now() - entre(1, 9) * 86400000),
        marcador === "AGUARDANDO_RETORNO" ? new Date(Date.now() + entre(1, 5) * 86400000) : null,
        "Cliente fictício (demonstração)"])).rows;
    await c.query(
      `INSERT INTO sales_lead_assignments (lead_id, user_id, campaign_id, status, ordem_fila)
       VALUES ($1, $2, $3, $4, $5)`,
      [lead.id, USUARIO, camp.id, marcador === "NOVO" ? "novo" : marcador === "VENDIDO" ? "vendido" : "em_atendimento", i + 1]);
    if (marcador !== "NOVO") {
      await c.query(
        `INSERT INTO lead_interactions (tenant_id, lead_id, user_id, tipo_contato, lead_marker, observacao, margem_valor)
         VALUES ($1, $2, $3, 'whatsapp', $4, 'Contato de demonstração', $5)`,
        [TENANT, lead.id, USUARIO, marcador, margem]);
    }
  }

  // ── propostas em fases diferentes ─────────────────────────────────────────
  const fases = [
    ["CADASTRADA", "NOVO"], ["DIGITADA", "NOVO"], ["PENDENTE_DIGITACAO", "PORTABILIDADE"],
    ["AGUARDANDO_ENVIO_CIP", "PORTABILIDADE"], ["AGUARDANDO_RETORNO_CIP", "PORTABILIDADE"],
    ["SALDO_INFORMADO_AGUARDANDO_CORRETOR", "PORTABILIDADE"], ["AGUARDANDO_FORMALIZACAO_CLIENTE", "NOVO"],
    ["PAGO", "NOVO"], ["PAGO", "PORTABILIDADE"], ["PAGO", "CARTAO"], ["CANCELADA", "NOVO"],
  ];
  for (let i = 0; i < fases.length; i++) {
    const [status, produto] = fases[i];
    const valor = entre(3000, 48000);
    const prazo = produto === "CARTAO" ? 84 : 96;
    await c.query(
      `INSERT INTO proposals (tenant_id, client_name, client_cpf, client_matricula, client_convenio, bank, product,
         contract_value, installment_value, term, status, vendor_id, created_by, commission_status, client_meta, paid_at, created_at)
       VALUES ($1,$2,$3,$4,'SIAPE',$5,$6,$7,$8,$9,$10,$11,$11,'PENDENTE',$12,$13, NOW() - ($14 || ' days')::interval)`,
      [TENANT, NOMES[i], fmtCpf(cpfFalso(i + 1)), String(1000000 + i * 37), pick(BANCOS), produto,
        valor, Math.round((valor / 42) * 100) / 100, prazo, status, USUARIO,
        JSON.stringify({ demo: true, uf: pick(UFS), telefone: `(00) 90000-${String(1000 + i + 1).slice(-4)}` }),
        status === "PAGO" ? new Date(Date.now() - i * 86400000) : null, String(20 - i)]);
  }

  // ── produção paga (setembro e outubro) ────────────────────────────────────
  let n = 0;
  for (const [mes, qtd] of [["2026-09", 9], ["2026-10", 6]]) {
    for (let k = 0; k < qtd; k++) {
      n++;
      const tipo = pick(["NOVO", "NOVO", "PORTABILIDADE", "CARTAO"]);
      const valor = entre(2500, 52000);
      const perc = tipo === "CARTAO" ? 6 : 3;
      await c.query(
        `INSERT INTO producoes_contratos (tenant_id, contrato_id, nome_cliente, cpf_cliente, banco, tipo_contrato,
           nome_corretor, status, data_pagamento, valor_base, valor_bruto, is_cartao, mes_referencia, confirmado,
           convenio, prazo, vendedor_id, vendedor_nome, comissao_repasse_perc, comissao_repasse_valor,
           comissao_empresa_perc, comissao_empresa_valor, status_comissao, telefone_cliente)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'PAGO',$8,$9,$9,$10,$11,true,'SIAPE',$12,$13,$7,$14,$15,$14,$15,'Aguardando',$16)`,
        [TENANT, `DEMO-${String(n).padStart(4, "0")}`, NOMES[(n + 5) % NOMES.length], fmtCpf(cpfFalso(n + 40)),
          pick(BANCOS), tipo, "Fabio Setubal", `${String(3 + k * 3).padStart(2, "0")}/${mes.slice(5)}/${mes.slice(0, 4)}`,
          valor, tipo === "CARTAO", mes, tipo === "CARTAO" ? "84" : "96", USUARIO, perc,
          Math.round(valor * perc) / 100, `(00) 90000-${String(2000 + n).slice(-4)}`]);
    }
  }

  // ── equipe + metas do mês ─────────────────────────────────────────────────
  const [eq] = (await c.query(
    `INSERT INTO commercial_teams (tenant_id, nome_equipe, descricao, coordenador_id, ativa, meta_mensal)
     VALUES ($1, $2, 'Equipe fictícia para gravação', $3, true, 300000) RETURNING id`, [TENANT, EQUIPE, USUARIO])).rows;
  await c.query(
    `INSERT INTO commercial_team_members (tenant_id, team_id, user_id, funcao_equipe, ativo) VALUES ($1, $2, $3, 'vendedor', true)`,
    [TENANT, eq.id, USUARIO]);
  for (const mes of ["2026-09", "2026-10"]) {
    await c.query(`INSERT INTO metas_equipe (tenant_id, equipe_id, mes_referencia, meta_geral, meta_cartao, tipo_meta)
                   VALUES ($1, $2, $3, 300000, 30000, 'producao')`, [TENANT, eq.id, mes]);
    await c.query(`INSERT INTO metas_individuais (tenant_id, usuario_id, equipe_id, mes_referencia, meta_geral, meta_cartao, tipo_meta)
                   VALUES ($1, $2, $3, $4, 250000, 25000, 'producao')`, [TENANT, USUARIO, eq.id, mes]);
  }

  // ── agenda: retornos dos próximos dias ────────────────────────────────────
  for (let k = 0; k < 5; k++) {
    await c.query(
      `INSERT INTO appointments (tenant_id, user_id, client_cpf, client_name, title, notes, scheduled_for, status, kind, payload)
       VALUES ($1, $2, $3, $4, $5, 'Retorno de demonstração', NOW() + ($6 || ' hours')::interval, 'open', 'client_followup', '{"demo":true}')`,
      [TENANT, USUARIO, cpfFalso(k + 1), NOMES[k], `Retornar para ${NOMES[k].split(" ")[0]}`, String(20 + k * 22)]);
  }

  await c.query("COMMIT");
  console.log("Demo criado: 30 leads, 11 propostas, 15 contratos pagos, equipe + metas, 5 retornos.");
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
