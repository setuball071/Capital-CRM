/**
 * siape-pdf-parser.ts
 *
 * Extrai dados de contracheques SIAPE (SIGEPE) — suporta:
 *   • Servidor ativo / aposentado
 *   • Beneficiário de pensão (pensionista)
 *
 * Estrutura do PDF é agrupada por coordenada Y (pdfjs).
 *
 * ── Servidor ──────────────────────────────────────────────────────────────────
 *   "COMPROVANTE DE RENDIMENTOS - FOLHA NORMAL"
 *   "UNIVERSIDADE FEDERAL DO RIO DE JANEIRO"
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
 *
 * ── Pensionista ───────────────────────────────────────────────────────────────
 *   "COMPROVANTE DE RENDIMENTOS DE BENEFICIÁRIO DE PENSÃO - FOLHA NORMAL"
 *   "MINISTERIO DA AGRICULTURA E PECUARIA"
 *
 *   "SIGLA DA UPAG  UF  UNIDADE DE LOCALIZAÇÃO  UF"
 *   "SFA-MG         MG  SFA-MG                  MG"
 *
 *   "NOME DO BENEFICIÁRIO DE PENSÃO     MATRÍCULA SIAPE  CPF          MÊS PAGAMENTO"
 *   "SONIA APARECIDA BARATA VISONA      05481431   75150930644  MAI 2026"
 *
 *   "BANCO                AGÊNCIA  CONTA SALÁRIO  BANCO  AGÊNCIA  CONTA"
 *   "104-CAIXA ECONOMICA FEDERAL  033987  0007279436987  -  00000"
 *
 *   "NOME DO INSTITUIDOR              MATRÍCULA SIAPE"
 *   "LAYR FERNANDES BARATA            0005840"
 *
 *   "DEP. IR  NATUREZA DA PENSÃO  INÍCIO DA PENSÃO  ..."
 *   "00       TEMPORÁRIA          12 OUT 2008  ..."
 */

import * as pdfjsLib from "pdfjs-dist";

if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs";
}

// ─── Interface pública ────────────────────────────────────────────────────────

export interface ContaBancariaSiape {
  banco: string;
  agencia: string;
  conta: string;
  /** "salario" = Conta para Recebimento de Salário; "operacoes" = Conta para Outras Operações */
  tipo: "salario" | "operacoes";
  /** Rótulo legível exibido na UI */
  label: string;
}

export interface SiapeParsedData {
  nome: string;
  cpf: string;
  /** Matrícula SIAPE (MAT. SIAPE) */
  matricula: string;
  /** Identidade Única SIAPE (IDENT. ÚNICA) — apenas servidores */
  identSiape: string;
  /** UF do órgão de lotação */
  uf: string;
  /** Nome completo do órgão / entidade */
  orgao: string;
  /** Situação funcional (ex: "Ativo Permanente", "Pensionista") */
  vinculo: string;
  /** Regime jurídico (EST, CLT, MIL…) — vazio para pensionistas */
  regJuridico: string;
  /**
   * Todas as contas bancárias encontradas no contracheque (0–2 itens).
   */
  contas: ContaBancariaSiape[];
  /** @deprecated Usar contas[0].banco quando disponível */
  bancoSalario: string;
  /** @deprecated Usar contas[0].agencia quando disponível */
  agencia: string;
  /** @deprecated Usar contas[0].conta quando disponível */
  conta: string;
  /** Competência no formato ABR/2026 */
  mesAno: string;

  // ── Campos exclusivos de pensionistas ───────────────────────────────────────
  /** Nome do servidor/instituidor que originou a pensão */
  nomeInstituidor?: string;
  /** Matrícula SIAPE do instituidor */
  matriculaInstituidor?: string;
  /** Natureza da pensão (TEMPORÁRIA, VITALÍCIA…) */
  naturezaPensao?: string;
  /** Data de início da pensão, ex: "12 OUT 2008" */
  inicioPensao?: string;
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
    contas: [],
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

  // ── Detecção antecipada de pensionista ──────────────────────────────────────
  const isPensionista = norm(allText).includes("BENEFICIARIO DE PENSAO");
  if (isPensionista) {
    result.vinculo = "Pensionista";
  }

  // ── Percorre linha a linha ───────────────────────────────────────────────────

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;
    const u = norm(t);

    // ────────────────────────────────────────────────────────────────────────
    // 1. ÓRGÃO
    // Servidor:    "COMPROVANTE DE RENDIMENTOS - FOLHA NORMAL"
    // Pensionista: "COMPROVANTE DE RENDIMENTOS DE BENEFICIÁRIO DE PENSÃO - FOLHA NORMAL"
    // Próxima linha: nome do órgão
    // ────────────────────────────────────────────────────────────────────────
    if (!result.orgao && u.includes("COMPROVANTE DE RENDIMENTOS")) {
      const next = lines[i + 1]?.text.trim() ?? "";
      if (next.length > 4 && !/^\d/.test(next)) {
        result.orgao = next;
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 2. UF / REGIME JURÍDICO / SITUAÇÃO FUNCIONAL
    //
    // Servidor:    "SIGLA DA UPAG  UF  REG. JURÍDICO  SITUAÇÃO FUNCIONAL  ..."
    //              "HUCFF          RJ  EST            ATIVO PERMANENTE    ..."
    //
    // Pensionista: "SIGLA DA UPAG  UF  UNIDADE DE LOCALIZAÇÃO  UF"
    //              "SFA-MG         MG  SFA-MG                  MG"
    //
    // Ambos têm "SIGLA DA UPAG" + "UF"; pensionista NÃO tem "REG. JURÍDICO"
    // ────────────────────────────────────────────────────────────────────────
    if (!result.uf && u.includes("SIGLA DA UPAG") && u.includes("UF")) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      const tokens = vt.split(/\s+/).filter(Boolean);
      // tokens[0] = SIGLA_UPAG, tokens[1] = UF
      if (tokens[1] && /^[A-Z]{2}$/.test(tokens[1])) {
        result.uf = tokens[1];
      }

      // Regime jurídico e vínculo só existem no formato servidor
      if (u.includes("REG") && u.includes("JURIDICO")) {
        if (!result.regJuridico && tokens[2] && /^[A-Z]{2,5}$/.test(tokens[2])) {
          result.regJuridico = tokens[2];
        }
        if (!result.vinculo) {
          const vu = norm(vt);
          const found = VINCULOS.find(([k]) => vu.includes(k));
          if (found) result.vinculo = found[1];
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3a. NOME / MAT. SIAPE / IDENT. ÚNICA — formato servidor
    // Header: "NOME DO SERVIDOR    MAT. SIAPE    IDENT. ÚNICA"
    // Values: "LINDALVA GONCALVES ARAUJO    1449208    014492083"
    // ────────────────────────────────────────────────────────────────────────
    if (
      !result.nome &&
      u.includes("NOME DO SERVIDOR") &&
      u.includes("SIAPE") &&
      u.includes("IDENT")
    ) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      if (vt && !/NOME DO SERVIDOR/i.test(vt)) {
        const nums = [...vt.matchAll(/\b(\d{6,10})\b/g)].map((m) => m[1]);
        if (nums[0]) result.matricula = nums[0];
        if (nums[1]) result.identSiape = nums[1];

        const firstNumIdx = vt.search(/\b\d{6,10}\b/);
        result.nome =
          firstNumIdx > 0
            ? vt.slice(0, firstNumIdx).replace(/\s+/g, " ").trim()
            : vt.replace(/\d+/g, "").replace(/\s+/g, " ").trim();
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 3b. NOME / MATRÍCULA — formato pensionista
    // Header: "NOME DO BENEFICIÁRIO DE PENSÃO    MATRÍCULA SIAPE  CPF  MÊS PAGAMENTO"
    // Values: "SONIA APARECIDA BARATA VISONA     05481431   75150930644  MAI 2026"
    //
    // Nome, matrícula, CPF e mês estão TODOS na mesma linha de valores.
    // Matrícula: 1º número de 5–8 dígitos; CPF: 11 dígitos (já capturado via regex global)
    // ────────────────────────────────────────────────────────────────────────
    if (
      !result.nome &&
      u.includes("NOME DO BENEFICIARIO") &&
      u.includes("SIAPE")
    ) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      if (vt) {
        // Matrícula: primeiro número de 5–8 dígitos (não CPF de 11 dígitos)
        const matMatch = vt.match(/\b(\d{5,8})\b/);
        if (matMatch) result.matricula = matMatch[1];

        // Nome = tudo antes da matrícula
        const firstNumIdx = vt.search(/\b\d{5,8}\b/);
        if (firstNumIdx > 0) {
          result.nome = vt.slice(0, firstNumIdx).replace(/\s+/g, " ").trim();
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 4. CPF / MÊS/ANO  (extração mais precisa via linha de cabeçalho — servidor)
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
    //
    // Servidor (duas contas):
    //   "BANCO  AGÊNCIA  CONTA SALÁRIO  |  BANCO  AGÊNCIA  CONTA"
    //   "033    022840   0000710177973  |  104    002160   0000000224831"
    //
    // Servidor (uma conta):
    //   "033    022840   0000710177973"
    //
    // Pensionista — banco vem com nome completo:
    //   "104-CAIXA ECONOMICA FEDERAL  033987  0007279436987  -  00000"
    //   O código do banco precede o traço: /^(\d{3})-/
    // ────────────────────────────────────────────────────────────────────────
    if (
      !result.bancoSalario &&
      u.includes("BANCO") &&
      u.includes("AGENCIA") &&
      u.includes("CONTA")
    ) {
      for (let j = i + 1; j <= Math.min(i + 2, lines.length - 1); j++) {
        const vt = lines[j].text.trim();

        // ── Pensionista: "104-CAIXA ECONOMICA FEDERAL 033987 0007279436987 ..." ──
        const mPens = vt.match(/^(\d{3})-[^0-9]+(\d{4,8})\s+(\d{8,17})/);
        if (mPens) {
          result.contas = [
            {
              banco:   mPens[1],
              agencia: mPens[2],
              conta:   mPens[3],
              tipo:    "salario",
              label:   "Conta para Recebimento do Benefício",
            },
          ];
          result.bancoSalario = mPens[1];
          result.agencia      = mPens[2];
          result.conta        = mPens[3];
          break;
        }

        // ── Servidor: duas contas ──
        const mTwo = vt.match(
          /(\d{3})\s+(\d{4,8})\s+(\d{8,17})\s+(\d{3})\s+(\d{4,8})\s+(\d{8,17})/
        );
        if (mTwo) {
          result.contas = [
            {
              banco:   mTwo[1],
              agencia: mTwo[2],
              conta:   mTwo[3],
              tipo:    "salario",
              label:   "Conta Salário",
            },
            {
              banco:   mTwo[4],
              agencia: mTwo[5],
              conta:   mTwo[6],
              tipo:    "operacoes",
              label:   "Conta para Outras Operações",
            },
          ];
          result.bancoSalario = mTwo[1];
          result.agencia      = mTwo[2];
          result.conta        = mTwo[3];
          break;
        }

        // ── Servidor: uma conta ──
        const mOne = vt.match(/(\d{3})\s+(\d{4,8})\s+(\d{8,17})/);
        if (mOne) {
          result.contas = [
            {
              banco:   mOne[1],
              agencia: mOne[2],
              conta:   mOne[3],
              tipo:    "salario",
              label:   "Conta Salário",
            },
          ];
          result.bancoSalario = mOne[1];
          result.agencia      = mOne[2];
          result.conta        = mOne[3];
          break;
        }
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 6. NATUREZA DA PENSÃO / INÍCIO DA PENSÃO (exclusivo pensionista)
    // Header: "DEP. IR  NATUREZA DA PENSÃO  INÍCIO DA PENSÃO  TÉRMINO  ..."
    // Values: "00       TEMPORÁRIA          12 OUT 2008  ***  ..."
    // ────────────────────────────────────────────────────────────────────────
    if (isPensionista && u.includes("NATUREZA DA PENSAO") && u.includes("INICIO")) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      if (vt) {
        const natMatch = norm(vt).match(/\b(TEMPORARIA|VITALICIA)\b/);
        if (natMatch) {
          result.naturezaPensao =
            natMatch[1] === "TEMPORARIA" ? "Temporária" : "Vitalícia";
        }

        const inicioMatch = vt.match(
          /(\d{1,2}\s+(?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)\s+\d{4})/i
        );
        if (inicioMatch) result.inicioPensao = inicioMatch[1].toUpperCase();
      }
    }

    // ────────────────────────────────────────────────────────────────────────
    // 7. NOME / MATRÍCULA DO INSTITUIDOR (exclusivo pensionista)
    // Header: "NOME DO INSTITUIDOR              MATRÍCULA SIAPE"
    // Values: "LAYR FERNANDES BARATA            0005840"
    // ────────────────────────────────────────────────────────────────────────
    if (isPensionista && u.includes("NOME DO INSTITUIDOR")) {
      const vt = lines[i + 1]?.text.trim() ?? "";
      if (vt) {
        const matInstMatch = vt.match(/\b(\d{4,8})\b/);
        if (matInstMatch) result.matriculaInstituidor = matInstMatch[1];

        const firstNumIdx = vt.search(/\b\d{4,8}\b/);
        if (firstNumIdx > 0) {
          result.nomeInstituidor = vt.slice(0, firstNumIdx).replace(/\s+/g, " ").trim();
        }
      }
    }
  }

  // ── Pós-processamento ────────────────────────────────────────────────────────

  if (result.cpf.length !== 11) result.cpf = "";
  result.nome = result.nome.replace(/\s+/g, " ").trim();

  return result;
}
