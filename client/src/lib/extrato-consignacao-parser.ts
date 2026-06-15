/**
 * extrato-consignacao-parser.ts
 *
 * Parser do Extrato de Consignações Vigentes (SIAPE/SIGEPE).
 * Usa state machine lendo cada item do PDF individualmente (sem agrupamento por Y),
 * mesma abordagem do Simulador de Portabilidade que já funciona.
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
  dataTransacao: string;       // "26/07/2021 11:26:48"
  prazoAtual: number;          // numerador de "58/96" → 58
  prazoTotal: number;          // denominador de "58/96" → 96
  valorParcela: number;        // 132.78
  inicio: string;              // "08/2021"
  fim: string;                 // "07/2029"
  tipoContrato: "EMPRESTIMO" | "CARTAO" | "SINDICATO" | "OUTRO";
}

export interface ExtratoConsignacaoParsed {
  orgao: string;
  cpf: string;
  matricula: string;
  nome: string;
  emitidoEm: string;

  margemLiquidaFacultativaGlobal: number | null;
  margemLiquidaCompulsoria: number | null;
  margemLiquidaCartao: number | null;
  margemLiquidaCartaoBeneficio: number | null;

  margemBrutaCompulsoria: number | null;
  margemBrutaFacultativaGlobal: number | null;
  margemBrutaCartao: number | null;
  margemBrutaCartaoBeneficio: number | null;

  margemUtilizadaFacultativa: number | null;
  margemUtilizadaCartao: number | null;
  margemUtilizadaCartaoBeneficio: number | null;

  contratos: ExtratoContrato[];
}

// ─── Extração de itens brutos do PDF ─────────────────────────────────────────

async function pdfRawItems(arrayBuffer: ArrayBuffer): Promise<string[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const out: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    for (const it of (tc.items as any[])) {
      const s = ((it.str as string) || "").trim();
      if (s) out.push(s);
    }
  }
  return out;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normItem(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseBRL(s: string): number | null {
  const m = /^R\$\s*([\d.,]+)$/.exec(s);
  if (!m) return null;
  return parseFloat(m[1].replace(/\./g, "").replace(",", "."));
}

// ─── Parser principal ─────────────────────────────────────────────────────────

export async function parseExtratoConsignacao(
  file: File
): Promise<ExtratoConsignacaoParsed> {
  const buffer = await file.arrayBuffer();
  const items = await pdfRawItems(buffer);
  const normed = items.map(normItem);

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

  // ── Identificação ─────────────────────────────────────────────────────────
  // Estrutura: [Órgão|CPF|Matrícula|Nome] labels, depois valores na mesma ordem.
  // CPF value âncora a busca; item anterior = órgão, próximo número = matrícula.
  for (let i = 0; i < items.length; i++) {
    const cpfM = /(\d{3}\.\d{3}\.\d{3}-\d{2})/.exec(items[i]);
    if (cpfM) {
      result.cpf = cpfM[1].replace(/\D/g, "");
      if (i > 0) result.orgao = items[i - 1];
      for (let j = i + 1; j < Math.min(i + 5, items.length); j++) {
        if (/^\d{6,8}$/.test(items[j])) {
          result.matricula = items[j];
          if (j + 1 < items.length) result.nome = items[j + 1];
          break;
        }
      }
      break;
    }
  }

  // ── Margens ───────────────────────────────────────────────────────────────
  // Estrutura: 8 labels (Bruta Comp, Líq Comp, Bruta Facult Global, Líq Facult Global,
  //            Bruta Cartão, Líq Cartão, Utilizada Facultativa, Utilizada Cartão)
  // seguidos de 8 valores BRL na mesma ordem.
  const brutaCompIdx = normed.findIndex(
    (s) => s === "BRUTA COMPULSORIA" || s.startsWith("BRUTA COMPULSORIA ")
  );
  if (brutaCompIdx !== -1) {
    const brl: number[] = [];
    for (let i = brutaCompIdx + 1; i < Math.min(brutaCompIdx + 30, items.length); i++) {
      if (normed[i].includes("EXTRATO DE CONSIGNACOES") || normed[i].startsWith("DEMONSTRATIVO")) break;
      const v = parseBRL(items[i]);
      if (v !== null) {
        brl.push(v);
        if (brl.length === 8) break;
      }
    }
    result.margemBrutaCompulsoria         = brl[0] ?? null;
    result.margemLiquidaCompulsoria       = brl[1] ?? null;
    result.margemBrutaFacultativaGlobal   = brl[2] ?? null;
    result.margemLiquidaFacultativaGlobal = brl[3] ?? null;
    result.margemBrutaCartao              = brl[4] ?? null;
    result.margemLiquidaCartao            = brl[5] ?? null;
    result.margemUtilizadaFacultativa     = brl[6] ?? null;
    result.margemUtilizadaCartao          = brl[7] ?? null;
  }

  // Cartão Benefício (label seguido imediatamente pelo valor)
  for (let i = 0; i < normed.length; i++) {
    const n = normed[i];
    if (n.includes("BRUTA CARTAO BENEFICIO") || n === "BRUTA CARTAO BEN") {
      const v = parseBRL(items[i + 1] ?? "");
      if (v !== null) result.margemBrutaCartaoBeneficio = v;
    } else if (n.includes("LIQUIDA CARTAO BENEFICIO") || n === "LIQUIDA CARTAO BEN") {
      const v = parseBRL(items[i + 1] ?? "");
      if (v !== null) result.margemLiquidaCartaoBeneficio = v;
    } else if (n.includes("UTILIZADA CARTAO BENEFICIO") || n === "UTILIZADA CARTAO BEN") {
      const v = parseBRL(items[i + 1] ?? "");
      if (v !== null) result.margemUtilizadaCartaoBeneficio = v;
    }
  }

  // ── Contratos: state machine ───────────────────────────────────────────────
  // Igual ao Simulador de Portabilidade (ferramentas-portabilidade.html),
  // mas também captura numeroContrato, prazoAtual/Total, inicio, fim, tipoContrato.
  //
  // Formato por item (um campo por item, em ordem):
  //   [numeroContrato] [rubrica] [seq] [prior] [data/hora] [valor parcela] [parcAtual/parcTotal] [inicio MM/YYYY] [fim MM/YYYY]

  const RE_RUBRICA  = /^\d{5}\s*-\s*(.+)$/;
  const RE_VALOR    = /^R\$\s*([\d.,]+)$/;
  const RE_PARCELA  = /^(\d+)\/(\d+)$/;
  const RE_DATA     = /^\d{2}\/\d{2}\/\d{4}/;
  const RE_MMYYYY   = /^\d{2}\/\d{4}$/;
  // Número de contrato: apenas dígitos, traços e barras (sem letras para não capturar labels)
  const RE_CONTRATO = /^[\d\-\/]+$/;

  const IDLE=0, RUB=1, SEQ=2, PRIOR=3, DATA=4, VALOR=5, PARCELA=6, INICIO=7, FIM=8;
  let state = IDLE;
  let cur: {
    contrato?: string; tipo?: ExtratoContrato["tipoContrato"];
    codigoRubrica?: string; nomeRubrica?: string;
    seq?: number; prior?: number; data?: string;
    valor?: number; parcAtual?: number; parcTotal?: number;
    inicio?: string;
  } = {};
  let currentSection: ExtratoContrato["tipoContrato"] = "EMPRESTIMO";

  for (const raw of items) {
    const line = raw.trim();
    if (!line) continue;

    const n = normItem(line);

    // Detecta cabeçalho de seção — atualiza tipo e reseta state machine
    if (n.includes("DEMONSTRATIVO") && n.includes("MARGEM")) {
      state = IDLE; cur = {};
      if (n.includes("NOVO CONTRATO") || n.includes("RENOVACAO")) {
        currentSection = "EMPRESTIMO";
      } else if (n.includes("CARTAO") || n.includes("SAQUE")) {
        currentSection = "CARTAO";
      } else if (n.includes("SINDICATO")) {
        currentSection = "SINDICATO";
      } else {
        currentSection = "OUTRO";
      }
      continue;
    }

    if (state === IDLE) {
      if (
        RE_CONTRATO.test(line) &&
        !RE_MMYYYY.test(line) &&
        !RE_DATA.test(line) &&
        line.length >= 6
      ) {
        cur = { contrato: line, tipo: currentSection };
        state = RUB;
      }
    } else if (state === RUB) {
      const m = RE_RUBRICA.exec(line);
      if (m) {
        cur.codigoRubrica = (line.match(/^(\d{5})/) || [])[1] || "";
        cur.nomeRubrica   = m[1].trim();
        state = SEQ;
      } else { state = IDLE; cur = {}; }
    } else if (state === SEQ) {
      if (/^\d+$/.test(line)) { cur.seq = parseInt(line); state = PRIOR; }
      else { state = IDLE; cur = {}; }
    } else if (state === PRIOR) {
      if (/^\d+$/.test(line)) { cur.prior = parseInt(line); state = DATA; }
      else { state = IDLE; cur = {}; }
    } else if (state === DATA) {
      if (RE_DATA.test(line)) { cur.data = line; state = VALOR; }
      else { state = IDLE; cur = {}; }
    } else if (state === VALOR) {
      const m = RE_VALOR.exec(line);
      if (m) {
        cur.valor = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
        state = PARCELA;
      } else { state = IDLE; cur = {}; }
    } else if (state === PARCELA) {
      const m = RE_PARCELA.exec(line);
      if (m) {
        cur.parcAtual = parseInt(m[1]);
        cur.parcTotal = parseInt(m[2]);
        state = INICIO;
      } else { state = IDLE; cur = {}; }
    } else if (state === INICIO) {
      if (RE_MMYYYY.test(line)) { cur.inicio = line; state = FIM; }
      else { state = IDLE; cur = {}; }
    } else if (state === FIM) {
      if (RE_MMYYYY.test(line)) {
        result.contratos.push({
          numeroContrato: cur.contrato  || "?",
          codigoRubrica:  cur.codigoRubrica || "",
          nomeRubrica:    cur.nomeRubrica   || "",
          sequencia:      cur.seq    || 0,
          prioridade:     cur.prior  || 0,
          dataTransacao:  cur.data   || "",
          prazoAtual:     cur.parcAtual || 0,
          prazoTotal:     cur.parcTotal || 0,
          valorParcela:   cur.valor  || 0,
          inicio:         cur.inicio || "",
          fim:            line,
          tipoContrato:   cur.tipo   || currentSection,
        });
      }
      state = IDLE; cur = {};
    }
  }

  // ── Data de emissão ───────────────────────────────────────────────────────
  for (let i = 0; i < items.length; i++) {
    if (normed[i].includes("EMITIDO EM")) {
      for (let j = i; j < Math.min(i + 3, items.length); j++) {
        const dm = items[j].match(/(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}:\d{2}/);
        if (dm) { result.emitidoEm = dm[1]; break; }
      }
      break;
    }
  }

  return result;
}
