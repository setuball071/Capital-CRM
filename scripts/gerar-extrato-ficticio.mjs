// Gera um extrato de consignações SIAPE FICTÍCIO para testes do simulador.
// Nenhum dado real: CPF, nome e contratos são inventados.
//
//   node scripts/gerar-extrato-ficticio.mjs
//
// As linhas seguem o formato que public/extrato-parser.js lê (contrato, rubrica
// de 5 dígitos, sequência, prioridade, data, N/N parcelas, R$ valor). O script
// confere o resultado com o próprio parser antes de gravar.
import { jsPDF } from "jspdf";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SAIDA = path.join(RAIZ, "tests", "fixtures", "extrato-consignacao-ficticio.pdf");

const LINHAS = [
  "EXTRATO DE CONSIGNACOES - DOCUMENTO FICTICIO PARA TESTES",
  "CPF MATRICULA NOME",
  "123.456.789-09 9999999 MARIA FICTICIA DE TESTE",
  "Bruta Comp. Liquida Comp. Bruta Facult. Global Liquida Facult. Global Bruta Cartao Liquida Cartao Bruta Cartao Benef. Liquida Cartao Benef.",
  "R$ 7.000,00 R$ 3.500,00 R$ 3.500,00 R$ 800,00 R$ 500,00 R$ 500,00 R$ 500,00 R$ 500,00",
  "Utilizada Facultativa Utilizada Cartao Utilizada Cartao Beneficio",
  "R$ 2.700,00 R$ 0,00 R$ 0,00",
  "Contrato Rubrica Seq Prior Inicio Parcela Valor",
  // Caixa com 2 pagas: o PAN so aceita por excecao (demais bancos exigem 12)
  "sc3078 34113 - EMPREST BCO OFICIAL - CEF 1 1 10/07/2026 2/96 R$ 879,31",
  // "BRB" sozinho: o extrato nao diz se e o banco ou a financeira
  "brb12492 34114 - EMPREST BRB 1 1 10/03/2026 6/96 R$ 191,94",
  // Itau com 10 pagas: o PAN exige 15
  "ita9001 34201 - EMPREST ITAU CONSIGNADO 1 1 10/11/2025 10/96 R$ 300,00",
  // Bradesco (demais bancos) com 26 pagas
  "bra7001 34301 - EMPREST BRADESCO 1 1 10/07/2024 26/96 R$ 420,00",
  // Agibank: o PAN nao porta
  "agi5001 34401 - EMPREST AGIBANK 1 1 10/01/2023 44/84 R$ 150,00",
];

const doc = new jsPDF({ unit: "pt", format: "a4" });
doc.setFontSize(8);
LINHAS.forEach((l, i) => doc.text(l, 30, 40 + i * 18));
const bytes = Buffer.from(doc.output("arraybuffer"));

// ── confere com o parser real do simulador antes de gravar ──────────────────
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
const pdf = await (pdfjs.default || pdfjs).getDocument({ data: new Uint8Array(bytes) }).promise;
const page = await pdf.getPage(1);
const tc = await page.getTextContent();
const items = tc.items.filter(it => it.str.trim()).map(it => ({ str: it.str.trim(), x: Math.round(it.transform[4]), y: Math.round(it.transform[5]) }));
const texto = items.map(i => i.str).join("\n");

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(RAIZ, "public", "extrato-parser.js"), "utf8"), ctx);
const contratos = vm.runInContext("extrairContratos", ctx)(texto, items);
const margem = vm.runInContext("extrairMargemENome", ctx)(texto, items, page.rotate || 0);

const esperado = ["Caixa", "BRB", "Itaú", "Bradesco", "Agibank"];
const lidos = contratos.map(c => c.banco);
// o parser agrupa por coordenada vertical e o PDF conta de baixo para cima:
// a ordem sai invertida, o que importa e o conjunto
if (JSON.stringify([...lidos].sort()) !== JSON.stringify([...esperado].sort())) {
  console.error("O parser não leu a fixture como esperado:", lidos);
  process.exit(1);
}
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, bytes);
console.log("gravado:", path.relative(RAIZ, SAIDA));
console.log("contratos lidos pelo parser:");
contratos.forEach(c => console.log(`  ${c.banco.padEnd(9)} nº ${c.numero_contrato.padEnd(9)} parcela ${c.parcela}  restam ${c.prazo}/${c.prazo_total}`));
console.log("nome:", margem.nome, "| margem:", margem.margem);
