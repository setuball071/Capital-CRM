/**
 * siape-pdf-parser.ts
 *
 * Extrai dados de um contracheque SIAPE (SIGEPE) a partir de um arquivo PDF.
 *
 * Estrutura real do documento (pdfjs agrupa por coordenada Y):
 *
 *   "COMPROVANTE DE RENDIMENTOS - FOLHA NORMAL"
 *   "UNIVERSIDADE FEDERAL DO RIO DE JANEIRO"          ← órgão
 *
 *   "SIGLA DA UPAG  UF  REG. JURÍDICO  SITUAÇÃO FUNCIONAL  SIGLA DA UORG  UF"
 *   "HUCFF          RJ  EST            ATIVO PERMANENTE    DEN-HU         RJ"
 *
 *   "NOME DO SERVIDOR                    MAT. SIAPE  IDENT. ÚNICA"
 *   "LINDALVA GONCALVES ARAUJO           1449208     014492083"
 *
 *   "DEPENDENTE S.F.  DEPENDENTE IR  A.T.S.(%)  CPF           MÊS/ANO PAGAMENTO"
 *   "00               01             00         03422750703   MAI 2026"
 *
 *   "BANCO  AGÊNCIA  CONTA SALÁRIO  ..."
 *   "033    022840   0000710177973  ..."
 */

import * as pdfjsLib from "pdfjs-dist";

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
}

// ─── Interface pública ────────────────────────────────────────────────────────

export interface SiapeParsedData {
  nome: string;
  cpf: string;
  /** Matrícula SIAPE (MAT. SIAPE) */
  matricula: string;
  /** Identidade Única SIAPE (IDENT. ÚNICA) */
  identSiape: string;
  /** UF do órgão de lotação */
  uf: string;
  /** Nome completo do órgão / entidade */
  orgao: string;
  /** Situação funcional (ex: "Ativo Permanente") */
  vinculo: string;
  /** Regime jurídico (EST, CLT, MIL…) */
  regJuridico: string;
  /** Código do banco de salário (ex: "033") */
  bancoSalario: string;
  /** Agência do banco salário */
  agencia: string;
  /** Conta salário */
  conta: string;
  /** Competência no formato ABR/2026 */
  mesAno: string;
}

// ─── Extração de linhas do PDF ────────────────────────────────────────────────

interface PdfLine {
  text: string;
  items: Array<{ text: string; x: number; y: number }>;
}

async function pdfToLines(arrayBuffer: ArrayBuffer): Promise<PdfLine[]> {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: PdfLine[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();

    const items = (textContent.items as any[]).map((it) => ({
      text: it.str as string,
      x: it.transform[4] as number,
      y: Math.round(it.transform[5] as number),
    }));

    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let currentY: number | null = null;
    let currentGroup: typeof items = [];

    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) <= 4) {
        currentGroup.push(it);
        currentY = it.y;
      } else {
        if (currentGroup.length) allLines.push(buildLine(currentGroup));
        currentGroup = [it];
        currentY = it.y;
      }
    }
    if (currentGroup.length) allLines.push(buildLine(currentGroup));
  }

  return allLines.filter((l) => l.text.trim().length > 0);
}

function buildLine(
  items: Array<{ text: string; x: number; y: number }>
): PdfLine {
  items.sort((a, b) => a.x - b.x);
  const text = items
    .map((i) => i.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, items };
}

// ─── Normalização ─────────────────────────────────────────────────────────────

/** Remove acentos, maiúscula, deixa só letras/números/espaços */
function norm(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Mapa de vínculo ──────────────────────────────────────────────────────────

const VINCULOS: [string, string][] = [
  ["ATIVO PERMANENTE", "Ativo Permanente"],
  ["APOSENTADO", "Aposentado"],
  ["PENSIONISTA", "Pensionista"],
  ["RESERVA", "Reserva"],
  ["REFORMA", "Reforma"],
  ["ATIVO", "Ativo"],
];

// ─── Parser principal ─────────────────────────────────────────────────────────

export async function parseSiapeContracheque(
  file: File
): Promise<SiapeParsedData> {
  const buffer = await file.arrayBuffer();
  const lines = await pdfToLines(buffer);

  const result: SiapeParsedData = {
    nome: "",
    cpf: "",
    matricula: "",
    identSiape: "",
    uf: "",
    orgao: "",
    vinculo: "",
    regJuridico: "",
    bancoSalario: "",
    agencia: "",
    conta: "",
    mesAno: "",
  };

  // ── CPF e mês/ano — fallback via regex em todo o texto ──────────────────────
  const allText = lines.map((l) => l.text).join("\n");

  const cpfRaw = allText.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);
  if (cpfRaw) result.cpf = cpfRaw[1].replace(/\D/g, "");

  const mesMatch = allText.match(
    /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})\b/i
  );
  if (mesMatch)
    result.mesAno = mesMatch[1].toUpperCase() + "/" + mesMatch[2];

  // ── Percorre linha a linha ───────────────────────────────────────────────────

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    const u = norm(t);

    // ────────────────────────────────────────────────────────────────────────
    // 1. ÓRGÃO
    // Header: "COMPROVANTE DE RENDIMENTOS - FOLHA NORMAL"
    // Próxima linha: "UNIVERSIDADE FEDERAL DO RIO DE JANEIRO"
    // ────────────────────────────────────────────────────────────────────────
    if (!result.orgao && u.includes("COMPROVANTE DE RENDIMENTOS")) {
      const next = lines[i + 1]?.text.trim() ?? "";
      if (next.length > 4 && !/^\d/.test(next)) {
        result.orgao = next;
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. UF / REGIME JURÍDICO / SITUAÇÃO FUNCIONAL
    // Header: "SIGLA DA UPAG  UF  REG. JURÍDICO  SITUAÇÃO FUNCIONAL  SIGLA DA UORG  UF"
    // Values: "HUCFF          RJ  EST            ATIVO PERMANENTE    DEN-HU         RJ"
    // ────────────────────────────────────────────────────────────────────────
    if (
      u.includes("SIGLA DA UPAG") &&
      (u.includes("REG JURIDICO") || u.includes("REG") && u.includes("JURIDICO"))
    ) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      const tokens = vt.split(/\s+/).filter(Boolean);
      // tokens: [SIGLA_UPAG, UF, REG_JUR, SITUACAO..., SIGLA_UORG, UF]
      // ex:     [HUCFF,      RJ, EST,     ATIVO, PERMANENTE, DEN-HU, RJ]

      if (!result.uf && tokens[1] && /^[A-Z]{2}$/.test(tokens[1])) {
        result.uf = tokens[1];
      }
      if (!result.regJuridico && tokens[2] && /^[A-Z]{2,5}$/.test(tokens[2])) {
        result.regJuridico = tokens[2]; // EST, CLT, MIL, RJE…
      }

      // Situação funcional: procura no texto normalizado
      if (!result.vinculo) {
        const vu = norm(vt);
        const found = VINCULOS.find(([k]) => vu.includes(k));
        if (found) result.vinculo = found[1];
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3. NOME / MAT. SIAPE / IDENT. ÚNICA
    // Header: "NOME DO SERVIDOR    MAT. SIAPE    IDENT. ÚNICA"
    // Values: "LINDALVA GONCALVES ARAUJO    1449208    014492083"
    // ────────────────────────────────────────────────────────────────────────
    if (
      u.includes("NOME DO SERVIDOR") &&
      u.includes("SIAPE") &&
      u.includes("IDENT")
    ) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      if (vt && !/NOME DO SERVIDOR/i.test(vt)) {
        // Extrai todos os blocos numéricos de 6–10 dígitos (matrícula, ident)
        const nums = [...vt.matchAll(/\b(\d{6,10})\b/g)].map((m) => m[1]);
        if (nums[0]) result.matricula = nums[0];   // ex: 1449208
        if (nums[1]) result.identSiape = nums[1];  // ex: 014492083

        // Nome = tudo antes do primeiro número de 6+ dígitos
        const firstNumIdx = vt.search(/\b\d{6,10}\b/);
        if (!result.nome) {
          result.nome =
            firstNumIdx > 0
              ? vt.slice(0, firstNumIdx).replace(/\s+/g, " ").trim()
              : vt.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. CPF / MÊS/ANO  (extração mais precisa via linha de cabeçalho)
    // Header: "DEPENDENTE S.F.  DEPENDENTE IR  A.T.S.(%)  CPF  MÊS/ANO PAGAMENTO"
    // Values: "00  01  00  03422750703  MAI 2026"
    // ────────────────────────────────────────────────────────────────────────
    if (
      u.includes("CPF") &&
      (u.includes("MES ANO") || u.includes("PAGAMENTO")) &&
      u.includes("DEPENDENTE")
    ) {
      const vt = lines[i + 1]?.text ?? "";
      const cpfM = vt.match(/\b(\d{11})\b/);
      if (cpfM && !result.cpf) result.cpf = cpfM[1];

      const mesM = vt.match(
        /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+(\d{4})\b/i
      );
      if (mesM && !result.mesAno)
        result.mesAno = mesM[1].toUpperCase() + "/" + mesM[2];
    }

    // ────────────────────────────────────────────────────────────────────────
    // 5. DADOS BANCÁRIOS
    // Há uma linha intermediária: "CONTA PARA RECEBIMENTO DE SALÁRIO ..."
    // Header: "BANCO  AGÊNCIA  CONTA SALÁRIO  BANCO  AGÊNCIA  CONTA"
    // Values: "033    022840   0000710177973  104    002160   0000000224831"
    // ────────────────────────────────────────────────────────────────────────
    if (
      !result.bancoSalario &&
      u.includes("BANCO") &&
      u.includes("AGENCIA") &&
      u.includes("CONTA")
    ) {
      // Próxima linha com valores numéricos (pode estar em i+1 ou i+2)
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
        const vt = lines[j].text.trim();
        // Padrão: "033  022840  0000710177973  ..."
        const m = vt.match(/(\d{3})\s+(\d{4,8})\s+(\d{8,17})/);
        if (m) {
          result.bancoSalario = m[1]; // código do banco (033 = Santander)
          result.agencia      = m[2]; // agência
          result.conta        = m[3]; // conta salário
          break;
        }
      }
    }
  }

  // ── Pós-processamento ────────────────────────────────────────────────────────

  // Garante que o CPF tenha exatamente 11 dígitos
  if (result.cpf.length !== 11) result.cpf = "";

  // Remove espaços extras do nome
  result.nome = result.nome.replace(/\s+/g, " ").trim();

  return result;
}
