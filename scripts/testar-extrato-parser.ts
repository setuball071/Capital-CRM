// Leitura do extrato de consignações (public/extrato-parser.js), contra os dois
// defeitos que apareceram no extrato de 12/10/2026:
//
//   1. página PAISAGEM (rotate 90): a linha visual é o X, não o Y. Agrupando por
//      Y um contrato sumia da lista (era o Inbursa);
//   2. bloco das utilizadas com o rótulo "Total Facultativas / Total Cartão /
//      Total Cartão de Benefício": a margem saía nula e a tela não avisava que
//      estava NEGATIVA.
//
// Os dados aqui são inventados, com o MESMO layout do extrato real — nada de
// cliente de verdade entra no repositório.
//
// Rodar:  npx tsx scripts/testar-extrato-parser.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const js = readFileSync(new URL("../public/extrato-parser.js", import.meta.url), "utf8");
const sandbox: any = { console };
vm.runInNewContext(js + "\nthis.extrairContratos = extrairContratos; this.extrairMargemENome = extrairMargemENome;", sandbox);
const { extrairContratos, extrairMargemENome } = sandbox;

interface Item { str: string; x: number; y: number }

/**
 * Monta os itens como o pdf.js entrega.
 * Em paisagem (rotate 90) os eixos vêm trocados: a linha visual é o X e as
 * colunas correm pelo Y — é exatamente aí que o parser errava.
 */
function itensDe(linhas: string[][], paisagem: boolean): Item[] {
  const itens: Item[] = [];
  linhas.forEach((celulas, l) => {
    celulas.forEach((texto, c) => {
      const linhaPos = 100 + l * 14;      // uma linha a cada 14 pontos
      const colunaPos = 40 + c * 90;
      itens.push(paisagem
        ? { str: texto, x: linhaPos, y: colunaPos }
        : { str: texto, x: colunaPos, y: 900 - linhaPos });
    });
  });
  // Ordem de entrega: o pdf.js percorre o conteúdo na ordem do arquivo, que num
  // extrato paisagem sai COLUNA a COLUNA. É isso que desmonta a leitura antiga
  // e some com um contrato — sem essa ordem o teste não pega o defeito.
  return paisagem ? itens.sort((a, b) => a.y - b.y || a.x - b.x) : itens;
}

const LINHAS: string[][] = [
  ["Extrato de Consignações Vigentes"],
  ["Órgão", "CPF", "Matrícula", "Nome"],
  ["40806 - DEP.DE CENTRAL.SERV.DE INATIVOS E PENS.", "000.000.000-00", "1071670/2185628", "FULANO DE TAL DA SILVA"],
  ["Bruta Compulsória", "Líquida Compulsória", "Bruta Facultativa", "Líquida Facultativa",
   "Bruta Cartão", "Líquida Cartão", "Bruta Cartão Benefício", "Líquida Cartão Benefício"],
  ["R$ 13.759,19", "R$ 1.357,25", "R$ 6.879,59", "R$ 0,00", "R$ 982,79", "R$ 982,79", "R$ 982,79", "R$ 212,19"],
  ["Total Facultativas", "Total Cartão", "Total Cartão de Benefício"],
  ["R$ 7.075,49", "R$ 0,00", "R$ 770,60"],
  ["Demonstrativo de uso da margem / Novo Contrato e Renovação"],
  ["211876771", "34116 - EMPREST BCO OFICIAL - BCO BRAS", "3", "10", "22/05/2026 11:49:34", "005/120", "R$ 5.672,86", "06/2026", "05/2036"],
  ["212206594", "34116 - EMPREST BCO OFICIAL - BCO BRAS", "4", "10", "28/05/2026 10:19:11", "004/120", "R$ 72,15", "07/2026", "06/2036"],
  // número longo e com ponto no fim, como o do Inbursa
  ["202109091002161.", "34943 - EMPREST BCO PRIVADOS - INBURSA", "2", "10", "15/10/2021 15:38:14", "60/96", "R$ 49,28", "11/2021", "10/2029"],
  ["4000040231781", "34919 - EMPREST BCO PRIVADOS - DIGIO", "3", "10", "31/07/2026 10:35:44", "003/120", "R$ 325,00", "08/2026", "07/2036"],
  ["901371258791", "34935 - EMPREST BCO PRIVADOS - C6 - CONSIG", "1", "10", "28/08/2024 16:02:33", "26/96", "R$ 50,00", "09/2024", "08/2032"],
  ["Demonstrativo de uso da margem - Cartão Consignado de Benefício"],
  // cartão NÃO é empréstimo: não pode entrar na lista
  ["7001192733", "35016 - AMORT CARTAO BENEFICIO - LECCA", "1", "13", "08/01/2024 11:35:16", "34/96", "R$ 325,48", "01/2024", "12/2031"],
];


let ok = 0, falhas = 0;
function caso(nome: string, fn: () => void) {
  try { fn(); ok++; console.log("  ok   " + nome); }
  catch (e: any) { falhas++; console.log("  FALHA " + nome + "\n        " + String(e.message).split("\n")[0]); }
}

for (const [rotulo, paisagem, rotate] of [["paisagem (rotate 90)", true, 90], ["retrato (rotate 0)", false, 0]] as [string, boolean, number][]) {
  console.log("\n" + rotulo);
  const itens = itensDe(LINHAS, paisagem);
  // a tela monta o texto assim: um pedaço por linha, na ordem do pdf.js
  const texto = itens.map(i => i.str).join("\n");
  const contratos = extrairContratos(texto, itens, rotate);
  const info = extrairMargemENome(texto, itens, rotate);

  caso("acha os 5 empréstimos", () => assert.equal(contratos.length, 5));

  caso("o contrato de número longo com ponto entra (foi o Inbursa que sumia)", () => {
    const inb = contratos.find((c: any) => c.banco === "Inbursa");
    assert.ok(inb, "Inbursa não veio na lista");
    assert.equal(inb.parcela, 49.28);
    assert.equal(inb.prazo_total, 96);
    assert.equal(inb.prazo, 36);       // 96 − 60 pagas
  });

  caso("cartão benefício fica de fora", () =>
    assert.ok(!contratos.some((c: any) => c.banco === "Lecca"), "cartão entrou como empréstimo"));

  caso("lê a margem do bloco \"Total Facultativas\"", () => {
    assert.equal(info.brutaFacult, 6879.59);
    assert.equal(info.utilFacult, 7075.49);
  });

  caso("acusa margem NEGATIVA", () => {
    assert.ok(info.margem !== null, "margem veio nula — a tela não avisaria nada");
    assert.ok(Math.abs(info.margem - -195.9) < 0.01, `margem ${info.margem}, esperado −195,90`);
  });

  caso("cartão e benefício têm margem própria", () => {
    assert.ok(Math.abs(info.margemCartao - 982.79) < 0.01);
    assert.ok(Math.abs(info.margemCartaoBenef - 212.19) < 0.01);
  });

  caso("pega o nome mesmo com matrícula com barra", () =>
    assert.equal(info.nome, "FULANO DE TAL DA SILVA"));
}

console.log(`\n${ok} ok, ${falhas} falha(s)\n`);
process.exit(falhas ? 1 : 0);
