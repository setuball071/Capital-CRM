// A sugestão "Tabela N rende mais" da Viabilidade Inter, conferida contra o
// próprio motor da página: as funções são lidas de public/viabilidade-inter.html,
// então se alguém mudar a conta lá, este teste acusa.
//
// O que se prova aqui:
//   1. a tabela sugerida cai mesmo na faixa de comissionamento mais alta;
//   2. ela é a MENOR que chega nessa faixa (a de maior troco dentro dela);
//   3. a ponderada nunca passa do máximo do convênio;
//   4. subir a tabela SEMPRE reduz o troco do cliente — o preço da comissão.
//
// Rodar:  npx tsx scripts/testar-rentavel-inter.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const html = readFileSync(new URL("../public/viabilidade-inter.html", import.meta.url), "utf8");

// Em vez de caçar função por função, pega o trecho inteiro do motor até o
// primeiro manipulador de tela: é tudo declaração, não toca no DOM ao carregar.
const inicio = html.indexOf("function days360");
const fim = html.indexOf("function aplicarTabela(");
if (inicio < 0 || fim < 0) throw new Error("não achei o trecho do motor na Viabilidade Inter");

const sandbox: any = { console, out: {} };
vm.runInNewContext(
  html.slice(inicio, fim) +
  `
out.motorInter = motorInter; out.tabelaMaisRentavel = tabelaMaisRentavel;
   out.menorTabelaQueAtinge = menorTabelaQueAtinge; out.taxaDaTabela = taxaDaTabela;
   out.comissaoDaFaixa = comissaoDaFaixa; out.TABELAS_REFIN = TABELAS_REFIN;`,
  sandbox,
);
const P = sandbox.out;

// Grade do SIAPE sem seguro, como regraAtual() monta: taxa mínima de cada faixa.
const GRADE = [
  { taxa: 1.63, tabela: "Tabela 1" }, { taxa: 1.65, tabela: "Tabela 2" },
  { taxa: 1.66, tabela: "Tabela 3" }, { taxa: 1.67, tabela: "Tabela 4" },
  { taxa: 1.68, tabela: "Tabela 5" }, { taxa: 1.69, tabela: "Tabela 6" },
];
const REGRA = { min: 1.63, max: 1.8, grade: GRADE };
const ctxDe = (prazoRefin: number) => ({
  regra: REGRA, prazoRefin,
  dataContrato: new Date("2026-09-25T00:00:00"),
  primeiroVenc: new Date("2026-10-12T00:00:00"),
});
let CTX = ctxDe(96);

// Os contratos do print do Fábio (25/09/2026).
const LINHAS = [
  { nome: "93,08 · 117/120", saldo: 4909.32, parcela: 93.08, novaParcela: 93.08, restantes: 117 },
  { nome: "431,18 · 90/93", saldo: 20490.65, parcela: 431.18, novaParcela: 431.18, restantes: 90 },
  { nome: "451,81 · 89/92", saldo: 21362.76, parcela: 451.81, novaParcela: 451.81, restantes: 89 },
  { nome: "195,19 · 81/96", saldo: 8160.57, parcela: 195.19, novaParcela: 195.19, restantes: 81 },
];

const arred = (tp: number) => Math.round(tp * 100 * 100) / 100;
const pond = (l: any, n: number) => {
  const r = P.motorInter({
    saldoPortado: l.saldo, prazoRemanescente: l.restantes, parcelaAtual: l.parcela,
    novaParcela: l.novaParcela, prazoRefin: CTX.prazoRefin,
    taxaRefinMes: P.taxaDaTabela(n) / 100,
    dataContrato: CTX.dataContrato, primeiroVenc: CTX.primeiroVenc,
  });
  return r ? { pond: arred(r.taxaPonderada), troco: r.troco } : null;
};

let ok = 0, falhas = 0;
function caso(nome: string, fn: () => void) {
  try { fn(); ok++; console.log("  ok   " + nome); }
  catch (e: any) { falhas++; console.log("  FALHA " + nome + "\n        " + String(e.message).split("\n")[0]); }
}

console.log("\nTabela mais rentável — Viabilidade Inter (SIAPE)");

for (const prazoRefin of [96, 120]) {
CTX = ctxDe(prazoRefin);
console.log(`\n  prazo do refin: ${prazoRefin} meses`);
for (const l of LINHAS) {
  // o refin tem que ser mais longo que o que falta do contrato atual
  if (l.restantes >= prazoRefin) continue;
  const r = P.tabelaMaisRentavel(l, CTX);

  caso(`${l.nome}: encontra sugestão`, () => {
    assert.ok(r, "nenhuma tabela alcançou faixa nenhuma");
  });
  if (!r) continue;

  caso(`${l.nome}: cai na faixa que diz (${r.faixa})`, () => {
    const faixa = GRADE.find(g => g.tabela === r.faixa)!;
    const p = pond(l, r.tabela)!;
    assert.ok(p.pond >= faixa.taxa, `ponderada ${p.pond} < ${faixa.taxa}`);
    const acima = GRADE.filter(g => g.taxa > faixa.taxa);
    // se disse que é a faixa X, nenhuma faixa acima podia ser alcançada
    for (const g of acima) {
      const topo = pond(l, P.TABELAS_REFIN.length)!;
      assert.ok(topo.pond < g.taxa || P.menorTabelaQueAtinge(l, CTX, g.taxa) === null,
        `${g.tabela} era alcançável e foi ignorada`);
    }
  });

  caso(`${l.nome}: é a MENOR tabela dessa faixa`, () => {
    if (r.tabela <= 1) return;
    const faixa = GRADE.find(g => g.tabela === r.faixa)!;
    const anterior = pond(l, r.tabela - 1)!;
    assert.ok(anterior.pond < faixa.taxa,
      `tabela ${r.tabela - 1} já atingia ${faixa.taxa} (ponderada ${anterior.pond})`);
  });

  caso(`${l.nome}: ponderada dentro do máximo (${REGRA.max}%)`, () => {
    assert.ok(arred(r.taxaPonderada) <= REGRA.max, `ponderada ${arred(r.taxaPonderada)} passou do teto`);
  });

  caso(`${l.nome}: troco cai em relação à tabela que só aprova`, () => {
    const aprova = P.menorTabelaQueAtinge(l, CTX, REGRA.min);
    assert.ok(aprova, "nem a tabela mínima aprovava");
    assert.ok(r.tabela >= aprova.tabela, "a mais rentável não pode ser menor que a que aprova");
    assert.ok(r.troco <= aprova.troco + 1e-9,
      `troco subiu ao trocar de tabela (${aprova.troco} → ${r.troco})`);
  });

  caso(`${l.nome}: comissão da faixa sugerida é a maior possível`, () => {
    const nova = P.comissaoDaFaixa(r.faixa, l.saldo);
    const aprova = P.menorTabelaQueAtinge(l, CTX, REGRA.min)!;
    // a faixa da tabela que só aprova
    let faixaAprova = "";
    for (const g of GRADE) if (arred(aprova.taxaPonderada) >= g.taxa) faixaAprova = g.tabela;
    const antes = P.comissaoDaFaixa(faixaAprova, l.saldo);
    assert.ok(nova, "faixa sem comissão cadastrada");
    assert.ok(nova.pct >= antes.pct, `comissão caiu: ${antes.pct} → ${nova.pct}`);
  });
}
}
CTX = ctxDe(96);

// Monotonicidade: é a premissa da bisseção. Se quebrar, a busca inteira mente.
caso("ponderada sobe junto com a tabela de refin, nas 31 tabelas", () => {
  for (const l of LINHAS) {
    if (l.restantes >= CTX.prazoRefin) continue;
    let anterior = -Infinity;
    for (let n = 1; n <= P.TABELAS_REFIN.length; n++) {
      const p = pond(l, n);
      if (!p) continue;
      assert.ok(p.pond >= anterior, `${l.nome}: tabela ${n} baixou a ponderada (${anterior} → ${p.pond})`);
      anterior = p.pond;
    }
  }
});

caso("troco do cliente cai quando a tabela de refin sobe", () => {
  for (const l of LINHAS) {
    if (l.restantes >= CTX.prazoRefin) continue;
    let anterior = Infinity;
    for (let n = 1; n <= P.TABELAS_REFIN.length; n++) {
      const p = pond(l, n);
      if (!p) continue;
      assert.ok(p.troco <= anterior + 1e-9, `${l.nome}: tabela ${n} aumentou o troco`);
      anterior = p.troco;
    }
  }
});

console.log(`\n${ok} ok, ${falhas} falha(s)\n`);
process.exit(falhas ? 1 : 0);
