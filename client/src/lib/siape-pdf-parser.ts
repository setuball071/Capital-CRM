/**
 * siape-pdf-parser.ts
 * Extrai dados de um contracheque SIAPE a partir de um arquivo PDF.
 * Usa pdfjs-dist para extrair o texto preservando a estrutura de linhas.
 */

import * as pdfjsLib from "pdfjs-dist";

// Worker via CDN para evitar config do Vite com arquivos binários
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
}

export interface SiapeParsedData {
  /** Nome completo do servidor */
  nome: string;
  /** CPF (apenas dígitos, 11 chars) */
  cpf: string;
  /** Matrícula funcional */
  matricula: string;
  /** Identidade única SIAPE */
  identSiape: string;
  /** UF do órgão de lotação */
  uf: string;
  /** Nome do órgão / secretaria */
  orgao: string;
  /** Banco do salário (código + nome) */
  bancoSalario: string;
  /** Agência do banco salário */
  agencia: string;
  /** Conta do banco salário */
  conta: string;
  /** Mês/ano da competência (ex: ABR/2026) */
  mesAno: string;
  /** Situação funcional */
  vinculo: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function norm(s: string): string {
  return (s || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface PdfLine {
  text: string;
  items: Array<{ text: string; x: number; y: number }>;
}

// ─── Extração de linhas do PDF ──────────────────────────────────────────────

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

    // Ordena: Y decrescente (topo primeiro), X crescente
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    let currentY: number | null = null;
    let currentGroup: typeof items = [];

    for (const it of items) {
      if (currentY === null || Math.abs(it.y - currentY) <= 4) {
        currentGroup.push(it);
        currentY = it.y;
      } else {
        if (currentGroup.length) allLines.push(groupToLine(currentGroup));
        currentGroup = [it];
        currentY = it.y;
      }
    }
    if (currentGroup.length) allLines.push(groupToLine(currentGroup));
  }

  return allLines.filter((l) => l.text.length > 0);
}

function groupToLine(items: Array<{ text: string; x: number; y: number }>): PdfLine {
  items.sort((a, b) => a.x - b.x);
  const text = items
    .map((i) => i.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { text, items };
}

// ─── Parsing dos campos SIAPE ───────────────────────────────────────────────

function extractAfterLabel(
  text: string,
  labelPattern: RegExp,
  valuePattern: RegExp = /(.+)/
): string | null {
  const labelMatch = text.match(labelPattern);
  if (!labelMatch) return null;
  const after = text.slice(labelMatch.index! + labelMatch[0].length);
  const valueMatch = after.match(valuePattern);
  return valueMatch ? valueMatch[1].trim() : null;
}

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
    bancoSalario: "",
    agencia: "",
    conta: "",
    mesAno: "",
    vinculo: "",
  };

  const allText = lines.map((l) => l.text).join("\n");

  // ── CPF ─────────────────────────────────────────────────────────────────
  // Formato: 123.456.789-00 ou 12345678900
  const cpfMatch = allText.match(/\b(\d{3}\.?\d{3}\.?\d{3}-?\d{2})\b/);
  if (cpfMatch) {
    result.cpf = cpfMatch[1].replace(/\D/g, "");
  }

  // ── Mês/Ano ─────────────────────────────────────────────────────────────
  const mesMatch = allText.match(
    /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\/\s]+(\d{4})\b/i
  );
  if (mesMatch) {
    result.mesAno = mesMatch[1].toUpperCase() + "/" + mesMatch[2];
  }

  // ── Percorre linhas ──────────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    const u = norm(t);

    // ── Nome ──────────────────────────────────────────────────────────────
    if (!result.nome && u.includes("NOME DO SERVIDOR")) {
      // Caso 1: nome na mesma linha — "NOME DO SERVIDOR: FULANO..."
      const afterLabel = t
        .replace(/NOME DO SERVIDOR\s*[:\/]?\s*/i, "")
        .trim();
      if (
        afterLabel.length > 3 &&
        !/^\d/.test(afterLabel) &&
        !norm(afterLabel).includes("MAT")
      ) {
        // Remove matrícula que pode aparecer no final da linha
        result.nome = afterLabel
          .replace(/\s+\d[\d\s\-\/]*$/, "")
          .trim();
      } else {
        // Caso 2: nome na linha seguinte
        for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
          const nxt = lines[j].text.trim();
          const nxtU = norm(nxt);
          if (
            nxt.length > 3 &&
            !/^\d/.test(nxt) &&
            !nxtU.includes("MAT") &&
            !nxtU.includes("CPF") &&
            !nxtU.includes("SITUACAO") &&
            !nxtU.includes("SIAPE")
          ) {
            result.nome = nxt.replace(/\s+\d[\d\s\-\/]*$/, "").trim();
            break;
          }
        }
      }

      // Também tenta extrair matrícula da mesma linha do nome
      const matSameLine = t.match(
        /MAT[RÍ]*[^A-Z]*[:\s]+([\d][\d\-\/]+)/i
      );
      if (matSameLine && !result.matricula) {
        result.matricula = matSameLine[1].trim();
      }
      const identSameLine = t.match(
        /IDENT[^:]*[:\s]+([\d][\d\-\/]+)/i
      );
      if (identSameLine && !result.identSiape) {
        result.identSiape = identSameLine[1].trim();
      }
    }

    // ── Matrícula ────────────────────────────────────────────────────────
    if (!result.matricula && (u.includes("MATRICULA") || u.match(/\bMAT\b/))) {
      const v =
        extractAfterLabel(t, /MATRI[CÇ]ULA\s*[:]/i, /([\d][\d\-\/]+)/) ||
        extractAfterLabel(t, /\bMAT\.?\s*[:]/i, /([\d][\d\-\/]+)/);
      if (v) result.matricula = v;
    }

    // ── Identidade Única SIAPE ────────────────────────────────────────────
    if (
      !result.identSiape &&
      u.includes("IDENT") &&
      (u.includes("UNICA") || u.includes("FUNCIONAL") || u.includes("SIAPE"))
    ) {
      const v = extractAfterLabel(t, /IDENT[^:]*:/i, /([\d][\d\-\/]+)/);
      if (v) result.identSiape = v;
    }

    // ── UF ───────────────────────────────────────────────────────────────
    if (!result.uf) {
      const ufMatch = t.match(/\bUF\s*[:\-]?\s*([A-Z]{2})\b/i);
      if (ufMatch) result.uf = ufMatch[1].toUpperCase();
    }

    // ── Órgão / Secretaria ────────────────────────────────────────────────
    if (!result.orgao && (u.includes("ORGAO") || u.includes("ORGAO ENTIDADE"))) {
      // "ÓRGÃO/ENTIDADE: 26000 - MINISTÉRIO DA EDUCAÇÃO"
      const orgMatch = t.match(
        /ORGAO[^:]*:\s*(?:\d+\s*[-–]\s*)?([\wÀ-ÿ\s\-]+)/i
      );
      if (orgMatch) {
        const candidate = orgMatch[1].replace(/\s+/g, " ").trim();
        if (candidate.length > 2) result.orgao = candidate;
      }
    }

    // ── Vínculo ──────────────────────────────────────────────────────────
    if (
      !result.vinculo &&
      (u.includes("SITUACAO FUNCIONAL") || u.includes("SITUACAO"))
    ) {
      const VINCULOS: [string, string][] = [
        ["ATIVO PERMANENTE", "Ativo Permanente"],
        ["APOSENTADO", "Aposentado"],
        ["PENSIONISTA", "Pensionista"],
        ["RESERVA", "Reserva"],
        ["REFORMA", "Reforma"],
        ["ATIVO", "Ativo"],
      ];
      // Verificar na linha atual e nas próximas 3
      for (let j = i; j < Math.min(i + 4, lines.length); j++) {
        const lu = norm(lines[j].text);
        const found = VINCULOS.find(([k]) => lu.includes(k));
        if (found) {
          result.vinculo = found[1];
          break;
        }
      }
    }

    // ── Dados Bancários ───────────────────────────────────────────────────
    // Pode estar tudo na mesma linha: "BANCO: 001 AGÊNCIA: 1234-5 CONTA: 12345678-9"
    if (u.includes("BANCO")) {
      if (!result.bancoSalario) {
        // Código + nome: "001 - BANCO DO BRASIL" ou só "001"
        const bMatch =
          t.match(/BANCO\s*(?:SAL[AÁ]RIO)?[:\s]*([\d]+(?:\s*[-–]\s*[\wÀ-ÿ\s]+?)?)\s*(?=AG[ÊE]|CONTA|$)/i) ||
          t.match(/BANCO\s*[:\s]*([\d]+)/i);
        if (bMatch) result.bancoSalario = bMatch[1].replace(/\s+/g, " ").trim();
      }
      if (!result.agencia) {
        const aMatch = t.match(/AG[ÊE]NCIA\s*[:\-]?\s*([\d\-X]+)/i);
        if (aMatch) result.agencia = aMatch[1].trim();
      }
      if (!result.conta) {
        const cMatch = t.match(/CONTA\s*[:\-]?\s*([\d\-X]+)/i);
        if (cMatch) result.conta = cMatch[1].trim();
      }
    }

    if (!result.agencia && u.includes("AGENCIA")) {
      const aMatch = t.match(/AG[ÊE]NCIA\s*[:\-]?\s*([\d\-X]+)/i);
      if (aMatch) result.agencia = aMatch[1].trim();
    }

    if (
      !result.conta &&
      u.includes("CONTA") &&
      !u.includes("DESCONTO") &&
      !u.includes("CONTABILIDADE")
    ) {
      const cMatch = t.match(/CONTA\s*[:\-]?\s*([\d\-X]+)/i);
      if (cMatch) result.conta = cMatch[1].trim();
    }
  }

  // ── Pós-processamento ────────────────────────────────────────────────────

  // Garantir CPF formatado com 11 dígitos
  if (result.cpf.length !== 11) result.cpf = "";

  // Limpar nome — remover caracteres de controle e espaços extras
  result.nome = result.nome.replace(/\s+/g, " ").trim();

  return result;
}
