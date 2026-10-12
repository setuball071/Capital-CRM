// Dados FICTÍCIOS do ambiente de demonstração (tenant "Demo"), para gravar
// tutoriais. Só toca tabelas privadas do ambiente; NUNCA a base de clientes
// global (clientes_pessoa/vínculo/folha), que todos os ambientes enxergam.
//
//   node scripts/demo-seed.mjs            -> cria (recusa se já existir)
//   node scripts/demo-seed.mjs --limpar   -> apaga tudo que este script criou
//
// CPF com dígito verificador errado (não pertence a ninguém) e telefone com
// DDD 00 (não existe): clicar no WhatsApp durante a gravação não chama ninguém.
//
// Uma história só, para as telas baterem entre si:
//   lead VENDIDO  -> proposta PAGO -> venda na Minha Produção (que alimenta o painel)
//   lead PROPOSTA_ENVIADA -> proposta em andamento (sem produção ainda)
//   lead SEM_INTERESSE    -> proposta CANCELADA (+ venda cancelada na Minha Produção)
//   lead AGUARDANDO_RETORNO -> retorno marcado na agenda
//   clientes de carteira (fora da campanha) -> venda na Minha Produção
import "dotenv/config";
import pg from "pg";

const TENANT = 12;
const USUARIO = 10;
const VENDEDOR_NOME = "Fabio Setubal";
const CAMPANHA = "Campanha Demonstração SIAPE";
const EQUIPE = "Equipe Demonstração";
const MARCA = "Cliente fictício (demonstração)";
const PARCEIRO = "Promotora Exemplo";

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const [t] = (await c.query(`SELECT id, name FROM tenants WHERE id = $1`, [TENANT])).rows;
if (!t || !/demo/i.test(t.name)) throw new Error(`Tenant ${TENANT} não é o Demo (achei: ${t?.name})`);

async function limpar() {
  await c.query(`DELETE FROM sales_campaigns WHERE tenant_id = $1 AND nome = $2`, [TENANT, CAMPANHA]); // leads/atribuições/interações em cascata
  await c.query(`DELETE FROM producoes_contratos WHERE tenant_id = $1 AND contrato_id LIKE 'DEMO-%'`, [TENANT]);
  await c.query(`DELETE FROM proposals WHERE tenant_id = $1 AND client_meta->>'demo' = 'true'`, [TENANT]);
  await c.query(`DELETE FROM appointments WHERE tenant_id = $1 AND payload->>'demo' = 'true'`, [TENANT]);
  await c.query(`DELETE FROM vendedor_contratos WHERE tenant_id = $1 AND observacoes = $2`, [TENANT, MARCA]);
  await c.query(`DELETE FROM minha_producao_parceiros WHERE tenant_id = $1 AND nome = $2`, [TENANT, PARCEIRO]);
  await c.query(`DELETE FROM commercial_teams WHERE tenant_id = $1 AND nome_equipe = $2`, [TENANT, EQUIPE]); // metas/membros em cascata
}

if (process.argv.includes("--limpar")) {
  await c.query("BEGIN");
  await limpar();
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
  return [...base, d1, (d2 + 1) % 10].join(""); // último dígito propositalmente inválido
}
const fmtCpf = (s) => `${s.slice(0, 3)}.${s.slice(3, 6)}.${s.slice(6, 9)}-${s.slice(9)}`;
const telDigitos = (i) => `0090000${String(1000 + i).slice(-4)}`;
const telFmt = (i) => `(00) 90000-${String(1000 + i).slice(-4)}`;
const dia = (iso, n) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
// Fim de semana vai para a segunda: o gráfico do painel só mostra dias úteis.
const diaUtil = (iso) => { let d = iso; while ([0, 6].includes(new Date(`${d}T12:00:00Z`).getUTCDay())) d = dia(d, 1); return d; };
const br = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const HOJE = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);

const LEADS = [
  "Ana Beatriz Moreira", "Carlos Eduardo Lima", "Juliana Ferreira Souza", "Roberto Alves Pinto",
  "Mariana Costa Ribeiro", "Paulo Henrique Duarte", "Fernanda Rocha Melo", "Ricardo Nogueira Dias",
  "Patrícia Gomes Teixeira", "Marcos Vinícius Araújo", "Luciana Barbosa Cardoso", "José Antônio Freitas",
  "Camila Martins Lopes", "Eduardo Santana Reis", "Renata Oliveira Campos", "Sérgio Monteiro Vieira",
  "Aline Cristina Rezende", "Gustavo Pereira Neves", "Débora Fonseca Lima", "Antônio Carlos Batista",
  "Simone Azevedo Prado", "Fábio Augusto Moura", "Cláudia Ramos Pacheco", "Rodrigo Tavares Brito",
  "Vanessa Cunha Machado", "Leonardo Siqueira Rocha", "Helena Marques Diniz", "Márcio Andrade Lacerda",
  "Tatiana Correia Sales", "Wagner Ribeiro Fontes",
];
// Clientes de carteira/indicação: compraram, mas não vieram da campanha.
const CARTEIRA = [
  "Rosângela Pires Matos", "Osvaldo Teixeira Brandão", "Elaine Cristina Vaz", "Raimundo Nonato Silva",
  "Sandra Regina Coelho", "Jorge Luiz Bittencourt", "Mônica Alves Furtado", "Benedito Carvalho Neto",
  "Ivone Sampaio Rangel", "Valdir Moreira Castro",
];
// Papel de cada lead (índice em LEADS), na ordem.
const PAPEL = [
  ...Array(5).fill("VENDIDO"), ...Array(7).fill("PROPOSTA_ENVIADA"), "SEM_INTERESSE",
  ...Array(4).fill("INTERESSADO"), ...Array(4).fill("AGUARDANDO_RETORNO"),
  ...Array(4).fill("EM_ATENDIMENTO"), ...Array(5).fill("NOVO"),
];
const FASES_EM_ANDAMENTO = [
  ["CADASTRADA", "NOVO"], ["DIGITADA", "NOVO"], ["PENDENTE_DIGITACAO", "PORTABILIDADE"],
  ["AGUARDANDO_ENVIO_CIP", "PORTABILIDADE"], ["AGUARDANDO_RETORNO_CIP", "PORTABILIDADE"],
  ["SALDO_INFORMADO_AGUARDANDO_CORRETOR", "PORTABILIDADE"], ["AGUARDANDO_FORMALIZACAO_CLIENTE", "NOVO"],
];
const UFS = ["DF", "GO", "SP", "RJ", "MG", "SC", "RS", "PR", "BA", "PE"];
const BANCOS = ["CAIXA", "BRB RED", "INTER", "SAFRA", "DIGIO", "PARANA"];

// Pessoas que viram contrato pago: 5 leads vendidos + 10 de carteira.
// Setembro: leads 3,4 + carteira 0..6. Outubro: leads 0,1,2 + carteira 7..9.
const VENDAS = [
  ...[3, 4].map((i, k) => ({ lead: i, mes: "2026-09", diaPag: 4 + k * 3 })),
  ...[0, 1, 2, 3, 4, 5, 6].map((i, k) => ({ carteira: i, mes: "2026-09", diaPag: 10 + k * 3 })),
  ...[0, 1, 2].map((i, k) => ({ lead: i, mes: "2026-10", diaPag: 1 + k * 3 })),
  ...[7, 8, 9].map((i, k) => ({ carteira: i, mes: "2026-10", diaPag: 2 + k * 3 })),
].map((v) => {
  const nome = v.lead !== undefined ? LEADS[v.lead] : CARTEIRA[v.carteira];
  const cpf = v.lead !== undefined ? cpfFalso(v.lead + 1) : cpfFalso(v.carteira + 101);
  const tel = v.lead !== undefined ? v.lead + 1 : v.carteira + 101;
  const tipo = pick(["NOVO", "NOVO", "PORTABILIDADE", "CARTAO"]);
  const valor = tipo === "CARTAO" ? entre(2500, 9000) : entre(9000, 52000);
  const perc = tipo === "CARTAO" ? 6 : 3;
  const dataPag = `${v.mes}-${String(v.diaPag).padStart(2, "0")}`;
  return { ...v, nome, cpf, tel, tipo, valor, perc, comissao: Math.round(valor * perc) / 100,
    // Venda 2 dias antes do pagamento, no mesmo mês (o painel e a Minha
    // Produção agrupam pela data da venda).
    banco: pick(BANCOS), dataPag, dataVenda: diaUtil(dia(dataPag, -Math.min(2, v.diaPag - 1))) };
});

await c.query("BEGIN");
try {
  // ── campanha + 30 leads atribuídos ao usuário ─────────────────────────────
  const [camp] = (await c.query(
    `INSERT INTO sales_campaigns (tenant_id, nome, descricao, convenio, status, total_leads, leads_disponiveis, leads_distribuidos, created_by)
     VALUES ($1, $2, 'Dados fictícios para gravação de tutoriais', 'SIAPE', 'ativa', $3, 0, $3, $4) RETURNING id`,
    [TENANT, CAMPANHA, LEADS.length, USUARIO])).rows;

  for (let i = 0; i < LEADS.length; i++) {
    const marcador = PAPEL[i];
    const venda = VENDAS.find((v) => v.lead === i);
    const margem = entre(180, 1400);
    const [lead] = (await c.query(
      `INSERT INTO sales_leads (tenant_id, campaign_id, cpf, nome, telefone_1, cidade, uf, lead_marker,
         current_margin, current_proposal, matricula, ultimo_contato_em, retorno_em, observacoes)
       VALUES ($1,$2,$3,$4,$5,'Cidade Exemplo',$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
      [TENANT, camp.id, cpfFalso(i + 1), LEADS[i], telDigitos(i + 1), pick(UFS), marcador,
        margem, venda ? venda.valor : Math.round(margem * 45), String(1000000 + i * 37),
        marcador === "NOVO" ? null : venda ? new Date(`${venda.dataVenda}T15:00:00Z`) : new Date(Date.now() - entre(1, 9) * 86400000),
        marcador === "AGUARDANDO_RETORNO" ? new Date(Date.now() + (i - 16) * 86400000) : null,
        MARCA])).rows;
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

  // ── propostas: pagas (= vendas dos leads), em andamento e uma cancelada ───
  const meta = (i) => JSON.stringify({ demo: true, uf: pick(UFS), telefone: telFmt(i + 1) });
  const proposta = async (i, status, produto, valor, banco, criadaEm, pagaEm) => (await c.query(
    `INSERT INTO proposals (tenant_id, client_name, client_cpf, client_matricula, client_convenio, bank, product,
       contract_value, installment_value, term, status, vendor_id, created_by, commission_status, client_meta, paid_at, created_at)
     VALUES ($1,$2,$3,$4,'SIAPE',$5,$6,$7,$8,$9,$10,$11,$11,'PENDENTE',$12,$13,$14) RETURNING id`,
    [TENANT, LEADS[i], fmtCpf(cpfFalso(i + 1)), String(1000000 + i * 37), banco, produto, valor,
      Math.round((valor / 42) * 100) / 100, produto === "CARTAO" ? 84 : 96, status, USUARIO, meta(i), pagaEm, criadaEm])).rows[0].id;

  for (const v of VENDAS.filter((x) => x.lead !== undefined)) {
    v.proposalId = await proposta(v.lead, "PAGO", v.tipo, v.valor, v.banco,
      new Date(`${v.dataVenda}T14:00:00Z`), new Date(`${v.dataPag}T14:00:00Z`));
  }
  for (let k = 0; k < FASES_EM_ANDAMENTO.length; k++) {
    const [status, produto] = FASES_EM_ANDAMENTO[k];
    await proposta(5 + k, status, produto, entre(9000, 45000), pick(BANCOS),
      new Date(Date.now() - (12 - k) * 86400000), null);
  }
  const valorCancelado = entre(9000, 30000);
  await proposta(12, "CANCELADA", "NOVO", valorCancelado, "SAFRA", new Date(Date.now() - 6 * 86400000), null);

  // ── produção: SÓ na Minha Produção ────────────────────────────────────────
  // O painel do vendedor SOMA produção oficial + Minha Produção. Pôr a mesma
  // venda nas duas contaria em dobro, então o Demo usa só a Minha Produção.
  // ── Minha Produção (controle do vendedor): as mesmas vendas ───────────────
  await c.query(`INSERT INTO minha_producao_parceiros (tenant_id, vendedor_id, nome) VALUES ($1, $2, $3)`,
    [TENANT, USUARIO, PARCEIRO]);
  // Comissão prevista 7 dias depois do pagamento do contrato. Já venceu =
  // recebida, menos UMA de setembro que ficou atrasada (para mostrar o alerta).
  // As que ainda vão vencer aparecem como "a receber".
  const atrasada = VENDAS.find((v) => v.mes === "2026-09" && v.carteira === 6);
  for (const v of VENDAS) {
    const previsto = dia(v.dataPag, 7);
    const recebido = v !== atrasada && previsto <= HOJE;
    await c.query(
      `INSERT INTO vendedor_contratos (tenant_id, vendedor_id, cliente_nome, cliente_cpf, banco, convenio, tipo_operacao,
         prazo, valor_contrato, data_contrato, status, observacoes, comissao_prevista, comissao_recebida,
         data_prevista_pagamento, data_recebimento, parceiro_nome, data_pagamento_contrato)
       VALUES ($1,$2,$3,$4,$5,'SIAPE',$6,$7,$8,$9,'vendida',$10,$11,$12,$13,$14,$15,$16)`,
      [TENANT, USUARIO, v.nome, v.cpf, v.banco, v.tipo, v.tipo === "CARTAO" ? 84 : 96, v.valor,
        new Date(`${v.dataVenda}T12:00:00Z`), MARCA, v.comissao, recebido ? v.comissao : null,
        previsto, recebido ? previsto : null, PARCEIRO, v.dataPag]);
  }
  // A proposta cancelada também aparece como venda cancelada (fora dos totais).
  await c.query(
    `INSERT INTO vendedor_contratos (tenant_id, vendedor_id, cliente_nome, cliente_cpf, banco, convenio, tipo_operacao,
       prazo, valor_contrato, data_contrato, status, observacoes, comissao_prevista, parceiro_nome)
     VALUES ($1,$2,$3,$4,'SAFRA','SIAPE','NOVO',96,$5,$6,'cancelada',$7,$8,$9)`,
    [TENANT, USUARIO, LEADS[12], cpfFalso(13), valorCancelado, new Date(Date.now() - 6 * 86400000), MARCA,
      Math.round(valorCancelado * 3) / 100, PARCEIRO]);

  // ── equipe + metas ────────────────────────────────────────────────────────
  const [eq] = (await c.query(
    `INSERT INTO commercial_teams (tenant_id, nome_equipe, descricao, coordenador_id, ativa, meta_mensal)
     VALUES ($1, $2, 'Equipe fictícia para gravação', $3, true, 300000) RETURNING id`, [TENANT, EQUIPE, USUARIO])).rows;
  await c.query(
    `INSERT INTO commercial_team_members (tenant_id, team_id, user_id, funcao_equipe, ativo) VALUES ($1, $2, $3, 'vendedor', true)`,
    [TENANT, eq.id, USUARIO]);
  for (const mes of ["2026-09", "2026-10"]) {
    await c.query(`INSERT INTO metas_equipe (tenant_id, equipe_id, mes_referencia, meta_geral, meta_cartao, tipo_meta)
                   VALUES ($1, $2, $3, 300000, 30000, 'producao')`, [TENANT, eq.id, mes]);
    // Sem meta individual do gestor de propósito: com ela, o botão "Definir
    // minha meta" some da Minha Produção (a do gestor manda) e não dá para gravar.
  }

  // ── agenda: retorno de cada lead "aguardando retorno" ─────────────────────
  for (let i = 0; i < LEADS.length; i++) {
    if (PAPEL[i] !== "AGUARDANDO_RETORNO") continue;
    await c.query(
      `INSERT INTO appointments (tenant_id, user_id, client_cpf, client_name, title, notes, scheduled_for, status, kind, payload)
       VALUES ($1, $2, $3, $4, $5, 'Retorno combinado no último contato', NOW() + ($6 || ' days')::interval, 'open', 'client_followup', '{"demo":true}')`,
      [TENANT, USUARIO, cpfFalso(i + 1), LEADS[i], `Retornar para ${LEADS[i].split(" ")[0]}`, String(i - 16)]);
  }

  await c.query("COMMIT");
  const set = VENDAS.filter((v) => v.mes === "2026-09"), out = VENDAS.filter((v) => v.mes === "2026-10");
  const soma = (a) => a.reduce((s, v) => s + v.valor, 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  console.log(`Demo criado: ${LEADS.length} leads, ${5 + FASES_EM_ANDAMENTO.length + 1} propostas,`);
  console.log(`  Minha Produção set/26: ${set.length} contratos ${soma(set)} | out/26: ${out.length} contratos ${soma(out)}`);
  console.log(`  + 1 venda cancelada (fora dos totais); agenda: 4 retornos`);
} catch (e) {
  await c.query("ROLLBACK");
  throw e;
} finally {
  await c.end();
}
