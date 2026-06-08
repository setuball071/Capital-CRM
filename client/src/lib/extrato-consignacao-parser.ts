/**
 * extrato-consignacao-parser.ts
 *
 * Extrai dados do Extrato de Consignações Vigentes (SIAPE/SIGEPE).
 *
 * Estrutura do documento:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │ Extrato de Consignações Vigentes                            │
 * ├────────────────────────────────────────────────────────────┤
 * │ Órgão │ CPF │ Matrícula │ Nome                            │
 * │ 26245 - UFRJ │ 034.227.507-03 │ 1449208 │ LINDALVA...    │
 * ├──────────────────────────────────────────────────────────── ┤
 * │ Bruta Comp. │ Líq. Comp. │ Bruta Facult. G │ Líq. Facult. G │ ... │
 * │ R$ 4.514,91 │ R$ 495,78  │ R$ 2.579,95    │ R$ 244,52      │ ... │
 * │             │            │ Utilizada Facult│                │     │
 * │             │            │ R$ 2.100,82     │                │     │
 * ├──────────────────────────────────────────────────────────── ┤
 * │ Demonstrativo / Novo Contrato e Renovação                  │
 * │ Nº Contrato │ Rubrica │ Seq │ Prio │ Data │ Parc │ Val │ In │ Fim │
 * │ 37-867054321/21 │ 34943 - EMPREST INBURSA │ 1 │ 10 │ ... │ ...
 * └──────────────────────────────────────────────────────────── ┘
 */

import * as pdfjsLib from "pdfjs-dist";

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
}

// ─── Interfaces públicas ──────────────────────────────────────────────────────

export interface ExtratoContrato {
  numeroContrato: string;
  codigoRubrica: string;       // "34943"
  nomeRubrica: string;         // "EMPREST BCO PRIVADOS - INBURSA"
  sequencia: number;
  prioridade: number;
  dataTransacao: string;       // "26/07/2021"
  prazoAtual: number;          // numerador de "58/96" → 58
  prazoTotal: number;          // denominador de "58/96" → 96
  valorParcela: number;        // 132.78
  inicio: string;              // "08/2021"
  fim: string;                 // "07/2029"
  tipoContrato: "EMPRESTIMO" | "CARTAO" | "SINDICATO" | "OUTRO";
}

export interface ExtratoConsignacaoParsed {
  // Identificação
  orgao: string;
  cpf: string;
  matricula: string;
  nome: string;
  emitidoEm: string;

  // ── Margens disponíveis (campos mais importantes) ─────────────────────────
  /** Margem líquida disponível para novos empréstimos — KEY para Contrato Novo */
  margemLiquidaFacultativaGlobal: number | null;
  /** Margem líquida disponível para compulsórios */
  margemLiquidaCompulsoria: number | null;
  /** Margem líquida de cartão consignado */
  margemLiquidaCartao: number | null;
  /** Margem líquida de cartão benefício */
  margemLiquidaCartaoBeneficio: number | null;

  // ── Margens brutas ────────────────────────────────────────────────────────
  margemBrutaCompulsoria: number | null;
  margemBrutaFacultativaGlobal: number | null;
  margemBrutaCartao: number | null;
  margemBrutaCartaoBeneficio: number | null;

  // ── Já utilizado ──────────────────────────────────────────────────────────
  margemUtilizadaFacultativa: number | null;
  margemUtilizadaCartao: number | null;
  margemUtilizadaCartaoBeneficio: number | null;

  // ── Contratos vigentes ────────────────────────────────────────────────────
  contratos: ExtratoContrato[];
}

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface PdfItem {
  text: string;
  x: number;
  y: number;
}

interface PdfLine {
  text: string;
  items: PdfItem[];
}

// ─── Extração de linhas do PDF ────────────────────────────────────────────────

async function pdfToLines(arrayBuffer: ArrayBuffer): Promise<PdfLine[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: PdfLine[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();

    const items: PdfItem[] = (content.items as any[]).map((it) => ({
      text: it.str as string,
      x: it.transform[4] as number,
      y: Math.round(it.transform[5] as number),
    }));

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let curY: number | null = null;
    let curGroup: PdfItem[] = [];

    for (const it of items) {
      if (curY === null || Math.abs(it.y - curY) <= 4) {
        curGroup.push(it);
        curY = it.y;
      } else {
        if (curGroup.length) allLines.push(buildLine(curGroup));
        curGroup = [it];
        curY = it.y;
      }
    }
    if (curGroup.length) allLines.push(buildLine(curGroup));
  }

  return allLines.filter((l) => l.text.trim().length > 0);
}

function buildLine(items: PdfItem[]): PdfLine {
  items.sort((a, b) => a.x - b.x);
  const text = items
    .map((i) => i.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, items };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extrai TODOS os valores BRL de um texto, em ordem de aparição */
function extractAllBRL(text: string): number[] {
  return [...text.matchAll(/R\$\s*([\d.]+,\d{2})/g)].map((m) =>
    parseFloat(m[1].replace(/\./g, "").replace(",", "."))
  );
}

/** Extrai o primeiro valor BRL encontrado no texto */
function firstBRL(text: string): number | null {
  const vals = extractAllBRL(text);
  return vals.length > 0 ? vals[0] : null;
}

// ─── Parser de linha de contrato ──────────────────────────────────────────────

/**
 * Tenta parsear uma linha de contrato do extrato.
 *
 * Formato esperado (pdfjs junta tudo em uma linha):
 *   "37-867054321/21  34943 - EMPREST BCO PRIVADOS - INBURSA  1  10  26/07/2021 11:26:48  58/96  R$ 132,78  08/2021  07/2029"
 */
function parseContractLine(
  line: string,
  tipo: ExtratoContrato["tipoContrato"]
): ExtratoContrato | null {
  const u = norm(line);

  // Linha deve conter um código de rubrica (5 dígitos + " - ") e uma data DD/MM/YYYY
  if (!/\d{5}\s*-/.test(line)) return null;
  if (!/\d{2}\/\d{2}\/\d{4}/.test(line)) return null;
  // Deve ter um R$ (valor da parcela)
  if (!/R\$/.test(line)) return null;
  // Deve terminar com MM/YYYY (mês/ano fim)
  if (!/\d{2}\/\d{4}\s*$/.test(line.trim())) return null;

  // Extrai código e nome da rubrica
  const rubrM = line.match(/(\d{5})\s*-\s*(.+?)(?=\s{2,}\d{1,2}\s{1,3}\d{1,2}\s{1,3}\d{2}\/\d{2}\/\d{4})/);
  if (!rubrM) return null;

  const codigoRubrica = rubrM[1];
  const nomeRubrica   = rubrM[2].trim();
  const numeroContrato = line.slice(0, line.indexOf(rubrM[0])).trim();

  // Extrai sequência e prioridade (dois números antes da data)
  const seqPrioM = line.match(/\d{5}\s*-\s*.+?\s+(\d{1,2})\s+(\d{1,2})\s+\d{2}\/\d{2}\/\d{4}/);

  // Extrai data (DD/MM/YYYY)
  const dateM = line.match(/(\d{2}\/\d{2}\/\d{4})/);

  // Extrai parcela N/Total
  const parcelaM = line.match(/(\d+)\/(\d+)\s+R\$/);

  // Extrai valor da parcela
  const valM = line.match(/R\$\s*([\d.]+,\d{2})/);

  // Extrai todas as datas MM/YYYY → as duas últimas são Início e Fim
  const meses = [...line.matchAll(/\b(\d{2}\/\d{4})\b/g)].map((m) => m[1]);

  if (!valM || meses.length < 2) return null;

  return {
    numeroContrato: numeroContrato || "?",
    codigoRubrica,
    nomeRubrica,
    sequencia:   seqPrioM ? parseInt(seqPrioM[1]) : 0,
    prioridade:  seqPrioM ? parseInt(seqPrioM[2]) : 0,
    dataTransacao: dateM ? dateM[1] : "",
    prazoAtual:  parcelaM ? parseInt(parcelaM[1]) : 0,
    prazoTotal:  parcelaM ? parseInt(parcelaM[2]) : 0,
    valorParcela: parseFloat(valM[1].replace(/\./g, "").replace(",", ".")),
    inicio: meses[meses.length - 2],
    fim:    meses[meses.length - 1],
    tipoContrato: tipo,
  };
}

// ─── Extração de margens via posição X/Y (independente de cabeçalho) ──────────
//
// Estratégia robusta que NÃO depende do texto do cabeçalho da tabela.
// Coleta todos os itens BRL do documento antes da primeira seção DEMONSTRATIVO,
// agrupa por faixa de Y (±8px = mesma linha visual), e assume que a primeira
// faixa com 4+ valores é a linha de margens disponíveis.
// Ordena por X para mapear colunas (esquerda → direita):
//   col 0: Bruta Comp  · col 1: Líq Comp
//   col 2: Bruta Facult Global · col 3: Líq Facult Global  ← KEY
//   col 4: Bruta Cartão · col 5: Líq Cartão
//   col 6: Bruta Cartão Ben · col 7: Líq Cartão Ben

interface RawValItem { val: number; x: number; y: number }

function extractMargensFromItems(lines: PdfLine[]): Partial<ExtratoConsignacaoParsed> {
  // Limita a varredura ao que precede o primeiro DEMONSTRATIVO
  const demoIdx = lines.findIndex((l) =>
    norm(l.text).startsWith("DEMONSTRATIVO") && norm(l.text).includes("MARGEM")
  );
  console.log("[extrato] total lines:", lines.length, "| demoIdx:", demoIdx);
  if (demoIdx >= 0) {
    console.log("[extrato] DEMONSTRATIVO line text:", lines[demoIdx].text);
  } else {
    console.log("[extrato] DEMONSTRATIVO NAO ENCONTRADO — varredura em todo documento");
  }

  const scanLines = demoIdx === -1 ? lines : lines.slice(0, demoIdx);

  // Coleta todos os itens com valor BRL (com ou sem prefixo "R$")
  const brlItems: RawValItem[] = [];
  for (const line of scanLines) {
    for (const item of line.items) {
      const v = firstBRL(item.text);
      if (v !== null) {
        brlItems.push({ val: v, x: item.x, y: item.y });
      } else {
        const numM = item.text.trim().match(/^([\d.]+,\d{2})$/);
        if (numM) {
          const n = parseFloat(numM[1].replace(/\./g, "").replace(",", "."));
          if (!isNaN(n) && n > 0) brlItems.push({ val: n, x: item.x, y: item.y });
        }
      }
    }
  }

  console.log("[extrato] brlItems coletados:", brlItems.map(i => `val=${i.val} x=${i.x.toFixed(0)} y=${i.y}`));

  // Agrupa itens por faixa de Y (±8px) — acumula vizinhos próximos
  const yBands: { repY: number; items: RawValItem[] }[] = [];
  for (const vi of brlItems) {
    const band = yBands.find((b) => Math.abs(b.repY - vi.y) <= 8);
    if (band) {
      band.items.push(vi);
    } else {
      yBands.push({ repY: vi.y, items: [vi] });
    }
  }

  // Ordena faixas por Y decrescente (topo da página = maior Y em PDF coords)
  yBands.sort((a, b) => b.repY - a.repY);
  console.log("[extrato] yBands (desc):", yBands.map(b => `repY=${b.repY} items=${b.items.length} vals=[${b.items.map(i=>i.val).join(",")}]`));

  // A PRIMEIRA faixa com 4+ valores BRL é a linha de margens disponíveis
  const marginBand = yBands.find((b) => b.items.length >= 4);
  if (!marginBand) {
    console.log("[extrato] NENHUMA FAIXA COM 4+ ITENS — retornando vazio");
    return {};
  }
  console.log("[extrato] marginBand escolhida: repY=", marginBand.repY, "items=", marginBand.items.length);

  // Ordena itens da faixa por X (esquerda → direita = ordem das colunas)
  marginBand.items.sort((a, b) => a.x - b.x);

  // Deduplica por X (±20px): valores muito próximos em X são da mesma coluna,
  // mantemos apenas o primeiro (= linha de disponível, não o "Utilizada" abaixo)
  const deduped: RawValItem[] = [];
  for (const vi of marginBand.items) {
    const last = deduped[deduped.length - 1];
    if (!last || Math.abs(vi.x - last.x) > 20) deduped.push(vi);
  }

  console.log("[extrato] deduped:", deduped.map((d,i) => `[${i}] val=${d.val} x=${d.x.toFixed(0)}`));
  console.log("[extrato] => margemLiquidaFacultativaGlobal (col3):", deduped[3]?.val ?? null);

  return {
    margemBrutaCompulsoria:         deduped[0]?.val ?? null,
    margemLiquidaCompulsoria:        deduped[1]?.val ?? null,
    margemBrutaFacultativaGlobal:    deduped[2]?.val ?? null,
    margemLiquidaFacultativaGlobal:  deduped[3]?.val ?? null,
    margemBrutaCartao:               deduped[4]?.val ?? null,
    margemLiquidaCartao:             deduped[5]?.val ?? null,
    margemBrutaCartaoBeneficio:      deduped[6]?.val ?? null,
    margemLiquidaCartaoBeneficio:    deduped[7]?.val ?? null,
  };
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export async function parseExtratoConsignacao(
  file: File
): Promise<ExtratoConsignacaoParsed> {
  const buffer = await file.arrayBuffer();
  const lines  = await pdfToLines(buffer);

  const result: ExtratoConsignacaoParsed = {
    orgao: "", cpf: "", matricula: "", nome: "", emitidoEm: "",
    margemLiquidaFacultativaGlobal: null,
    margemLiquidaCompulsoria:       null,
    margemLiquidaCartao:            null,
    margemLiquidaCartaoBeneficio:   null,
    margemBrutaCompulsoria:         null,
    margemBrutaFacultativaGlobal:   null,
    margemBrutaCartao:              null,
    margemBrutaCartaoBeneficio:     null,
    margemUtilizadaFacultativa:     null,
    margemUtilizadaCartao:          null,
    margemUtilizadaCartaoBeneficio: null,
    contratos: [],
  };

  // ── Extração de margens via posição X/Y (antes do loop principal) ─────────
  const margens = extractMargensFromItems(lines);
  Object.assign(result, margens);

  // Controla em qual seção de demonstrativo estamos
  let currentSection: ExtratoContrato["tipoContrato"] = "EMPRESTIMO";
  let inContractTable = false;

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    const u = norm(t);

    // ── 1. Linha de identificação do servidor ─────────────────────────────
    // Header: "Órgão  CPF  Matrícula  Nome"
    // Dados:  "26245 - UFRJ  034.227.507-03  1449208  LINDALVA..."
    if (u.includes("ORGAO") && u.includes("CPF") && u.includes("MATRICULA") && u.includes("NOME")) {
      const vt = lines[i + 1]?.text ?? "";
      const cpfM = vt.match(/(\d{3}\.\d{3}\.\d{3}-\d{2})/);
      if (cpfM) {
        result.cpf = cpfM[1].replace(/\D/g, "");
        // Órgão: tudo antes do CPF
        const cpfIdx = vt.indexOf(cpfM[0]);
        if (cpfIdx > 0) result.orgao = vt.slice(0, cpfIdx).trim();
        // Matrícula e Nome: após o CPF
        const afterCpf = vt.slice(cpfIdx + cpfM[0].length).trim();
        const matM = afterCpf.match(/^(\d{6,8})\s+(.+)/);
        if (matM) {
          result.matricula = matM[1];
          result.nome      = matM[2].trim();
        }
      }
      continue;
    }

    // ── 3. Valores "Utilizada" ────────────────────────────────────────────
    // Podem estar na mesma linha da label ou na linha seguinte
    if (u.includes("UTILIZADA FACULTATIVA")) {
      const brlInLine = extractAllBRL(t);
      if (brlInLine.length > 0) {
        if (brlInLine[0] !== undefined) result.margemUtilizadaFacultativa     = brlInLine[0];
        if (brlInLine[1] !== undefined) result.margemUtilizadaCartao           = brlInLine[1];
        if (brlInLine[2] !== undefined) result.margemUtilizadaCartaoBeneficio  = brlInLine[2];
      } else {
        // Tenta na próxima linha
        const nextVals = extractAllBRL(lines[i + 1]?.text ?? "");
        if (nextVals[0] !== undefined) result.margemUtilizadaFacultativa       = nextVals[0];
        if (nextVals[1] !== undefined) result.margemUtilizadaCartao             = nextVals[1];
        if (nextVals[2] !== undefined) result.margemUtilizadaCartaoBeneficio    = nextVals[2];
      }
      continue;
    }

    // Fallback: "Utilizada Cartão" em linha própria
    if (u === "UTILIZADA CARTAO" || (u.startsWith("UTILIZADA CARTAO") && !u.includes("BENEFICIO"))) {
      const v = firstBRL(t) ?? firstBRL(lines[i + 1]?.text ?? "");
      if (v !== null && result.margemUtilizadaCartao === null) result.margemUtilizadaCartao = v;
      continue;
    }

    if (u.includes("UTILIZADA CARTAO BENEFICIO") || u.includes("UTILIZADA CARTAO BEN")) {
      const v = firstBRL(t) ?? firstBRL(lines[i + 1]?.text ?? "");
      if (v !== null && result.margemUtilizadaCartaoBeneficio === null) result.margemUtilizadaCartaoBeneficio = v;
      continue;
    }

    // ── 4. Seções de demonstrativo ────────────────────────────────────────
    if (u.includes("DEMONSTRATIVO") && u.includes("MARGEM")) {
      inContractTable = false;
      if (u.includes("NOVO CONTRATO") || u.includes("RENOVACAO")) {
        currentSection = "EMPRESTIMO";
      } else if (u.includes("CARTAO") || u.includes("SAQUE")) {
        currentSection = "CARTAO";
      } else if (u.includes("SINDICATO")) {
        currentSection = "SINDICATO";
      } else {
        currentSection = "OUTRO";
      }
      continue;
    }

    // Linha de cabeçalho da tabela de contratos
    if (u.includes("NUMERO DO CONTRATO") && u.includes("RUBRICA")) {
      inContractTable = true;
      continue;
    }

    // ── 5. Linhas de contrato ─────────────────────────────────────────────
    if (inContractTable) {
      // Para de ler contratos se encontrar nova seção ou rodapé
      if (u.startsWith("DEMONSTRATIVO") || u.includes("EMITIDO EM") || u.includes("EXTRATO PARA")) {
        inContractTable = false;
        // Não dá continue — pode ser a linha de emissão, processada abaixo
      } else {
        const contrato = parseContractLine(t, currentSection);
        if (contrato) {
          result.contratos.push(contrato);
        }
        continue;
      }
    }

    // ── 6. Data de emissão ────────────────────────────────────────────────
    if (u.includes("EMITIDO EM")) {
      const dateM = t.match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/);
      if (dateM) result.emitidoEm = dateM[1];
    }
  }

  return result;
}
