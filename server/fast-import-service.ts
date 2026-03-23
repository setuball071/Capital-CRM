import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import * as iconv from "iconv-lite";
import { db } from "./storage";
import {
  importRuns,
  importErrors,
  importRunRows,
  stagingFolha,
  stagingD8,
  stagingContatos,
  clientesPessoa,
  clientesVinculo,
  clientesFolhaMes,
  clientesContratos,
  clientContacts,
  type ImportRun,
} from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import {
  normalizeCol,
  padCpf,
  padUpag,
  preserveMatricula,
  preserveNumeroContrato,
  normalizeBrDecimal,
  COLUMN_MAP,
} from "./import-service";

// Reduced batch size to avoid Neon HTTP payload limit (~16MB)
// Each folha row has ~30 fields, so 100 rows keeps payload under limit
function safeVarchar(
  value: string | null | undefined,
  maxLen: number,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).trim();
  if (str.length === 0) return null;
  return str.length > maxLen ? str.substring(0, maxLen) : str;
}

const BATCH_INSERT_SIZE = 500;
const MAX_LINHAS_POR_EXECUCAO = 500_000;
const MERGE_BATCH_SIZE = 1000;
// Sub-batch for SQL inserts to avoid Neon HTTP payload limit (~16MB)
// staging_folha has ~36 fields; 200 rows ≈ 144KB — safely under limit
// 200 rows = 500 round trips for 100k lines (vs 2000 at chunk=50)
const SQL_INSERT_CHUNK = 200;

export interface FastImportOptions {
  tipoImport: "folha" | "d8" | "contatos" | "estadual";
  competencia?: Date;
  banco?: string;
  layoutD8?: "servidor" | "pensionista";
  convenio?: string;
  tenantId?: number;
  createdById?: number;
}

export interface FastImportReport {
  totalLinhas: number;
  importadas: number;
  rejeitadas: number;
  motivosRejeicao: Record<string, number>;
}

export interface FastImportResult {
  success: boolean;
  importRunId: number;
  phase: "staging" | "merge" | "completed";
  stagedRows: number;
  mergedRows: number;
  errorRows: number;
  status: string;
  pausedForResume: boolean;
  message: string;
  elapsedMs: number;
  report?: FastImportReport;
}

// Mapa D8 Servidor (11 colunas)
// Nota: "uf" no D8 representa a natureza do servidor, não a UF geográfica
const D8_COLUMN_MAP_SERVIDOR: Record<string, string> = {
  cpf: "cpf",
  // matricula aliases
  matricula: "matricula",
  mat: "matricula",
  nr_matricula: "matricula",
  num_matricula: "matricula",
  // nome
  nome: "nome",
  // banco
  banco: "banco",
  // orgao
  orgao: "orgao",
  // natureza (UF field in D8 = natureza do servidor)
  uf: "natureza",
  natureza: "natureza",
  // numero_contrato aliases
  numero_contrato: "numero_contrato",
  n_contrato: "numero_contrato",
  num_contrato: "numero_contrato",
  contrato: "numero_contrato",
  // tipo_contrato aliases
  tipo_contrato: "tipo_contrato",
  tipo_produto: "tipo_contrato",
  tipo: "tipo_contrato",
  contrato_tipo: "tipo_contrato",
  produto: "tipo_contrato",
  // valor_parcela aliases
  valor_parcela: "valor_parcela",
  pmt: "valor_parcela",
  // prazo aliases
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo_remanescente",
  // situacao_contrato aliases
  situacao_contrato: "situacao_contrato",
  situacao: "situacao_contrato",
  sit_contrato: "situacao_contrato",
  status_contrato: "situacao_contrato",
  status: "situacao_contrato",
};

// Mapa D8 Pensionista (14 colunas específicas)
// Nota: "uf" no D8 representa a natureza do servidor, não a UF geográfica
const D8_COLUMN_MAP_PENSIONISTA: Record<string, string> = {
  // orgao
  orgao: "orgao",
  // m_instituidor (specific to pensionista)
  m_instituidor: "m_instituidor",
  // matricula aliases
  matricula: "matricula",
  mat: "matricula",
  nr_matricula: "matricula",
  num_matricula: "matricula",
  // natureza
  uf: "natureza",
  natureza: "natureza",
  // nome
  nome: "nome",
  // cpf
  cpf: "cpf",
  // tipo_contrato aliases
  tipo_contrato: "tipo_contrato",
  tipo_produto: "tipo_contrato",
  tipo: "tipo_contrato",
  contrato_tipo: "tipo_contrato",
  produto: "tipo_contrato",
  // valor_parcela aliases
  pmt: "valor_parcela",
  valor_parcela: "valor_parcela",
  // prazo aliases
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo_remanescente",
  // situacao_contrato aliases
  situacao_contrato: "situacao_contrato",
  situacao: "situacao_contrato",
  sit_contrato: "situacao_contrato",
  status_contrato: "situacao_contrato",
  status: "situacao_contrato",
  // extra fields
  ids: "ids",
  obs: "obs",
  regime_juridico: "regime_juridico",
  // numero_contrato aliases
  numero_contrato: "numero_contrato",
  n_contrato: "numero_contrato",
  num_contrato: "numero_contrato",
  contrato: "numero_contrato",
  // banco
  banco: "banco",
};

// Headers obrigatórios D8 Servidor (normalizados)
const D8_REQUIRED_HEADERS = [
  "banco",
  "orgao",
  "matricula",
  "uf",
  "nome",
  "cpf",
  "tipo_contrato",
  "pmt",
  "prazo_remanescente",
  "situacao_contrato",
  "numero_contrato",
];

// Headers obrigatórios D8 Pensionista (normalizados)
const D8_PENSIONISTA_REQUIRED_HEADERS = [
  "orgao",
  "matricula",
  "cpf",
  "tipo_contrato",
  "pmt",
  "prazo_remanescente",
  "numero_contrato",
  "banco",
];

const FAST_ESTADUAL_COLUMN_MAP: Record<string, string> = {
  cpf: "cpf",
  nome_do_servidor: "nome",
  nome: "nome",
  orgao_secretaria: "orgaodesc",
  orgao: "orgaodesc",
  situacaofuncional: "sit_func",
  situacao_funcional: "sit_func",
  sit_func: "sit_func",
  total_vantagens: "base_calc",
  cidade: "municipio",
  municipio: "municipio",
  uf: "uf",
  natureza: "rjur",
  cargo: "cargo",
  funcao: "funcao",
};

const CONTATOS_COLUMN_MAP: Record<string, string> = {
  cpf: "cpf",
  telefone_1: "telefone_1",
  telefone_2: "telefone_2",
  telefone_3: "telefone_3",
  telefone_4: "telefone_4",
  telefone_5: "telefone_5",
  celular: "telefone_1",
  whatsapp: "telefone_1",
  telefone: "telefone_1",
  fone: "telefone_1",
  fone_1: "telefone_1",
  fone_2: "telefone_2",
  fone_3: "telefone_3",
  email: "email",
  email_1: "email",
  email_2: "email_2",
  endereco: "endereco",
  cidade: "cidade",
  uf: "uf",
  cep: "cep",
  data_nascimento: "data_nascimento",
  dt_nascimento: "data_nascimento",
  nascimento: "data_nascimento",
  data_nasc: "data_nascimento",
  dt_nasc_cliente: "data_nascimento",
  dt_nasc: "data_nascimento",
  data_de_nascimento: "data_nascimento",
  datanascimento: "data_nascimento",
  dtnascimento: "data_nascimento",
  nasc: "data_nascimento",
  banco: "banco_nome",
  banco_nome: "banco_nome",
  nome_banco: "banco_nome",
  agencia: "agencia",
  ag: "agencia",
  conta: "conta",
  conta_corrente: "conta",
  cc: "conta",
  num_conta: "conta",
};

/**
 * Detecta se o arquivo é Windows-1252 / Latin1 ou UTF-8.
 * Retorna 'win1252' se bytes inválidos em UTF-8 forem encontrados, 'utf8' caso contrário.
 */
function detectFileEncoding(filePath: string): "utf8" | "win1252" {
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.alloc(4096);
  const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
  fs.closeSync(fd);
  const sample = buffer.slice(0, bytesRead);
  let i = 0;
  while (i < bytesRead) {
    const byte = sample[i];
    if (byte < 0x80) {
      i++;
    } else if (byte >= 0x80 && byte <= 0x9f) {
      // Windows-1252 control range — invalid in UTF-8
      return "win1252";
    } else if ((byte & 0xe0) === 0xc0) {
      if (i + 1 >= bytesRead || (sample[i + 1] & 0xc0) !== 0x80) return "win1252";
      i += 2;
    } else if ((byte & 0xf0) === 0xe0) {
      if (
        i + 2 >= bytesRead ||
        (sample[i + 1] & 0xc0) !== 0x80 ||
        (sample[i + 2] & 0xc0) !== 0x80
      )
        return "win1252";
      i += 3;
    } else if ((byte & 0xf8) === 0xf0) {
      if (
        i + 3 >= bytesRead ||
        (sample[i + 1] & 0xc0) !== 0x80 ||
        (sample[i + 2] & 0xc0) !== 0x80 ||
        (sample[i + 3] & 0xc0) !== 0x80
      )
        return "win1252";
      i += 4;
    } else {
      return "win1252";
    }
  }
  return "utf8";
}

/**
 * Cria um ReadableStream com conversão automática de Windows-1252 → UTF-8 se necessário.
 */
function createEncodingAwareStream(
  filePath: string,
  options?: { start?: number; end?: number },
): NodeJS.ReadableStream {
  const encoding = detectFileEncoding(filePath);
  if (encoding === "win1252") {
    console.log(`[FastImport] Encoding detected: win1252 — converting to UTF-8: ${path.basename(filePath)}`);
    const raw = fs.createReadStream(filePath, options);
    return raw.pipe(iconv.decodeStream("win1252"));
  }
  return fs.createReadStream(filePath, { ...options, encoding: "utf8" });
}

class FastImportService {
  async startFastImport(
    filePath: string,
    options: FastImportOptions,
  ): Promise<{ importRunId: number; message: string }> {
    const stats = fs.statSync(filePath);
    const totalEstimatedRows = await this.estimateRowCount(filePath);
    const baseTag = this.generateBaseTag(options);

    // Normalize convenio for consistent storage
    const { normalizeConvenio } = await import("@shared/utils");
    const normalizedConvenio = options.convenio
      ? normalizeConvenio(options.convenio)
      : null;

    // CRÍTICO: tenantId é obrigatório para isolamento multi-tenant
    // Fallback para tenant 1 (goldcard) para compatibilidade com workflows legados
    const tenantId = options.tenantId || 1;

    const [importRun] = await db
      .insert(importRuns)
      .values({
        tenantId,
        tipoImport: options.tipoImport,
        competencia: options.competencia || null,
        banco: options.banco || null,
        layoutD8: options.layoutD8 || null,
        arquivoOrigem: path.basename(filePath),
        arquivoPath: filePath,
        arquivoTamanhoBytes: stats.size,
        status: "pendente",
        totalRows: totalEstimatedRows,
        chunkSize: BATCH_INSERT_SIZE,
        baseTag,
        convenio: normalizedConvenio,
        maxLinhasExecucao: MAX_LINHAS_POR_EXECUCAO,
        createdById: options.createdById || null,
      })
      .returning();

    console.log(
      `[FastImport] Job ${importRun.id} created for ${options.tipoImport}, estimated ${totalEstimatedRows} rows`,
    );

    return {
      importRunId: importRun.id,
      message: `Job de importação rápida criado. Use POST /api/fast-imports/process/${importRun.id} para iniciar.`,
    };
  }

  async processChunk(importRunId: number): Promise<FastImportResult> {
    const startTime = Date.now();

    const [run] = await db
      .select()
      .from(importRuns)
      .where(eq(importRuns.id, importRunId))
      .limit(1);

    if (!run) {
      throw new Error(`Import run ${importRunId} não encontrado`);
    }

    if (run.status === "concluido") {
      return {
        success: true,
        importRunId,
        phase: "completed",
        stagedRows: run.processedRows,
        mergedRows: run.successRows,
        errorRows: run.errorRows,
        status: "concluido",
        pausedForResume: false,
        message: "Import já concluído",
        elapsedMs: Date.now() - startTime,
      };
    }

    await db
      .update(importRuns)
      .set({
        status: "processando",
        startedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importRuns.id, importRunId));

    const filePath = run.arquivoPath;
    if (!filePath || !fs.existsSync(filePath)) {
      await this.markError(importRunId, "Arquivo não encontrado: " + filePath);
      throw new Error("Arquivo não encontrado: " + filePath);
    }

    try {
      const phase = run.currentChunk === 0 ? "staging" : "merge";

      if (phase === "staging" || run.offsetAtual === 0) {
        const stagingResult = await this.loadToStaging(run);

        if (stagingResult.pausedForResume) {
          return {
            ...stagingResult,
            elapsedMs: Date.now() - startTime,
          };
        }

        await db
          .update(importRuns)
          .set({ currentChunk: 1, updatedAt: new Date() })
          .where(eq(importRuns.id, importRunId));
      }

      const mergeResult = await this.mergeFromStaging(run);

      return {
        ...mergeResult,
        elapsedMs: Date.now() - startTime,
      };
    } catch (error: any) {
      await this.markError(importRunId, error.message);
      throw error;
    }
  }

  private async loadToStaging(run: ImportRun): Promise<FastImportResult> {
    const filePath = run.arquivoPath!;
    const startOffset = run.offsetAtual || 0;
    const maxLinhas = run.maxLinhasExecucao || MAX_LINHAS_POR_EXECUCAO;

    let processedInThisRun = 0;
    let errorCount = 0;
    let bytesRead = startOffset;
    let pausedForResume = false;

    const headers = await this.readHeaders(filePath);
    const normalizedHeaders = headers.map((h) => normalizeCol(h));

    // Auto-detectar layout D8 baseado na presença de m_instituidor
    let effectiveLayoutD8 = run.layoutD8;
    if (run.tipoImport === "d8" && !effectiveLayoutD8) {
      const hasInstituidor = normalizedHeaders.includes("m_instituidor");
      effectiveLayoutD8 = hasInstituidor ? "pensionista" : "servidor";
      console.log(
        `[FastImport] Auto-detected D8 layout: ${effectiveLayoutD8} (m_instituidor: ${hasInstituidor})`,
      );

      // Atualizar run com layout detectado
      await db
        .update(importRuns)
        .set({ layoutD8: effectiveLayoutD8, updatedAt: new Date() })
        .where(eq(importRuns.id, run.id));
    }

    const columnMap = this.getColumnMap(run.tipoImport, effectiveLayoutD8);
    const headerMap = this.buildHeaderMap(headers, columnMap);

    // Validar headers D8: apenas CPF é hard-required.
    // Demais campos ausentes geram aviso no log mas não bloqueiam a importação —
    // as linhas sem esses valores simplesmente ficarão com null naquela coluna.
    if (run.tipoImport === "d8") {
      // columnMap already computed above (this.getColumnMap(run.tipoImport, effectiveLayoutD8))
      // Check CPF: any alias that maps to "cpf" must be present
      const hasCpf = normalizedHeaders.some((h) => columnMap[h] === "cpf" || h === "cpf");
      if (!hasCpf) {
        throw new Error(
          `Header obrigatório CPF ausente no arquivo D8. A importação não pode prosseguir sem CPF.`,
        );
      }

      // Soft-check for remaining "expected" headers — log only.
      // requiredHeaders contains canonical target field names (e.g. "pmt", "numero_contrato").
      // We check whether any header in the file maps to that canonical field via columnMap.
      const requiredHeaders =
        effectiveLayoutD8 === "pensionista"
          ? D8_PENSIONISTA_REQUIRED_HEADERS
          : D8_REQUIRED_HEADERS;

      const softMissing = requiredHeaders.filter((canonicalField) => {
        if (canonicalField === "cpf") return false; // already hard-checked above
        // A file header covers this field if columnMap[header] === canonicalField
        return !normalizedHeaders.some((h) => columnMap[h] === canonicalField);
      });

      if (softMissing.length > 0) {
        const layoutName =
          effectiveLayoutD8 === "pensionista" ? "Pensionista" : "Servidor";
        console.warn(
          `[FastImport] D8 ${layoutName} run ${run.id}: headers ausentes (serão null): ${softMissing.join(", ").toUpperCase()}`,
        );
      }
    }

    const batchBuffer: any[] = [];

    const fileStream = createEncodingAwareStream(filePath, { start: startOffset });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLine = startOffset === 0;
    let rowNum = run.processedRows;

    for await (const line of rl) {
      if (isFirstLine) {
        isFirstLine = false;
        bytesRead += Buffer.byteLength(line, "utf8") + 1;
        continue;
      }

      bytesRead += Buffer.byteLength(line, "utf8") + 1;
      rowNum++;

      const values = this.parseCSVLine(line);
      const row: Record<string, any> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });

      const stagingRow = this.mapToStagingRow(row, headerMap, run, rowNum);
      if (stagingRow) {
        batchBuffer.push(stagingRow);
      } else {
        errorCount++;
      }

      if (batchBuffer.length >= BATCH_INSERT_SIZE) {
        await this.insertStagingBatch(run.tipoImport, batchBuffer);
        processedInThisRun += batchBuffer.length;
        batchBuffer.length = 0;

        if (processedInThisRun % 10000 === 0) {
          await this.updateProgress(
            run.id,
            run.processedRows + processedInThisRun,
            0,
            run.errorRows + errorCount,
            bytesRead,
          );
          console.log(
            `[FastImport] Staged ${run.processedRows + processedInThisRun} rows...`,
          );
        }
      }

      if (processedInThisRun >= maxLinhas) {
        pausedForResume = true;
        break;
      }
    }

    rl.close();
    fileStream.destroy();

    if (batchBuffer.length > 0) {
      await this.insertStagingBatch(run.tipoImport, batchBuffer);
      processedInThisRun += batchBuffer.length;
    }

    const totalProcessed = run.processedRows + processedInThisRun;
    const totalErrors = run.errorRows + errorCount;

    await this.updateProgress(
      run.id,
      totalProcessed,
      0,
      totalErrors,
      bytesRead,
    );

    if (pausedForResume) {
      await db
        .update(importRuns)
        .set({
          status: "pausado",
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importRuns.id, run.id));

      return {
        success: true,
        importRunId: run.id,
        phase: "staging",
        stagedRows: totalProcessed,
        mergedRows: 0,
        errorRows: totalErrors,
        status: "pausado",
        pausedForResume: true,
        message: `Staging: ${processedInThisRun} linhas carregadas. Total: ${totalProcessed}. Continue com outro request.`,
        elapsedMs: 0,
      };
    }

    console.log(`[FastImport] Staging complete: ${totalProcessed} rows loaded`);

    return {
      success: true,
      importRunId: run.id,
      phase: "staging",
      stagedRows: totalProcessed,
      mergedRows: 0,
      errorRows: totalErrors,
      status: "processando",
      pausedForResume: false,
      message: `Staging completo. ${totalProcessed} linhas carregadas.`,
      elapsedMs: 0,
    };
  }

  private async mergeFromStaging(run: ImportRun): Promise<FastImportResult> {
    console.log(`[FastImport] Starting merge for run ${run.id}...`);

    const tipoImport = run.tipoImport;
    let mergedCount = 0;
    let errorCount = 0;

    try {
      switch (tipoImport) {
        case "folha":
          const folhaResult = await this.mergeFolha(run);
          mergedCount = folhaResult.merged;
          errorCount = folhaResult.errors;
          break;
        case "d8":
          const d8Result = await this.mergeD8(run);
          mergedCount = d8Result.merged;
          errorCount = d8Result.errors;
          break;
        case "contatos":
          const contatosResult = await this.mergeContatos(run);
          mergedCount = contatosResult.merged;
          errorCount = contatosResult.errors;
          break;
        case "estadual":
          const estadualResult = await this.mergeEstadual(run);
          mergedCount = estadualResult.merged;
          errorCount = estadualResult.errors;
          break;
      }

      // Registrar TODAS as linhas em import_run_rows ANTES de limpar staging
      await this.registerAllRows(run, tipoImport, mergedCount, errorCount);

      await this.cleanupStaging(run.id, tipoImport);

      // Calcular contadores reais a partir de import_run_rows
      const realCounts = await this.getRealRowCounts(run.id);

      // Gerar relatório detalhado
      const report = await this.getImportReport(run.id);

      await db
        .update(importRuns)
        .set({
          status:
            realCounts.errorRows > 0 && realCounts.successRows === 0
              ? "erro"
              : realCounts.errorRows > 0
                ? "concluido_com_erros"
                : "concluido",
          processedRows: realCounts.totalRows,
          successRows: realCounts.successRows,
          errorRows: realCounts.errorRows,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importRuns.id, run.id));

      console.log(
        `[FastImport] Merge complete: ${realCounts.successRows} OK, ${realCounts.errorRows} errors`,
      );

      return {
        success: true,
        importRunId: run.id,
        phase: "completed",
        stagedRows: realCounts.totalRows,
        mergedRows: realCounts.successRows,
        errorRows: realCounts.errorRows,
        status: realCounts.errorRows > 0 ? "concluido_com_erros" : "concluido",
        pausedForResume: false,
        message: `Import concluído! ${realCounts.successRows} OK, ${realCounts.errorRows} erros.`,
        elapsedMs: 0,
        report,
      };
    } catch (error: any) {
      console.error(`[FastImport] Merge error:`, error);
      throw error;
    }
  }

  // Registrar TODAS as linhas do staging em import_run_rows
  private async registerAllRows(
    run: ImportRun,
    tipoImport: string,
    mergedCount: number,
    errorCount: number,
  ): Promise<void> {
    console.log(`[FastImport] Registering rows for run ${run.id}...`);

    const stagingTable =
      tipoImport === "folha" || tipoImport === "estadual"
        ? "staging_folha"
        : tipoImport === "d8"
          ? "staging_d8"
          : "staging_contatos";

    const okResult = await db.execute(sql`
    INSERT INTO import_run_rows (import_run_id, row_number, cpf, matricula, status)
    SELECT 
      ${run.id},
      COALESCE(s.row_num, s.id),
      s.cpf,
      ${tipoImport === "contatos" ? sql`NULL` : sql`s.matricula`},
      'ok'
    FROM ${sql.raw(stagingTable)} s
    WHERE s.import_run_id = ${run.id}
      AND s.cpf IS NOT NULL AND s.cpf != ''
      AND (${tipoImport === "contatos" ? sql`TRUE` : sql`s.matricula IS NOT NULL AND s.matricula != ''`})
  `);

    const errorQuery =
      tipoImport === "contatos"
        ? sql`
        INSERT INTO import_run_rows (import_run_id, row_number, cpf, matricula, status, error_message)
        SELECT 
          ${run.id},
          COALESCE(s.row_num, s.id),
          s.cpf,
          NULL,
          'erro',
          'CPF inválido ou vazio'
        FROM ${sql.raw(stagingTable)} s
        WHERE s.import_run_id = ${run.id}
          AND (s.cpf IS NULL OR s.cpf = '')
      `
        : sql`
        INSERT INTO import_run_rows (import_run_id, row_number, cpf, matricula, status, error_message)
        SELECT 
          ${run.id},
          COALESCE(s.row_num, s.id),
          s.cpf,
          s.matricula,
          'erro',
          CASE 
            WHEN s.cpf IS NULL OR s.cpf = '' THEN 'CPF inválido ou vazio'
            ELSE 'Matrícula inválida ou vazia'
          END
        FROM ${sql.raw(stagingTable)} s
        WHERE s.import_run_id = ${run.id}
          AND (
            s.cpf IS NULL OR s.cpf = ''
            OR (s.matricula IS NULL OR s.matricula = '')
          )
      `;
    const errorResult = await db.execute(errorQuery);

    console.log(
      `[FastImport] Registered: ${okResult.rowCount || 0} ok, ${errorResult.rowCount || 0} errors`,
    );
  }

  // Obter contadores reais de import_run_rows
  private async getRealRowCounts(
    importRunId: number,
  ): Promise<{ totalRows: number; successRows: number; errorRows: number }> {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ok') as ok_count,
        COUNT(*) FILTER (WHERE status = 'erro') as error_count
      FROM import_run_rows
      WHERE import_run_id = ${importRunId}
    `);

    const row = result.rows[0] as any;
    return {
      totalRows: parseInt(row?.total || "0"),
      successRows: parseInt(row?.ok_count || "0"),
      errorRows: parseInt(row?.error_count || "0"),
    };
  }

  // Gerar relatório detalhado de importação por arquivo
  async getImportReport(importRunId: number): Promise<FastImportReport> {
    const countsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ok') as importadas,
        COUNT(*) FILTER (WHERE status = 'erro') as rejeitadas
      FROM import_run_rows
      WHERE import_run_id = ${importRunId}
    `);

    const countsRow = countsResult.rows[0] as any;

    // Agrupar motivos de rejeição
    const motivosResult = await db.execute(sql`
      SELECT 
        COALESCE(error_message, 'Erro desconhecido') as motivo,
        COUNT(*) as contagem
      FROM import_run_rows
      WHERE import_run_id = ${importRunId}
        AND status = 'erro'
      GROUP BY error_message
      ORDER BY contagem DESC
    `);

    const motivosRejeicao: Record<string, number> = {};
    for (const row of motivosResult.rows as any[]) {
      motivosRejeicao[row.motivo] = parseInt(row.contagem || "0");
    }

    return {
      totalLinhas: parseInt(countsRow?.total || "0"),
      importadas: parseInt(countsRow?.importadas || "0"),
      rejeitadas: parseInt(countsRow?.rejeitadas || "0"),
      motivosRejeicao,
    };
  }

  private async mergeFolha(
    run: ImportRun,
  ): Promise<{ merged: number; errors: number }> {
    const competencia = run.competencia || new Date();
    const convenio = run.convenio || "SIAPE";
    // Fallback para tenant 1 (goldcard) para compatibilidade
    const tenantId = run.tenantId || 1;
    const baseTag = run.baseTag || "";

    console.log(`[FastImport] Starting SQL-based merge for folha...`);

    const pessoaResult = await db.execute(sql`
      INSERT INTO clientes_pessoa (tenant_id, cpf, matricula, nome, orgaodesc, upag, uf, municipio, convenio, base_tag_ultima, import_run_id)
      SELECT DISTINCT ON (s.cpf)
        ${tenantId}::integer,
        s.cpf,
        s.matricula,
        s.nome,
        s.orgaodesc,
        -- Normaliza UPAG removendo zeros à esquerda
        CASE WHEN s.upag IS NOT NULL AND s.upag != '' 
             THEN LTRIM(s.upag, '0') 
             ELSE s.upag END,
        s.uf,
        s.municipio,
        ${convenio},
        ${baseTag},
        ${run.id}
      FROM staging_folha s
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.matricula IS NOT NULL AND s.matricula != ''
      ON CONFLICT (cpf) DO UPDATE SET
        -- Substitui nome se novo valor não for vazio
        nome = CASE WHEN EXCLUDED.nome IS NOT NULL AND EXCLUDED.nome != '' 
                    THEN EXCLUDED.nome ELSE clientes_pessoa.nome END,
        orgaodesc = CASE WHEN EXCLUDED.orgaodesc IS NOT NULL AND EXCLUDED.orgaodesc != '' 
                         THEN EXCLUDED.orgaodesc ELSE clientes_pessoa.orgaodesc END,
        upag = CASE WHEN EXCLUDED.upag IS NOT NULL AND EXCLUDED.upag != '' 
                    THEN EXCLUDED.upag ELSE clientes_pessoa.upag END,
        uf = CASE WHEN EXCLUDED.uf IS NOT NULL AND EXCLUDED.uf != '' 
                  THEN EXCLUDED.uf ELSE clientes_pessoa.uf END,
        municipio = CASE WHEN EXCLUDED.municipio IS NOT NULL AND EXCLUDED.municipio != '' 
                         THEN EXCLUDED.municipio ELSE clientes_pessoa.municipio END,
        convenio = ${convenio},
        base_tag_ultima = ${baseTag},
        import_run_id = ${run.id},
        atualizado_em = NOW()
    `);

    console.log(`[FastImport] Pessoas upserted: ${pessoaResult.rowCount || 0}`);

    const vinculoResult = await db.execute(sql`
      INSERT INTO clientes_vinculo (tenant_id, cpf, matricula, orgao, convenio, pessoa_id, upag, rjur, sit_func, import_run_id, base_tag)
      SELECT DISTINCT ON (s.cpf, s.matricula, COALESCE(NULLIF(s.orgaodesc, ''), 'DESCONHECIDO'))
        ${tenantId}::integer,
        s.cpf,
        s.matricula,
        COALESCE(NULLIF(s.orgaodesc, ''), 'DESCONHECIDO'),
        ${convenio},
        p.id,
        -- Normaliza UPAG removendo zeros à esquerda
        CASE WHEN s.upag IS NOT NULL AND s.upag != '' 
             THEN LTRIM(s.upag, '0') 
             ELSE s.upag END,
        s.rjur,
        s.sit_func,
        ${run.id},
        ${baseTag}
      FROM staging_folha s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.matricula IS NOT NULL AND s.matricula != ''
      ON CONFLICT (cpf, matricula, orgao) DO UPDATE SET
        tenant_id = COALESCE(clientes_vinculo.tenant_id, EXCLUDED.tenant_id),
        pessoa_id = COALESCE(EXCLUDED.pessoa_id, clientes_vinculo.pessoa_id),
        -- Substitui campos se novo valor não for vazio
        upag = CASE WHEN EXCLUDED.upag IS NOT NULL AND EXCLUDED.upag != '' 
                    THEN EXCLUDED.upag ELSE clientes_vinculo.upag END,
        rjur = CASE WHEN EXCLUDED.rjur IS NOT NULL AND EXCLUDED.rjur != '' 
                    THEN EXCLUDED.rjur ELSE clientes_vinculo.rjur END,
        sit_func = CASE WHEN EXCLUDED.sit_func IS NOT NULL AND EXCLUDED.sit_func != '' 
                        THEN EXCLUDED.sit_func ELSE clientes_vinculo.sit_func END,
        import_run_id = ${run.id},
        base_tag = ${baseTag},
        ultima_atualizacao = NOW()
    `);

    console.log(
      `[FastImport] Vinculos upserted: ${vinculoResult.rowCount || 0}`,
    );

    const folhaResult = await db.execute(sql`
      INSERT INTO clientes_folha_mes (
        pessoa_id, vinculo_id, competencia,
        margem_bruta_5, margem_utilizada_5, margem_saldo_5,
        margem_beneficio_bruta_5, margem_beneficio_utilizada_5, margem_beneficio_saldo_5,
        margem_bruta_35, margem_utilizada_35, margem_saldo_35,
        margem_bruta_70, margem_utilizada_70, margem_saldo_70,
        margem_cartao_credito_saldo, margem_cartao_beneficio_saldo,
        creditos, debitos, liquido, salario_bruto, descontos_brutos, salario_liquido,
        sit_func_no_mes, base_tag, import_run_id,
        exc_qtd, exc_soma
      )
      SELECT DISTINCT ON (v.id, ${competencia}::timestamp)
        p.id,
        v.id,
        ${competencia}::timestamp,
        s.margem_5_bruta::numeric,
        s.margem_5_utilizada::numeric,
        s.margem_5_saldo::numeric,
        s.margem_beneficio_5_bruta::numeric,
        s.margem_beneficio_5_utilizada::numeric,
        s.margem_beneficio_5_saldo::numeric,
        s.margem_35_bruta::numeric,
        s.margem_35_utilizada::numeric,
        s.margem_35_saldo::numeric,
        s.margem_70_bruta::numeric,
        s.margem_70_utilizada::numeric,
        s.margem_70_saldo::numeric,
        s.margem_cartao_credito_saldo::numeric,
        s.margem_cartao_beneficio_saldo::numeric,
        s.creditos::numeric,
        s.debitos::numeric,
        s.liquido::numeric,
        s.creditos::numeric,
        s.debitos::numeric,
        s.liquido::numeric,
        s.sit_func,
        ${baseTag},
        ${run.id},
        s.exc_qtd::integer,
        s.exc_soma::numeric
      FROM staging_folha s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      JOIN clientes_vinculo v ON v.cpf = s.cpf 
        AND v.matricula = s.matricula 
        AND v.orgao = COALESCE(NULLIF(s.orgaodesc, ''), 'DESCONHECIDO')
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.matricula IS NOT NULL AND s.matricula != ''
      ON CONFLICT (vinculo_id, competencia) DO UPDATE SET
        margem_bruta_5 = COALESCE(EXCLUDED.margem_bruta_5, clientes_folha_mes.margem_bruta_5),
        margem_utilizada_5 = COALESCE(EXCLUDED.margem_utilizada_5, clientes_folha_mes.margem_utilizada_5),
        margem_saldo_5 = COALESCE(EXCLUDED.margem_saldo_5, clientes_folha_mes.margem_saldo_5),
        margem_beneficio_bruta_5 = COALESCE(EXCLUDED.margem_beneficio_bruta_5, clientes_folha_mes.margem_beneficio_bruta_5),
        margem_beneficio_utilizada_5 = COALESCE(EXCLUDED.margem_beneficio_utilizada_5, clientes_folha_mes.margem_beneficio_utilizada_5),
        margem_beneficio_saldo_5 = COALESCE(EXCLUDED.margem_beneficio_saldo_5, clientes_folha_mes.margem_beneficio_saldo_5),
        margem_bruta_35 = COALESCE(EXCLUDED.margem_bruta_35, clientes_folha_mes.margem_bruta_35),
        margem_utilizada_35 = COALESCE(EXCLUDED.margem_utilizada_35, clientes_folha_mes.margem_utilizada_35),
        margem_saldo_35 = COALESCE(EXCLUDED.margem_saldo_35, clientes_folha_mes.margem_saldo_35),
        margem_bruta_70 = COALESCE(EXCLUDED.margem_bruta_70, clientes_folha_mes.margem_bruta_70),
        margem_utilizada_70 = COALESCE(EXCLUDED.margem_utilizada_70, clientes_folha_mes.margem_utilizada_70),
        margem_saldo_70 = COALESCE(EXCLUDED.margem_saldo_70, clientes_folha_mes.margem_saldo_70),
        margem_cartao_credito_saldo = COALESCE(EXCLUDED.margem_cartao_credito_saldo, clientes_folha_mes.margem_cartao_credito_saldo),
        margem_cartao_beneficio_saldo = COALESCE(EXCLUDED.margem_cartao_beneficio_saldo, clientes_folha_mes.margem_cartao_beneficio_saldo),
        creditos = COALESCE(EXCLUDED.creditos, clientes_folha_mes.creditos),
        debitos = COALESCE(EXCLUDED.debitos, clientes_folha_mes.debitos),
        liquido = COALESCE(EXCLUDED.liquido, clientes_folha_mes.liquido),
        salario_bruto = COALESCE(EXCLUDED.salario_bruto, clientes_folha_mes.salario_bruto),
        descontos_brutos = COALESCE(EXCLUDED.descontos_brutos, clientes_folha_mes.descontos_brutos),
        salario_liquido = COALESCE(EXCLUDED.salario_liquido, clientes_folha_mes.salario_liquido),
        base_tag = ${baseTag},
        import_run_id = ${run.id},
        exc_qtd = COALESCE(EXCLUDED.exc_qtd, clientes_folha_mes.exc_qtd),
        exc_soma = COALESCE(EXCLUDED.exc_soma, clientes_folha_mes.exc_soma)
    `);

    console.log(`[FastImport] Folha upserted: ${folhaResult.rowCount || 0}`);

    const mergedCount = folhaResult.rowCount || 0;

    return { merged: mergedCount, errors: 0 };
  }

  private async mergeEstadual(
    run: ImportRun,
  ): Promise<{ merged: number; errors: number }> {
    const competencia = run.competencia || new Date();
    const convenio = run.convenio || "ESTADUAL";
    const tenantId = run.tenantId || 1;
    const baseTag = run.baseTag || "";

    console.log(`[FastImport] Starting SQL-based merge for estadual...`);

    const pessoaResult = await db.execute(sql`
      INSERT INTO clientes_pessoa (tenant_id, cpf, matricula, nome, orgaodesc, uf, municipio, convenio, base_tag_ultima, import_run_id)
      SELECT DISTINCT ON (s.cpf)
        ${tenantId}::integer,
        s.cpf,
        'EST_' || s.cpf,
        s.nome,
        s.orgaodesc,
        s.uf,
        s.municipio,
        ${convenio},
        ${baseTag},
        ${run.id}
      FROM staging_folha s
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
      ON CONFLICT (cpf) DO UPDATE SET
        nome = CASE WHEN EXCLUDED.nome IS NOT NULL AND EXCLUDED.nome != '' 
                    THEN EXCLUDED.nome ELSE clientes_pessoa.nome END,
        orgaodesc = CASE WHEN EXCLUDED.orgaodesc IS NOT NULL AND EXCLUDED.orgaodesc != '' 
                         THEN EXCLUDED.orgaodesc ELSE clientes_pessoa.orgaodesc END,
        uf = CASE WHEN EXCLUDED.uf IS NOT NULL AND EXCLUDED.uf != '' 
                  THEN EXCLUDED.uf ELSE clientes_pessoa.uf END,
        municipio = CASE WHEN EXCLUDED.municipio IS NOT NULL AND EXCLUDED.municipio != '' 
                         THEN EXCLUDED.municipio ELSE clientes_pessoa.municipio END,
        convenio = ${convenio},
        base_tag_ultima = ${baseTag},
        import_run_id = ${run.id},
        atualizado_em = NOW()
    `);

    console.log(`[FastImport] Estadual pessoas upserted: ${pessoaResult.rowCount || 0}`);

    const vinculoResult = await db.execute(sql`
      INSERT INTO clientes_vinculo (tenant_id, cpf, matricula, orgao, convenio, pessoa_id, rjur, sit_func, import_run_id, base_tag)
      SELECT DISTINCT ON (s.cpf, 'EST_' || s.cpf, COALESCE(NULLIF(s.orgaodesc, ''), 'DESCONHECIDO'))
        ${tenantId}::integer,
        s.cpf,
        'EST_' || s.cpf,
        COALESCE(NULLIF(s.orgaodesc, ''), 'DESCONHECIDO'),
        ${convenio},
        p.id,
        s.rjur,
        s.sit_func,
        ${run.id},
        ${baseTag}
      FROM staging_folha s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
      ON CONFLICT (cpf, matricula, orgao) DO UPDATE SET
        tenant_id = COALESCE(clientes_vinculo.tenant_id, EXCLUDED.tenant_id),
        pessoa_id = COALESCE(EXCLUDED.pessoa_id, clientes_vinculo.pessoa_id),
        rjur = CASE WHEN EXCLUDED.rjur IS NOT NULL AND EXCLUDED.rjur != '' 
                    THEN EXCLUDED.rjur ELSE clientes_vinculo.rjur END,
        sit_func = CASE WHEN EXCLUDED.sit_func IS NOT NULL AND EXCLUDED.sit_func != '' 
                        THEN EXCLUDED.sit_func ELSE clientes_vinculo.sit_func END,
        import_run_id = ${run.id},
        base_tag = ${baseTag},
        ultima_atualizacao = NOW()
    `);

    console.log(`[FastImport] Estadual vinculos upserted: ${vinculoResult.rowCount || 0}`);

    const folhaResult = await db.execute(sql`
      INSERT INTO clientes_folha_mes (
        pessoa_id, vinculo_id, competencia,
        salario_bruto, base_tag, import_run_id
      )
      SELECT DISTINCT ON (v.id, ${competencia}::timestamp)
        p.id,
        v.id,
        ${competencia}::timestamp,
        s.base_calc::numeric,
        ${baseTag},
        ${run.id}
      FROM staging_folha s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      JOIN clientes_vinculo v ON v.cpf = s.cpf 
        AND v.matricula = 'EST_' || s.cpf
        AND v.orgao = COALESCE(NULLIF(s.orgaodesc, ''), 'DESCONHECIDO')
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
      ON CONFLICT (vinculo_id, competencia) DO UPDATE SET
        salario_bruto = COALESCE(EXCLUDED.salario_bruto, clientes_folha_mes.salario_bruto),
        base_tag = ${baseTag},
        import_run_id = ${run.id}
    `);

    console.log(`[FastImport] Estadual folha upserted: ${folhaResult.rowCount || 0}`);

    return { merged: folhaResult.rowCount || 0, errors: 0 };
  }

  private async mergeD8(
    run: ImportRun,
  ): Promise<{ merged: number; errors: number }> {
    const banco = run.banco || "DESCONHECIDO";
    // Fallback para tenant 1 (goldcard) para compatibilidade
    const tenantId = run.tenantId || 1;
    // Usar competência do run (selecionada na importação)
    const competencia = run.competencia || null;

    console.log(
      `[FastImport] Starting SQL-based merge for D8 (competencia: ${competencia})...`,
    );

    const baseTag = run.baseTag || "";

    // 1. Atualizar clientes_pessoa com nome e natureza do D8
    // Base de clientes é global - não filtrar por tenant_id
    const pessoaResult = await db.execute(sql`
      UPDATE clientes_pessoa p
      SET 
        nome = CASE WHEN s.nome IS NOT NULL AND s.nome != '' THEN s.nome ELSE p.nome END,
        natureza = CASE WHEN s.natureza IS NOT NULL AND s.natureza != '' THEN s.natureza ELSE p.natureza END,
        import_run_id = ${run.id}
      FROM (
        SELECT DISTINCT ON (cpf) cpf, nome, natureza
        FROM staging_d8
        WHERE import_run_id = ${run.id}
          AND cpf IS NOT NULL AND cpf != ''
        ORDER BY cpf, id DESC
      ) s
      WHERE p.cpf = s.cpf
    `);

    console.log(
      `[FastImport] Pessoas updated from D8: ${pessoaResult.rowCount || 0}`,
    );

    // 2. Atualizar extras_vinculo com M_INSTITUIDOR para pensionistas
    // Base de clientes é global - não filtrar por tenant_id
    const instituidorResult = await db.execute(sql`
      UPDATE clientes_vinculo v
      SET 
        extras_vinculo = COALESCE(v.extras_vinculo, '{}'::jsonb) || jsonb_build_object('instituidor', s.m_instituidor)
      FROM (
        SELECT DISTINCT ON (cpf, matricula, orgao) cpf, matricula, orgao, m_instituidor
        FROM staging_d8
        WHERE import_run_id = ${run.id}
          AND cpf IS NOT NULL AND cpf != ''
          AND m_instituidor IS NOT NULL AND m_instituidor != ''
        ORDER BY cpf, matricula, orgao, id DESC
      ) s
      WHERE v.cpf = s.cpf
        AND (s.matricula IS NULL OR s.matricula = '' OR v.matricula = s.matricula)
        AND (s.orgao IS NULL OR s.orgao = '' OR v.orgao = s.orgao)
    `);

    console.log(
      `[FastImport] Vínculos updated with m_instituidor: ${instituidorResult.rowCount || 0}`,
    );

    // 3. DELETE cirúrgico: apaga contratos por banco real do CSV + mesma competência para os vínculos da importação
    // Usa os bancos distintos do staging (CSV), não o banco do import_run que pode ser genérico como "DIVERSOS"
    const deleteResult = await db.execute(sql`
      DELETE FROM clientes_contratos c
      WHERE c.competencia = ${competencia}
      AND c.banco IN (
        SELECT DISTINCT COALESCE(NULLIF(s2.banco, ''), ${banco}) FROM staging_d8 s2 WHERE s2.import_run_id = ${run.id}
      )
      AND c.vinculo_id IN (
        SELECT DISTINCT v.id FROM clientes_vinculo v
        JOIN staging_d8 s ON s.cpf = v.cpf 
        WHERE s.import_run_id = ${run.id}
      )
    `);

    console.log(
      `[FastImport] Contratos antigos deletados (bancos do CSV, comp=${competencia}): ${deleteResult.rowCount || 0}`,
    );

    // 4. INSERT novos contratos
    const contratoResult = await db.execute(sql`
      INSERT INTO clientes_contratos (pessoa_id, vinculo_id, banco, numero_contrato, tipo_contrato, valor_parcela, parcelas_restantes, competencia, import_run_id, base_tag)
      SELECT DISTINCT ON (p.id, s.numero_contrato)
        p.id,
        v.id,
        COALESCE(s.banco, ${banco}),
        s.numero_contrato,
        s.tipo_contrato,
        s.valor_parcela,
        s.prazo_remanescente,
        ${competencia},
        ${run.id},
        ${baseTag}
      FROM staging_d8 s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      LEFT JOIN clientes_vinculo v ON v.cpf = s.cpf 
        AND (s.matricula IS NULL OR s.matricula = '' OR v.matricula = s.matricula)
        AND (s.orgao IS NULL OR s.orgao = '' OR v.orgao = s.orgao)
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.numero_contrato IS NOT NULL AND s.numero_contrato != ''
      ORDER BY p.id, s.numero_contrato, v.id NULLS LAST
      ON CONFLICT (pessoa_id, numero_contrato) DO UPDATE SET
        vinculo_id = EXCLUDED.vinculo_id,
        banco = EXCLUDED.banco,
        tipo_contrato = EXCLUDED.tipo_contrato,
        valor_parcela = EXCLUDED.valor_parcela,
        parcelas_restantes = EXCLUDED.parcelas_restantes,
        competencia = EXCLUDED.competencia,
        import_run_id = EXCLUDED.import_run_id,
        base_tag = EXCLUDED.base_tag
    `);

    console.log(
      `[FastImport] Contratos inseridos: ${contratoResult.rowCount || 0}`,
    );

    return { merged: contratoResult.rowCount || 0, errors: 0 };
  }

  private async mergeContatos(
    run: ImportRun,
  ): Promise<{ merged: number; errors: number }> {
    console.log(
      `[FastImport] Starting SQL-based merge for contatos/dados complementares...`,
    );
    const baseTag = run.baseTag || "";

    // 1. Inserir telefones na tabela client_contacts
    const telefone1Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, type, value, import_run_id, base_tag)
      SELECT p.id, 'phone', s.telefone_1, ${run.id}, ${baseTag}
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_1 IS NOT NULL AND s.telefone_1 != ''
      ON CONFLICT (client_id, type, value) DO NOTHING
    `);

    const telefone2Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, type, value, import_run_id, base_tag)
      SELECT p.id, 'phone', s.telefone_2, ${run.id}, ${baseTag}
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_2 IS NOT NULL AND s.telefone_2 != ''
      ON CONFLICT (client_id, type, value) DO NOTHING
    `);

    const telefone3Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, type, value, import_run_id, base_tag)
      SELECT p.id, 'phone', s.telefone_3, ${run.id}, ${baseTag}
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_3 IS NOT NULL AND s.telefone_3 != ''
      ON CONFLICT (client_id, type, value) DO NOTHING
    `);

    const telefone4Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, type, value, import_run_id, base_tag)
      SELECT p.id, 'phone', s.telefone_4, ${run.id}, ${baseTag}
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_4 IS NOT NULL AND s.telefone_4 != ''
      ON CONFLICT (client_id, type, value) DO NOTHING
    `);

    const telefone5Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, type, value, import_run_id, base_tag)
      SELECT p.id, 'phone', s.telefone_5, ${run.id}, ${baseTag}
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_5 IS NOT NULL AND s.telefone_5 != ''
      ON CONFLICT (client_id, type, value) DO NOTHING
    `);

    const emailResult = await db.execute(sql`
      INSERT INTO client_contacts (client_id, type, value, import_run_id, base_tag)
      SELECT p.id, 'email', s.email, ${run.id}, ${baseTag}
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.email IS NOT NULL AND s.email != ''
      ON CONFLICT (client_id, type, value) DO NOTHING
    `);

    const totalContacts =
      (telefone1Result.rowCount || 0) +
      (telefone2Result.rowCount || 0) +
      (telefone3Result.rowCount || 0) +
      (telefone4Result.rowCount || 0) +
      (telefone5Result.rowCount || 0) +
      (emailResult.rowCount || 0);

    console.log(`[FastImport] Contatos upserted: ${totalContacts}`);

    // 2. Atualizar dados complementares na tabela clientes_pessoa
    // Atualiza data_nascimento, banco_nome, agencia, conta apenas se preenchidos
    const pessoaUpdateResult = await db.execute(sql`
      UPDATE clientes_pessoa p
      SET 
        data_nascimento = COALESCE(
          CASE 
            WHEN s.data_nascimento IS NOT NULL AND s.data_nascimento != '' THEN
              CASE 
                WHEN s.data_nascimento ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN 
                  TO_TIMESTAMP(s.data_nascimento, 'DD/MM/YYYY')
                WHEN s.data_nascimento ~ '^\\d{2}-\\d{2}-\\d{4}$' THEN 
                  TO_TIMESTAMP(s.data_nascimento, 'DD-MM-YYYY')
                WHEN s.data_nascimento ~ '^\\d{4}-\\d{2}-\\d{2}' THEN 
                  TO_TIMESTAMP(s.data_nascimento, 'YYYY-MM-DD')
                WHEN s.data_nascimento ~ '^\\d{4}/\\d{2}/\\d{2}' THEN 
                  TO_TIMESTAMP(s.data_nascimento, 'YYYY/MM/DD')
                WHEN s.data_nascimento ~ '^\\d{1,2}/\\d{1,2}/\\d{2}$' THEN 
                  TO_TIMESTAMP(s.data_nascimento, 'DD/MM/YY')
                WHEN s.data_nascimento ~ '^\\d+\\.?\\d*$' AND CAST(FLOOR(CAST(s.data_nascimento AS numeric)) AS integer) BETWEEN 1 AND 80000 THEN 
                  DATE '1899-12-30' + CAST(FLOOR(CAST(s.data_nascimento AS numeric)) AS integer)
                ELSE NULL
              END
            ELSE NULL
          END,
          p.data_nascimento
        ),
        banco_nome = COALESCE(
          NULLIF(TRIM(s.banco_nome), ''),
          p.banco_nome
        ),
        agencia = COALESCE(
          NULLIF(TRIM(s.agencia), ''),
          p.agencia
        ),
        conta = COALESCE(
          NULLIF(TRIM(s.conta), ''),
          p.conta
        ),
        endereco = COALESCE(
          NULLIF(TRIM(s.endereco), ''),
          p.endereco
        ),
        cidade = COALESCE(
          NULLIF(TRIM(s.cidade), ''),
          p.cidade
        ),
        endereco_uf = COALESCE(
          NULLIF(TRIM(s.uf), ''),
          p.endereco_uf
        ),
        cep = COALESCE(
          NULLIF(TRIM(s.cep), ''),
          p.cep
        ),
        atualizado_em = NOW()
      FROM staging_contatos s
      WHERE p.cpf = s.cpf
        AND s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND (
          (s.data_nascimento IS NOT NULL AND s.data_nascimento != '') OR
          (s.banco_nome IS NOT NULL AND s.banco_nome != '') OR
          (s.agencia IS NOT NULL AND s.agencia != '') OR
          (s.conta IS NOT NULL AND s.conta != '') OR
          (s.endereco IS NOT NULL AND s.endereco != '') OR
          (s.cidade IS NOT NULL AND s.cidade != '') OR
          (s.uf IS NOT NULL AND s.uf != '') OR
          (s.cep IS NOT NULL AND s.cep != '')
        )
    `);

    const totalPessoaUpdates = pessoaUpdateResult.rowCount || 0;
    console.log(
      `[FastImport] Dados complementares (pessoa) atualizados: ${totalPessoaUpdates}`,
    );

    const totalInserted = totalContacts + totalPessoaUpdates;

    return { merged: totalInserted, errors: 0 };
  }

  private async cleanupStaging(
    importRunId: number,
    tipoImport: string,
  ): Promise<void> {
    switch (tipoImport) {
      case "folha":
        await db
          .delete(stagingFolha)
          .where(eq(stagingFolha.importRunId, importRunId));
        break;
      case "d8":
        await db
          .delete(stagingD8)
          .where(eq(stagingD8.importRunId, importRunId));
        break;
      case "contatos":
        await db
          .delete(stagingContatos)
          .where(eq(stagingContatos.importRunId, importRunId));
        break;
      case "estadual":
        await db
          .delete(stagingFolha)
          .where(eq(stagingFolha.importRunId, importRunId));
        break;
    }
    console.log(`[FastImport] Cleaned up staging for run ${importRunId}`);
  }

  private mapToStagingRow(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    run: ImportRun,
    rowNum: number,
  ): any | null {
    const tipoImport = run.tipoImport;
    const getValue = (field: string) => {
      const col = headerMap[field];
      return col ? row[col] : null;
    };
    const parseNum = (val: any): number | null => {
      if (!val) return null;
      const n = normalizeBrDecimal(String(val));
      return n === null || isNaN(n) ? null : n;
    };

    if (tipoImport === "folha") {
      return {
        importRunId: run.id,
        cpf: safeVarchar(padCpf(getValue("cpf")), 20),
        matricula: safeVarchar(preserveMatricula(getValue("matricula")), 50),
        nome: safeVarchar(getValue("nome"), 255),
        orgaodesc: safeVarchar(getValue("orgaodesc"), 255),
        upag: safeVarchar(padUpag(getValue("upag")), 100),
        uf: safeVarchar(getValue("uf"), 100),
        municipio: safeVarchar(getValue("municipio"), 150),
        baseCalc: parseNum(getValue("base_calc")),
        margem5Bruta: parseNum(getValue("margem_5_bruta")),
        margem5Utilizada: parseNum(getValue("margem_5_utilizada")),
        margem5Saldo: parseNum(getValue("margem_5_saldo")),
        margemBeneficio5Bruta: parseNum(getValue("margem_beneficio_5_bruta")),
        margemBeneficio5Utilizada: parseNum(
          getValue("margem_beneficio_5_utilizada"),
        ),
        margemBeneficio5Saldo: parseNum(getValue("margem_beneficio_5_saldo")),
        margem35Bruta: parseNum(getValue("margem_35_bruta")),
        margem35Utilizada: parseNum(getValue("margem_35_utilizada")),
        margem35Saldo: parseNum(getValue("margem_35_saldo")),
        margem70Bruta: parseNum(getValue("margem_70_bruta")),
        margem70Utilizada: parseNum(getValue("margem_70_utilizada")),
        margem70Saldo: parseNum(getValue("margem_70_saldo")),
        margemCartaoCreditoSaldo: parseNum(
          getValue("margem_cartao_credito_saldo"),
        ),
        margemCartaoBeneficioSaldo: parseNum(
          getValue("margem_cartao_beneficio_saldo"),
        ),
        creditos: parseNum(getValue("creditos")),
        debitos: parseNum(getValue("debitos")),
        liquido: parseNum(getValue("liquido")),
        excQtd: parseInt(getValue("exc_qtd") || "0", 10) || null,
        excSoma: parseNum(getValue("exc_soma")),
        rjur: safeVarchar(getValue("rjur"), 50),
        sitFunc: safeVarchar(getValue("sit_func"), 100),
        margem: parseNum(getValue("margem")),
        instituidor: safeVarchar(getValue("instituidor"), 255),
        rowNum,
      };
    } else if (tipoImport === "d8") {
      return {
        importRunId: run.id,
        cpf: safeVarchar(padCpf(getValue("cpf")), 20),
        matricula: safeVarchar(preserveMatricula(getValue("matricula")), 50),
        nome: safeVarchar(getValue("nome"), 255),
        natureza: safeVarchar(getValue("natureza"), 100),
        orgao: safeVarchar(getValue("orgao"), 100),
        banco: safeVarchar(getValue("banco") || run.banco, 100),
        numeroContrato: safeVarchar(
          preserveNumeroContrato(getValue("numero_contrato")),
          100,
        ),
        tipoContrato: safeVarchar(getValue("tipo_contrato"), 100),
        valorParcela: parseNum(getValue("valor_parcela")),
        prazoRemanescente:
          parseInt(getValue("prazo_remanescente") || "0", 10) || null,
        situacaoContrato: safeVarchar(getValue("situacao_contrato"), 100),
        mInstituidor: safeVarchar(getValue("m_instituidor"), 255),
        cpfInstituidor: safeVarchar(padCpf(getValue("cpf_instituidor")), 20),
        rowNum,
      };
    } else if (tipoImport === "contatos") {
      return {
        importRunId: run.id,
        cpf: safeVarchar(padCpf(getValue("cpf")), 20),
        telefone1: safeVarchar(getValue("telefone_1"), 20),
        telefone2: safeVarchar(getValue("telefone_2"), 20),
        telefone3: safeVarchar(getValue("telefone_3"), 20),
        telefone4: safeVarchar(getValue("telefone_4"), 20),
        telefone5: safeVarchar(getValue("telefone_5"), 20),
        email: safeVarchar(getValue("email"), 255),
        email2: safeVarchar(getValue("email_2"), 255),
        endereco: safeVarchar(getValue("endereco"), 500),
        cidade: safeVarchar(getValue("cidade"), 100),
        uf: safeVarchar(getValue("uf"), 10),
        cep: safeVarchar(getValue("cep"), 10),
        dataNascimento: safeVarchar(getValue("data_nascimento"), 20),
        bancoNome: safeVarchar(getValue("banco_nome"), 100),
        agencia: safeVarchar(getValue("agencia"), 20),
        conta: safeVarchar(getValue("conta"), 30),
        rowNum,
      };
    } else if (tipoImport === "estadual") {
      const cpfVal = safeVarchar(padCpf(getValue("cpf")), 20);
      const syntheticMatricula = cpfVal ? `EST_${cpfVal}` : null;
      const cargo = getValue("cargo") || "";
      const funcao = getValue("funcao") || "";
      const cargoFuncao = [cargo, funcao].filter(Boolean).join(" / ") || null;

      const filterPhone = (val: any): string | null => {
        const s = safeVarchar(val, 20);
        if (s && /E\+/i.test(s)) return null;
        return s;
      };

      return {
        importRunId: run.id,
        cpf: cpfVal,
        matricula: safeVarchar(syntheticMatricula, 50),
        nome: safeVarchar(getValue("nome"), 255),
        orgaodesc: safeVarchar(getValue("orgaodesc"), 255),
        upag: null,
        uf: safeVarchar(getValue("uf"), 100),
        municipio: safeVarchar(getValue("municipio"), 150),
        baseCalc: parseNum(getValue("base_calc")),
        margem5Bruta: null,
        margem5Utilizada: null,
        margem5Saldo: null,
        margemBeneficio5Bruta: null,
        margemBeneficio5Utilizada: null,
        margemBeneficio5Saldo: null,
        margem35Bruta: null,
        margem35Utilizada: null,
        margem35Saldo: null,
        margem70Bruta: null,
        margem70Utilizada: null,
        margem70Saldo: null,
        margemCartaoCreditoSaldo: null,
        margemCartaoBeneficioSaldo: null,
        creditos: null,
        debitos: null,
        liquido: null,
        excQtd: null,
        excSoma: null,
        rjur: safeVarchar(getValue("rjur"), 50),
        sitFunc: safeVarchar(getValue("sit_func"), 100),
        margem: null,
        instituidor: safeVarchar(cargoFuncao, 255),
        rowNum,
      };
    }

    return null;
  }

  private async insertStagingBatch(
    tipoImport: string,
    batch: any[],
  ): Promise<void> {
    if (batch.length === 0) return;

    // Insert in smaller chunks to avoid Neon HTTP payload limit
    for (let i = 0; i < batch.length; i += SQL_INSERT_CHUNK) {
      const chunk = batch.slice(i, i + SQL_INSERT_CHUNK);

      switch (tipoImport) {
        case "folha":
        case "estadual":
          await db.insert(stagingFolha).values(chunk);
          break;
        case "d8":
          await db.insert(stagingD8).values(chunk);
          break;
        case "contatos":
          await db.insert(stagingContatos).values(chunk);
          break;
      }
    }
  }

  private getColumnMap(
    tipoImport: string,
    layoutD8?: string | null,
  ): Record<string, string> {
    switch (tipoImport) {
      case "folha":
        return COLUMN_MAP;
      case "d8":
        return layoutD8 === "pensionista"
          ? D8_COLUMN_MAP_PENSIONISTA
          : D8_COLUMN_MAP_SERVIDOR;
      case "contatos":
        return CONTATOS_COLUMN_MAP;
      case "estadual":
        return FAST_ESTADUAL_COLUMN_MAP;
      default:
        return COLUMN_MAP;
    }
  }

  private async readHeaders(filePath: string): Promise<string[]> {
    const stream = createEncodingAwareStream(filePath, { start: 0, end: 20000 });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    let headers: string[] = [];
    for await (const line of rl) {
      headers = this.parseCSVLine(line);
      break;
    }

    rl.close();
    if ("destroy" in stream && typeof (stream as any).destroy === "function") {
      (stream as any).destroy();
    }
    return headers;
  }

  private buildHeaderMap(
    headers: string[],
    columnMap: Record<string, string>,
  ): Record<string, string> {
    const headerMap: Record<string, string> = {};
    for (const h of headers) {
      const normalized = normalizeCol(h);
      const mapped = columnMap[normalized];
      if (mapped) {
        headerMap[mapped] = h;
      }
    }
    return headerMap;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (nextChar === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else if ((char === "," || char === ";") && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  private async estimateRowCount(filePath: string): Promise<number> {
    return new Promise((resolve) => {
      let lines = 0;
      const stream = fs.createReadStream(filePath, { encoding: "utf8" });
      const rl = readline.createInterface({
        input: stream,
        crlfDelay: Infinity,
      });

      rl.on("line", () => {
        lines++;
        if (lines >= 10000) {
          rl.close();
          stream.destroy();
        }
      });

      rl.on("close", () => {
        const stats = fs.statSync(filePath);
        const sampleBytes = Math.min(stats.size, 1024 * 1024);
        const avgBytesPerLine = sampleBytes / Math.max(lines, 1);
        const estimatedLines = Math.ceil(stats.size / avgBytesPerLine);
        resolve(Math.max(estimatedLines, lines));
      });
    });
  }

  private generateBaseTag(options: FastImportOptions): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const prefix = options.tipoImport === "estadual" ? "es" : options.tipoImport.substring(0, 2);
    return `${year}${month}${prefix}`;
  }

  private async markError(importRunId: number, message: string): Promise<void> {
    await db
      .update(importRuns)
      .set({
        status: "erro",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(importRuns.id, importRunId));
  }

  private async updateProgress(
    importRunId: number,
    processedRows: number,
    successRows: number,
    errorRows: number,
    offsetAtual: number,
  ): Promise<void> {
    await db
      .update(importRuns)
      .set({
        processedRows,
        successRows,
        errorRows,
        offsetAtual,
        updatedAt: new Date(),
      })
      .where(eq(importRuns.id, importRunId));
  }

  async getStatus(importRunId: number): Promise<ImportRun | null> {
    const [run] = await db
      .select()
      .from(importRuns)
      .where(eq(importRuns.id, importRunId))
      .limit(1);
    return run || null;
  }
}

export const fastImportService = new FastImportService();
