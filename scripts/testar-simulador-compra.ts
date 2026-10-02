// Confere o simulador de compra contra a planilha do Fábio (print de 22/09/2026).
// Rodar:  npx tsx scripts/testar-simulador-compra.ts
import assert from "node:assert/strict";
import { calcularCompra, TABELAS_PLANILHA } from "../shared/compra/calculo";

// [bruto, liberado, comissão] exatamente como a planilha mostra, na ordem dela
const PLANILHA = [
  [5837.73, 2395.67, 1634.56], [6105.23, 2663.17, 1526.31], [6395.63, 2953.57, 1407.04],
  [6711.58, 3269.52, 1073.85], [7056.12, 3614.06, 917.30], [7432.71, 3990.65, 520.29],
  [7634.24, 4192.18, 305.37], [7845.30, 4403.24, 156.91],
  [7598.32, 4156.26, 151.97], [6677.53, 3235.47, 480.78], [6926.74, 3484.68, 498.73],
  [5145.20, 1703.14, 1749.37], [6046.53, 2604.47, 1330.24], [5626.20, 2184.14, 1575.33],
  [4988.13, 1546.07, 1895.49],
];
const r2 = (v: number) => Math.round(v * 100) / 100;
let ok = 0, falhas = 0;
function caso(nome: string, fn: () => void) {
  try { fn(); ok++; console.log("  ok   " + nome); }
  catch (e: any) { falhas++; console.log("  FALHA " + nome + "\n        " + e.message.split("\n")[0]); }
}

const tabs = TABELAS_PLANILHA.map((t, i) => ({ ...t, id: i }));
// a planilha foi feita com margem TOTAL de 250: parcela 154,36 + 95,64 de extra
const r = calcularCompra({ parcela: 154.36, fator: 23, saldoReal: 3442.06, margemExtra: 95.64 }, tabs);
PLANILHA.forEach(([bruto, lib, cms], i) => {
  const t = tabs[i];
  caso(`${t.banco} ${t.percentual}% bate com a planilha`, () => {
    const l = r.linhas[i];
    assert.equal(r2(l.bruto), bruto, "bruto");
    assert.equal(r2(l.liberado), lib, "liberado");
    assert.equal(r2(l.comissao!), cms, "comissão");
  });
});

caso("Saldo real informado manda", () => { assert.equal(r.saldo, 3442.06); assert.equal(r.saldoEstimado, false); });
caso("Sem saldo real: parcela × fator, marcado como estimado", () => {
  const e = calcularCompra({ parcela: 154.36, fator: 23, saldoReal: 0, margemExtra: 95.64 }, tabs);
  assert.equal(r2(e.saldo), 3550.28); assert.equal(e.saldoEstimado, true);
});
caso("Sem extra: usa só a parcela", () => {
  const e = calcularCompra({ parcela: 154.36, fator: 23, saldoReal: 0, margemExtra: 0 }, tabs);
  assert.equal(e.margemUsada, 154.36); assert.equal(e.extraUsada, 0);
});
caso("Corretor (sem percentual): comissão nula, bruto e liberado iguais", () => {
  const e = calcularCompra({ parcela: 154.36, fator: 23, saldoReal: 3442.06, margemExtra: 95.64 }, tabs.map(({ percentual, ...t }) => t));
  assert.ok(e.linhas.every(l => l.comissao === null));
  assert.equal(r2(e.linhas[0].liberado), 2395.67);
});
caso("Sem parcela e sem extra: nenhuma linha", () =>
  assert.equal(calcularCompra({ parcela: 0, fator: 23, saldoReal: 0, margemExtra: 0 }, tabs).linhas.length, 0));

caso("A margem extra SOMA com a parcela, não substitui", () => {
  const e = calcularCompra({ parcela: 154.36, fator: 23, saldoReal: 0, margemExtra: 250 }, tabs);
  assert.equal(r2(e.margemUsada), 404.36);
  assert.equal(e.extraUsada, 250);
  // o bruto acompanha a soma: margem ÷ coeficiente
  assert.equal(r2(e.linhas[0].bruto), r2(404.36 / tabs[0].coeficiente));
});

caso("Só a extra, sem parcela na folha", () => {
  const e = calcularCompra({ parcela: 0, fator: 23, saldoReal: 0, margemExtra: 250 }, tabs);
  assert.equal(e.margemUsada, 250); assert.equal(e.saldo, 0);
});

console.log(`\n${ok} ok, ${falhas} falha(s)`);
if (falhas) process.exit(1);
