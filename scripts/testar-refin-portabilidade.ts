// Troco e parcela do refin (shared/portability/refin.ts) contra o SIMULADOR ANTIGO.
// As funções de conta do antigo (mkPrice, calcIOF, trocoBrutoDeLiquido) são lidas
// do próprio public/ferramentas-portabilidade.html — se alguém mudar a conta lá,
// este teste acusa. Rodar:  npx tsx scripts/testar-refin-portabilidade.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { precificarRefin, normalizarOperacao, fatorPrice } from "../shared/portability/refin";
import { analisarBanco, type BancoParaAnalise, type ContratoEntrada, type Excecao } from "../shared/portability/engine";
import { MODELOS } from "../shared/portability/modelos";

const html = readFileSync(new URL("../public/ferramentas-portabilidade.html", import.meta.url), "utf8");
const pega = (re: RegExp, nome: string) => { const m = html.match(re); if (!m) throw new Error("não achei " + nome + " no simulador antigo"); return m[0]; };
const antigo: any = {};
vm.runInNewContext([
  pega(/const IOF_RATE = [\d.]+;/, "IOF_RATE"),
  pega(/function calcIOF\(trocoBruto\) \{[\s\S]*?\n\}/, "calcIOF"),
  pega(/function trocoBrutoDeLiquido\(trocoLiquido\) \{[\s\S]*?\n\}/, "trocoBrutoDeLiquido"),
  pega(/function mkPrice\(taxa, prazo\) \{[\s\S]*?\n\}/, "mkPrice"),
  "out.calcIOF = calcIOF; out.trocoBrutoDeLiquido = trocoBrutoDeLiquido; out.mkPrice = mkPrice;",
].join("\n"), { out: antigo });

/** Modo "Separado" do antigo, linha por linha (sem seguro), com o prazo como parâmetro. */
function antigoSeparado(cs: { saldo: number; parcela: number }[], taxaPct: number, prazo: number, modo: "parcela" | "troco", valores: number[] | number) {
  const price = antigo.mkPrice(taxaPct / 100, prazo);
  const total = cs.reduce((a, c) => a + c.saldo, 0);
  return cs.map((c, i) => {
    if (modo === "troco") {
      const trocoLiquido = (valores as number[])[i];
      const trocoBruto = antigo.trocoBrutoDeLiquido(trocoLiquido);
      return { trocoBruto, iof: antigo.calcIOF(trocoBruto), trocoLiquido, parcela: price.pmt(c.saldo + trocoBruto) };
    }
    const parcelaProp = (valores as number) * (c.saldo / total);
    const trocoBruto = price.pv(parcelaProp) - c.saldo;
    const iof = antigo.calcIOF(trocoBruto);
    return { trocoBruto, iof, trocoLiquido: trocoBruto - iof, parcela: parcelaProp };
  });
}

let ok = 0, falhas = 0;
function caso(nome: string, fn: () => void) {
  try { fn(); ok++; console.log("  ok   " + nome); }
  catch (e: any) { falhas++; console.log("  FALHA " + nome + "\n        " + e.message.split("\n")[0]); }
}
const igual = (a: number, b: number, o: string) => assert.ok(Math.abs(a - b) < 1e-9, `${o}: ${a} ≠ ${b}`);

const CS = [{ id: "a", saldo: 13333.14, parcela: 320.5 }, { id: "b", saldo: 9358.59, parcela: 250 }, { id: "c", saldo: 21000, parcela: 610 }];

console.log("\nIdêntico ao simulador antigo");
for (const prazo of [120, 96, 84]) {
  caso(`reduzir a parcela = troco mínimo (R$ 50) em cada contrato, ${prazo} meses`, () => {
    const velho = antigoSeparado(CS, 1.70, prazo, "troco", CS.map(() => 50));
    const novo = precificarRefin(CS, 1.70, 50, { modo: "parcela", prazo }).linhas;
    novo.forEach((l, i) => {
      igual(l.trocoBruto, velho[i].trocoBruto, "troco bruto"); igual(l.iof, velho[i].iof, "IOF");
      igual(l.trocoLiquido, velho[i].trocoLiquido, "troco líquido"); igual(l.parcelaNova, velho[i].parcela, "parcela");
      assert.ok(l.viavel, l.motivo);
    });
  });
  caso(`troco desejado, ${prazo} meses`, () => {
    const total = 6000;
    const porSaldo = CS.map(c => total * c.saldo / CS.reduce((a, x) => a + x.saldo, 0));
    const velho = antigoSeparado(CS, 1.70, prazo, "troco", porSaldo);
    const novo = precificarRefin(CS, 1.70, 0, { modo: "troco", prazo, valor: total }).linhas;
    novo.forEach((l, i) => { igual(l.trocoBruto, velho[i].trocoBruto, "troco bruto"); igual(l.parcelaNova, velho[i].parcela, "parcela"); });
  });
}
caso("liberar o máximo = parcela desejada igual à parcela atual (contrato sozinho)", () => {
  const c = CS[0];
  const velho = antigoSeparado([c], 1.70, 96, "parcela", c.parcela)[0];
  const novo = precificarRefin([c], 1.70, 0, { modo: "maximo", prazo: 96 }).linhas[0];
  igual(novo.trocoLiquido, velho.trocoLiquido, "troco líquido"); igual(novo.parcelaNova, c.parcela, "parcela mantida");
});

console.log("\nRegras da operação");
caso("valor do contrato = saldo + troco bruto; líquido = bruto ÷ 1,032", () => {
  const l = precificarRefin([CS[0]], 1.70, 0, { modo: "maximo", prazo: 120 }).linhas[0];
  igual(l.valorContrato, l.saldo + l.trocoBruto, "contrato"); igual(l.trocoLiquido, l.trocoBruto / 1.032, "líquido");
});
caso("prazo curto que não cobre o saldo: sem troco, não viável", () => {
  const l = precificarRefin([CS[0]], 1.70, 50, { modo: "maximo", prazo: 24 }).linhas[0];
  assert.equal(l.viavel, false); assert.equal(l.trocoLiquido, 0); assert.match(l.motivo, /Sem troco em 24 meses/);
});
caso("troco abaixo do mínimo do banco: não viável", () => {
  const l = precificarRefin([CS[0]], 1.70, 50, { modo: "troco", prazo: 120, valor: 30 }).linhas[0];
  assert.equal(l.viavel, false); assert.match(l.motivo, /abaixo do mínimo de R\$ 50,00/);
});
caso("parcela nova maior que a atual: não viável", () => {
  const l = precificarRefin([CS[0]], 1.70, 50, { modo: "troco", prazo: 120, valor: 20000 }).linhas[0];
  assert.equal(l.viavel, false); assert.match(l.motivo, /parcela nova maior que a atual/);
});
caso("totais somam só os viáveis", () => {
  const r = precificarRefin(CS, 1.70, 50, { modo: "maximo", prazo: 120 });
  const ok = r.linhas.filter(l => l.viavel);
  igual(r.resumo.trocoLiquido, ok.reduce((a, l) => a + l.trocoLiquido, 0), "troco total");
  assert.equal(r.resumo.contratos, ok.length);
});
caso("operação da tela: modo inválido vira máximo; prazo fora de 1..240 ou troco sem valor = nada", () => {
  assert.deepEqual(normalizarOperacao({ modo: "x", prazo: "96" }), { modo: "maximo", prazo: 96, valor: null });
  assert.equal(normalizarOperacao({ modo: "maximo", prazo: 0 }), null);
  assert.deepEqual(normalizarOperacao({ modo: "parcela", prazo: 96 }), { modo: "parcela", prazo: 96, valor: null });
  assert.equal(normalizarOperacao({ modo: "troco", prazo: 96 }), null);
  assert.equal(normalizarOperacao(null), null);
});

caso("reduzir a parcela: parcela cai e o troco é exatamente o mínimo", () => {
  const l = precificarRefin([CS[0]], 1.70, 50, { modo: "parcela", prazo: 120 }).linhas[0];
  assert.ok(l.parcelaNova < l.parcelaAtual); igual(Math.round(l.trocoLiquido * 1e6) / 1e6, 50, "troco = mínimo"); assert.ok(l.viavel);
});
caso("reduzir a parcela em banco sem troco mínimo: portabilidade pura, troco zero", () => {
  const l = precificarRefin([CS[0]], 1.70, 0, { modo: "parcela", prazo: 120 }).linhas[0];
  assert.equal(l.trocoLiquido, 0); assert.ok(l.viavel); igual(l.parcelaNova, CS[0].saldo * fatorPrice(0.017, 120), "parcela = Price do saldo");
});

console.log("\nNo motor (PAN)");
const PAN = MODELOS.find(m => m.id === "pan-siape-2026-09")!;
const EXC: Excecao[] = PAN.excecoesSugeridas!.map((e, i) => ({ id: 100 + i, tipo: "origem_pagas", parametros: e.parametros, motivo: e.motivo }));
const B: BancoParaAnalise = { bankId: 1, nome: "PAN", ruleSet: { id: 1, hash: "h", vigenciaInicio: "2026-09-18", regras: PAN.regras }, excecoes: EXC };
const CLI = { convenio: "SIAPE", situacaoFuncional: "1" };
const HOJE = new Date(2026, 8, 18);
const ct = (p: Partial<ContratoEntrada>): ContratoEntrada =>
  ({ id: "x", bancoOrigem: "Bradesco", prazoTotal: 96, prazoRestante: 60, taxa: 1.5, saldo: 20000, parcela: 520, ...p });
caso("contrato aceito ganha troco na taxa do PAN (1,70%) e no prazo escolhido", () => {
  const r = analisarBanco(B, CLI, [ct({ id: "a" })], HOJE, { modo: "maximo", prazo: 96 });
  const esperado = precificarRefin([{ id: "a", saldo: 20000, parcela: 520 }], 1.70, 50, { modo: "maximo", prazo: 96 }).linhas[0];
  assert.deepEqual(r.contratos[0].preco, esperado);
  assert.equal(r.refin!.taxa, 1.70); assert.equal(r.refin!.prazo, 96);
  assert.equal(r.contratos[0].operacao.find(o => o.chave === "troco")!.status, "ELEGIVEL");
});
caso("contrato recusado não é precificado nem entra no total", () => {
  const r = analisarBanco(B, CLI, [ct({ id: "a" }), ct({ id: "b", bancoOrigem: "Agibank" })], HOJE, { modo: "maximo", prazo: 120 });
  assert.equal(r.contratos[1].preco, undefined);
  assert.equal(r.refin!.contratos, 1);
});
caso("sem prazo informado: troco não calculado, sem inventar valor", () => {
  const r = analisarBanco(B, CLI, [ct({})], HOJE, null);
  assert.equal(r.refin, null);
  assert.equal(r.contratos[0].operacao.find(o => o.chave === "troco")!.valorAnalisado, null);
});
caso("sem parcela atual: troco pendente", () => {
  const r = analisarBanco(B, CLI, [ct({ parcela: null })], HOJE, { modo: "maximo", prazo: 120 });
  assert.equal(r.contratos[0].operacao.find(o => o.chave === "troco")!.status, "PENDENTE_INFO");
});
caso("banco sem taxa de refin cadastrada: não calcula com taxa de outro", () => {
  const r = analisarBanco({ ...B, ruleSet: { ...B.ruleSet!, regras: { ...PAN.regras, taxaRefin: null } } }, CLI, [ct({})], HOJE, { modo: "maximo", prazo: 120 });
  assert.equal(r.refin, null);
  assert.match(r.contratos[0].operacao.find(o => o.chave === "troco")!.motivo, /taxa de refin do PAN não está cadastrada/);
});
caso("contrato tirado do cálculo: segue elegível, mas fica fora de troco, bruto e comissão", () => {
  const todos = analisarBanco(B, CLI, [ct({ id: "a" }), ct({ id: "b", saldo: 10000, parcela: 300 })], HOJE, { modo: "maximo", prazo: 120 });
  const semB = analisarBanco(B, CLI, [ct({ id: "a" }), ct({ id: "b", saldo: 10000, parcela: 300, foraDoCalculo: true })], HOJE, { modo: "maximo", prazo: 120 });
  const b = semB.contratos[1];
  assert.equal(b.status, "ELEGIVEL"); assert.equal(b.foraDoCalculo, true); assert.equal(b.preco, undefined);
  assert.equal(semB.refin!.contratos, 1);
  igual(semB.refin!.valorContrato, todos.contratos[0].preco!.valorContrato, "bruto só do contrato a");
  igual(semB.comissao!.total, 20000 * 0.0075, "comissão só do contrato a");
  assert.equal(semB.comissao!.contratos, 1);
});
caso("troco desejado se divide só entre os contratos que ficaram no cálculo", () => {
  const r = analisarBanco(B, CLI, [ct({ id: "a" }), ct({ id: "b", foraDoCalculo: true })], HOJE, { modo: "troco", prazo: 120, valor: 1000 });
  igual(r.contratos[0].preco!.trocoLiquido, 1000, "todo o troco no contrato a");
});

console.log(`\n${ok} ok, ${falhas} falha(s)`);
if (falhas) process.exit(1);
