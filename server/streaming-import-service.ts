import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
import * as iconv from "iconv-lite";
import { db } from "./storage";
import {
  importRuns,
  importErrors,
  clientesPessoa,
  clientesVinculo,
  clientesFolhaMes,
  clientesContratos,
  clientContacts,
  type ImportRun,
  type InsertImportError,
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import {
  normalizeCol,
  padCpf,
  padUpag,
  padPrazo,
  preserveMatricula,
  preserveNumeroContrato,
  normalizeBrDecimal,
  normalizeBrDecimalOrZero,
  COLUMN_MAP,
} from "./import-service";

const MAX_LINHAS_POR_EXECUCAO = 1_000_000;
const BUFFER_SIZE = 100_000;

/**
 * Detecta o encoding de um arquivo CSV (UTF-8 ou Windows-1252/Latin1)
 * Retorna 'utf8' ou 'win1252'
 */
function detectFileEncoding(filePath: string): 'utf8' | 'win1252' {
  const fd = fs.openSync(filePath, 'r');
  const buffer = Buffer.alloc(4096);
  const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
  fs.closeSync(fd);
  
  const sample = buffer.slice(0, bytesRead);
  
  // Verifica se é UTF-8 válido
  // UTF-8 inválido geralmente tem bytes 0x80-0x9F que não são válidos em UTF-8 puro
  // Windows-1252 usa esses bytes para caracteres especiais
  let hasInvalidUtf8 = false;
  let i = 0;
  while (i < bytesRead) {
    const byte = sample[i];
    if (byte < 0x80) {
      // ASCII - válido em ambos
      i++;
    } else if ((byte >= 0x80 && byte <= 0x9F) || (byte >= 0xA0 && byte <= 0xFF && sample[i+1] === undefined)) {
      // Bytes típicos de Windows-1252 que não são UTF-8 válido
      // 0x80-0x9F são caracteres de controle em Latin1/Win1252 mas inválidos em UTF-8
      // Caracteres acentuados em Win1252: á=E1, é=E9, í=ED, ó=F3, ú=FA, etc.
      hasInvalidUtf8 = true;
      break;
    } else if ((byte & 0xE0) === 0xC0) {
      // UTF-8 2-byte sequence
      if (i + 1 >= bytesRead || (sample[i+1] & 0xC0) !== 0x80) {
        hasInvalidUtf8 = true;
        break;
      }
      i += 2;
    } else if ((byte & 0xF0) === 0xE0) {
      // UTF-8 3-byte sequence
      if (i + 2 >= bytesRead || (sample[i+1] & 0xC0) !== 0x80 || (sample[i+2] & 0xC0) !== 0x80) {
        hasInvalidUtf8 = true;
        break;
      }
      i += 3;
    } else if ((byte & 0xF8) === 0xF0) {
      // UTF-8 4-byte sequence
      if (i + 3 >= bytesRead || (sample[i+1] & 0xC0) !== 0x80 || (sample[i+2] & 0xC0) !== 0x80 || (sample[i+3] & 0xC0) !== 0x80) {
        hasInvalidUtf8 = true;
        break;
      }
      i += 4;
    } else {
      hasInvalidUtf8 = true;
      break;
    }
  }
  
  const encoding = hasInvalidUtf8 ? 'win1252' : 'utf8';
  console.log(`[Encoding Detection] File: ${path.basename(filePath)}, Detected: ${encoding}`);
  return encoding;
}

/**
 * Cria um stream de leitura que converte automaticamente de Windows-1252 para UTF-8 se necessário
 */
function createEncodingAwareStream(filePath: string, options?: { start?: number; end?: number }): NodeJS.ReadableStream {
  const encoding = detectFileEncoding(filePath);
  const streamOptions = { ...options };
  
  if (encoding === 'win1252') {
    // Lê como buffer e converte de Windows-1252 para UTF-8
    const rawStream = fs.createReadStream(filePath, streamOptions);
    return rawStream.pipe(iconv.decodeStream('win1252'));
  } else {
    // UTF-8 nativo
    return fs.createReadStream(filePath, { ...streamOptions, encoding: 'utf8' });
  }
}

/**
 * Função utilitária de diagnóstico para verificar constraints e índices de uma tabela
 */
export async function diagnosticarTabela(nomeTabela: string): Promise<void> {
  console.log(`\n[DIAGNÓSTICO] ========== ${nomeTabela} ==========`);
  
  try {
    // (a) Constraints únicas
    const constraints = await db.execute(sql`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint 
      WHERE conrelid = ${nomeTabela}::regclass 
        AND contype IN ('u','x')
    `);
    
    console.log(`[DIAGNÓSTICO] Constraints (u/x) em ${nomeTabela}:`);
    if (constraints.rows.length === 0) {
      console.log("  (nenhuma constraint única encontrada)");
    } else {
      for (const row of constraints.rows) {
        console.log(`  - ${row.conname}: ${row.definition}`);
      }
    }
    
    // (b) Índices
    const indices = await db.execute(sql`
      SELECT indexname, indexdef 
      FROM pg_indexes 
      WHERE tablename = ${nomeTabela}
    `);
    
    console.log(`[DIAGNÓSTICO] Índices em ${nomeTabela}:`);
    if (indices.rows.length === 0) {
      console.log("  (nenhum índice encontrado)");
    } else {
      for (const row of indices.rows) {
        console.log(`  - ${row.indexname}:`);
        console.log(`    ${row.indexdef}`);
      }
    }
  } catch (error) {
    console.error(`[DIAGNÓSTICO] Erro ao diagnosticar ${nomeTabela}:`, error);
  }
  
  console.log(`[DIAGNÓSTICO] ========== FIM ${nomeTabela} ==========\n`);
}

export interface StreamImportOptions {
  tipoImport: "folha" | "d8" | "contatos";
  competencia?: Date;
  banco?: string;
  layoutD8?: "servidor" | "pensionista";
  convenio?: string;
  tenantId?: number;
  createdById?: number;
  chunkSize?: number;
}

export interface ImportJobResult {
  success: boolean;
  importRunId: number;
  processedRows: number;
  successRows: number;
  errorRows: number;
  status: string;
  pausedForResume: boolean;
  message: string;
}

const D8_COLUMN_MAP_SERVIDOR: Record<string, string> = {
  cpf: "cpf",
  orgao: "orgao",
  matricula: "matricula",
  nome: "nome",
  banco: "banco",
  uf: "uf",
  numero_contrato: "numero_contrato",
  n_contrato: "numero_contrato",
  tipo_contrato: "tipo_contrato",
  tipo_produto: "tipo_contrato",
  valor_parcela: "valor_parcela",
  pmt: "pmt",
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo",
  situacao_contrato: "situacao_contrato",
};

// Headers obrigatórios D8 (normalizados - case-insensitive, sem acentos)
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

// Mapa D8 Pensionista - 14 colunas específicas
const D8_COLUMN_MAP_PENSIONISTA: Record<string, string> = {
  orgao: "orgao",
  m_instituidor: "m_instituidor",
  matricula: "matricula",
  uf: "uf",
  nome: "nome",
  cpf: "cpf",
  tipo_contrato: "tipo_contrato",
  tipo_produto: "tipo_contrato",
  pmt: "pmt",
  valor_parcela: "pmt",
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo_remanescente",
  ids: "ids",
  obs: "obs",
  regime_juridico: "regime_juridico",
  numero_contrato: "numero_contrato",
  n_contrato: "numero_contrato",
  banco: "banco",
};

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

const CONTATOS_COLUMN_MAP: Record<string, string> = {
  cpf: "cpf",
  telefone_1: "telefone_1",
  telefone_2: "telefone_2",
  telefone_3: "telefone_3",
  telefone_4: "telefone_4",
  telefone_5: "telefone_5",
  celular: "telefone_1",
  whatsapp: "telefone_1",
  email: "email",
  email_1: "email",
  email_2: "email_2",
  endereco: "endereco",
  cidade: "cidade",
  uf: "uf",
  cep: "cep",
};

class StreamingImportService {
  async startImportJob(
    filePath: string,
    options: StreamImportOptions
  ): Promise<{ importRunId: number; message: string }> {
    const stats = fs.statSync(filePath);
    const totalEstimatedRows = await this.estimateRowCount(filePath);

    const baseTag = this.generateBaseTag(options);

    const [importRun] = await db
      .insert(importRuns)
      .values({
        tenantId: options.tenantId || null,
        tipoImport: options.tipoImport,
        competencia: options.competencia || null,
        banco: options.banco || null,
        layoutD8: options.layoutD8 || null,
        arquivoOrigem: path.basename(filePath),
        arquivoPath: filePath,
        arquivoTamanhoBytes: stats.size,
        status: "pendente",
        totalRows: totalEstimatedRows,
        chunkSize: options.chunkSize || 10000,
        baseTag,
        convenio: options.convenio || null,
        maxLinhasExecucao: MAX_LINHAS_POR_EXECUCAO,
        createdById: options.createdById || null,
      })
      .returning();

    console.log(
      `[StreamImport] Job ${importRun.id} created for ${options.tipoImport}, estimated ${totalEstimatedRows} rows`
    );

    return {
      importRunId: importRun.id,
      message: `Job de importação criado. Use POST /imports/process/${importRun.id} para iniciar.`,
    };
  }

  async processImportChunk(importRunId: number): Promise<ImportJobResult> {
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
        processedRows: run.processedRows,
        successRows: run.successRows,
        errorRows: run.errorRows,
        status: "concluido",
        pausedForResume: false,
        message: "Import já concluído",
      };
    }

    if (run.status !== "pendente" && run.status !== "pausado") {
      throw new Error(
        `Import run ${importRunId} está com status ${run.status}, não pode processar`
      );
    }

    await db
      .update(importRuns)
      .set({ status: "processando", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(importRuns.id, importRunId));

    const filePath = run.arquivoPath;
    if (!filePath || !fs.existsSync(filePath)) {
      await this.markError(importRunId, "Arquivo não encontrado: " + filePath);
      throw new Error("Arquivo não encontrado: " + filePath);
    }

    try {
      let result: ImportJobResult;

      switch (run.tipoImport) {
        case "folha":
          result = await this.processFolhaStream(run);
          break;
        case "d8":
          result = await this.processD8Stream(run);
          break;
        case "contatos":
          result = await this.processContatosStream(run);
          break;
        default:
          result = await this.processFolhaStream(run);
      }

      return result;
    } catch (error: any) {
      await this.markError(importRunId, error.message);
      throw error;
    }
  }

  private async processFolhaStream(run: ImportRun): Promise<ImportJobResult> {
    return this.processGenericStream(run, COLUMN_MAP, async (row, headerMap, errors) => {
      return this.processFolhaRow(row, headerMap, run, errors);
    });
  }

  private async processD8Stream(run: ImportRun): Promise<ImportJobResult> {
    // Auto-detectar layout D8 baseado na presença de m_instituidor se não especificado
    let effectiveLayoutD8 = run.layoutD8;
    if (!effectiveLayoutD8) {
      const headers = await this.readFirstLineHeaders(run.arquivoPath!);
      const normalizedHeaders = headers.map(h => normalizeCol(h));
      const hasInstituidor = normalizedHeaders.includes("m_instituidor");
      effectiveLayoutD8 = hasInstituidor ? "pensionista" : "servidor";
      console.log(`[IMPORT ${run.id}] Auto-detected D8 layout: ${effectiveLayoutD8} (m_instituidor: ${hasInstituidor})`);
      
      // Atualizar run com layout detectado
      await db
        .update(importRuns)
        .set({ layoutD8: effectiveLayoutD8, updatedAt: new Date() })
        .where(eq(importRuns.id, run.id));
      
      // Atualizar run local
      run.layoutD8 = effectiveLayoutD8;
    }
    
    const columnMap =
      effectiveLayoutD8 === "pensionista"
        ? D8_COLUMN_MAP_PENSIONISTA
        : D8_COLUMN_MAP_SERVIDOR;

    return this.processGenericStream(run, columnMap, async (row, headerMap, errors) => {
      return this.processD8Row(row, headerMap, run, errors);
    });
  }
  
  private async readFirstLineHeaders(filePath: string): Promise<string[]> {
    const stream = createEncodingAwareStream(filePath, { start: 0, end: 20000 });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    let headers: string[] = [];
    for await (const line of rl) {
      headers = this.parseCSVLine(line);
      break;
    }
    rl.close();
    if ('destroy' in stream && typeof stream.destroy === 'function') {
      stream.destroy();
    }
    return headers;
  }

  private async processContatosStream(run: ImportRun): Promise<ImportJobResult> {
    return this.processGenericStream(run, CONTATOS_COLUMN_MAP, async (row, headerMap, errors) => {
      return this.processContatosRow(row, headerMap, run, errors);
    });
  }

  private async processGenericStream(
    run: ImportRun,
    columnMap: Record<string, string>,
    processRow: (
      row: Record<string, any>,
      headerMap: Record<string, string>,
      errors: InsertImportError[]
    ) => Promise<boolean>
  ): Promise<ImportJobResult> {
    const filePath = run.arquivoPath!;
    const chunkSize = run.chunkSize;
    const maxLinhas = run.maxLinhasExecucao || MAX_LINHAS_POR_EXECUCAO;
    const startOffset = run.offsetAtual || 0;

    let processedInThisRun = 0;
    let successCount = 0;
    let errorCount = 0;
    let headers: string[] = [];
    let headerMap: Record<string, string> = {};
    const buffer: Record<string, any>[] = [];
    const errors: InsertImportError[] = [];
    let pausedForResume = false;
    let bytesRead = startOffset;

    const headerFirstLineStream = createEncodingAwareStream(filePath, { start: 0, end: 20000 });
    const headerRl = readline.createInterface({
      input: headerFirstLineStream,
      crlfDelay: Infinity,
    });
    for await (const firstLine of headerRl) {
      headers = this.parseCSVLine(firstLine);
      headerMap = this.buildHeaderMap(headers, columnMap);
      break;
    }
    headerRl.close();
    if ('destroy' in headerFirstLineStream && typeof headerFirstLineStream.destroy === 'function') {
      headerFirstLineStream.destroy();
    }

    // Log detalhado dos headers detectados
    console.log(`[IMPORT ${run.id}] Headers detectados (${headers.length}):`, headers.join(", "));
    console.log(`[IMPORT ${run.id}] Mapeamento de colunas:`, JSON.stringify(headerMap, null, 2));

    // Validar headers obrigatórios para D8 (diferentes para servidor vs pensionista)
    // Nota: effectiveLayoutD8 já foi determinado em processD8Stream
    if (run.tipoImport === "d8") {
      const normalizedHeaders = headers.map(h => normalizeCol(h));
      const requiredHeaders = run.layoutD8 === "pensionista" 
        ? D8_PENSIONISTA_REQUIRED_HEADERS 
        : D8_REQUIRED_HEADERS;
      
      const missingHeaders = requiredHeaders.filter(req => {
        // Aceita variações: pmt ou valor_parcela, n_contrato ou numero_contrato
        if (req === "pmt") return !normalizedHeaders.includes("pmt") && !normalizedHeaders.includes("valor_parcela");
        if (req === "numero_contrato") return !normalizedHeaders.includes("numero_contrato") && !normalizedHeaders.includes("n_contrato");
        if (req === "tipo_contrato") return !normalizedHeaders.includes("tipo_contrato") && !normalizedHeaders.includes("tipo_produto");
        if (req === "prazo_remanescente") return !normalizedHeaders.includes("prazo_remanescente") && !normalizedHeaders.includes("prazo");
        return !normalizedHeaders.includes(req);
      });
      
      if (missingHeaders.length > 0) {
        const layoutName = run.layoutD8 === "pensionista" ? "Pensionista" : "Servidor";
        throw new Error(`Headers obrigatórios D8 ${layoutName} ausentes: ${missingHeaders.join(", ").toUpperCase()}`);
      }
    }

    const fileStream = createEncodingAwareStream(filePath, { start: startOffset });

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let isFirstLineOfStream = true;
    let partialLine = "";

    for await (const line of rl) {
      let currentLine = line;
      
      if (isFirstLineOfStream && startOffset > 0) {
        isFirstLineOfStream = false;
        continue;
      }
      
      if (isFirstLineOfStream && startOffset === 0) {
        isFirstLineOfStream = false;
        continue;
      }

      bytesRead += Buffer.byteLength(currentLine, "utf8") + 1;

      const values = this.parseCSVLine(currentLine);
      const row: Record<string, any> = {};
      headers.forEach((h, i) => {
        row[h] = values[i] || "";
      });

      buffer.push(row);

      if (buffer.length >= chunkSize) {
        const { success, error } = await this.processBuffer(
          buffer,
          headerMap,
          run,
          processRow,
          errors
        );
        successCount += success;
        errorCount += error;
        processedInThisRun += buffer.length;
        buffer.length = 0;

        await this.updateProgress(run.id, run.processedRows + processedInThisRun, run.successRows + successCount, run.errorRows + errorCount, bytesRead);

        if (errors.length >= 1000) {
          await this.flushErrors(errors);
          errors.length = 0;
        }
      }

      if (processedInThisRun >= maxLinhas) {
        pausedForResume = true;
        break;
      }
    }

    rl.close();
    if ('destroy' in fileStream && typeof (fileStream as any).destroy === 'function') {
      (fileStream as any).destroy();
    }

    if (buffer.length > 0) {
      const { success, error } = await this.processBuffer(
        buffer,
        headerMap,
        run,
        processRow,
        errors
      );
      successCount += success;
      errorCount += error;
      processedInThisRun += buffer.length;
    }

    if (errors.length > 0) {
      await this.flushErrors(errors);
    }

    const totalProcessed = run.processedRows + processedInThisRun;
    const totalSuccess = run.successRows + successCount;
    const totalErrors = run.errorRows + errorCount;

    if (pausedForResume) {
      await db
        .update(importRuns)
        .set({
          status: "pausado",
          processedRows: totalProcessed,
          successRows: totalSuccess,
          errorRows: totalErrors,
          offsetAtual: bytesRead,
          pausedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importRuns.id, run.id));

      return {
        success: true,
        importRunId: run.id,
        processedRows: totalProcessed,
        successRows: totalSuccess,
        errorRows: totalErrors,
        status: "pausado",
        pausedForResume: true,
        message: `Processado ${processedInThisRun} linhas nesta execução. Total: ${totalProcessed}. Use POST /imports/process/${run.id} para continuar.`,
      };
    }

    await db
      .update(importRuns)
      .set({
        status: "concluido",
        processedRows: totalProcessed,
        successRows: totalSuccess,
        errorRows: totalErrors,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(importRuns.id, run.id));

    // Log final com contagem
    console.log(`[IMPORT ${run.id}] ✅ CONCLUÍDO - Processados: ${totalProcessed} | Sucesso: ${totalSuccess} | Erros: ${totalErrors}`);

    return {
      success: true,
      importRunId: run.id,
      processedRows: totalProcessed,
      successRows: totalSuccess,
      errorRows: totalErrors,
      status: "concluido",
      pausedForResume: false,
      message: `Import concluído. ${totalSuccess} sucessos, ${totalErrors} erros.`,
    };
  }

  private async processBuffer(
    buffer: Record<string, any>[],
    headerMap: Record<string, string>,
    run: ImportRun,
    processRow: (
      row: Record<string, any>,
      headerMap: Record<string, string>,
      errors: InsertImportError[]
    ) => Promise<boolean>,
    errors: InsertImportError[]
  ): Promise<{ success: number; error: number }> {
    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < buffer.length; i++) {
      const row = buffer[i];
      try {
        const success = await processRow(row, headerMap, errors);
        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err: any) {
        errorCount++;
        errors.push({
          importRunId: run.id,
          rowNumber: run.processedRows + i + 1,
          cpf: this.extractValue(row, headerMap, "cpf"),
          matricula: this.extractValue(row, headerMap, "matricula"),
          errorType: "exception",
          errorMessage: err.message || "Erro desconhecido",
          rawPayload: row,
        });
      }
    }

    return { success: successCount, error: errorCount };
  }

  private async processFolhaRow(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    run: ImportRun,
    errors: InsertImportError[]
  ): Promise<boolean> {
    const cpf = padCpf(this.extractValue(row, headerMap, "cpf"));
    const matricula = preserveMatricula(this.extractValue(row, headerMap, "matricula"));
    
    // ORGAO: extrair e normalizar como string (trim, sem conversão numérica)
    // Tenta "orgao" primeiro, depois "orgaodesc" como fallback
    const orgaoRaw = this.extractValue(row, headerMap, "orgao") || this.extractValue(row, headerMap, "orgaodesc");
    const orgao = orgaoRaw ? String(orgaoRaw).trim() : "DESCONHECIDO";

    if (!cpf || !matricula) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf,
        matricula,
        errorType: "validation",
        errorMessage: "CPF ou matrícula ausente",
        rawPayload: row,
      });
      return false;
    }

    let vinculo: { id: number; pessoaId: number | null } | null = await this.findOrCreateVinculo(cpf, matricula, run, undefined, orgao);
    if (!vinculo || !vinculo.pessoaId) {
      const pessoa = await this.upsertPessoa({
        tenantId: run.tenantId,
        cpf,
        matricula,
        nome: this.extractValue(row, headerMap, "nome"),
        orgaodesc: this.extractValue(row, headerMap, "orgaodesc"),
        upag: padUpag(this.extractValue(row, headerMap, "upag")),
        uf: this.extractValue(row, headerMap, "uf"),
        municipio: this.extractValue(row, headerMap, "municipio"),
        convenio: run.convenio,
        baseTagUltima: run.baseTag,
      });

      if (!pessoa) return false;

      vinculo = await this.findOrCreateVinculo(cpf, matricula, run, pessoa.id, orgao);
    }

    if (!vinculo || !vinculo.pessoaId) {
      return false;
    }

    const competencia = run.competencia || new Date();
    await this.upsertFolhaMes(vinculo.pessoaId, competencia, row, headerMap, run.baseTag);

    return true;
  }

  private async processD8Row(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    run: ImportRun,
    errors: InsertImportError[]
  ): Promise<boolean> {
    const cpf = padCpf(this.extractValue(row, headerMap, "cpf"));
    const matricula = preserveMatricula(this.extractValue(row, headerMap, "matricula"));
    const numeroContrato = preserveNumeroContrato(this.extractValue(row, headerMap, "numero_contrato"));
    const banco = run.banco || this.extractValue(row, headerMap, "banco");
    
    // ORGAO: extrair e normalizar como string (trim, sem conversão numérica)
    const orgaoRaw = this.extractValue(row, headerMap, "orgao");
    const orgao = orgaoRaw ? String(orgaoRaw).trim() : "";

    // Validação dura: ORGAO é OBRIGATÓRIO para D8 (evita vínculos ambíguos)
    if (!orgao || orgao.length === 0) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf,
        matricula,
        errorType: "validation",
        errorMessage: "ORGAO ausente ou vazio. Campo obrigatório para D8 (evita vínculos ambíguos). Verifique a coluna ORGAO no arquivo.",
        rawPayload: row,
      });
      return false;
    }

    // Validação clara: rejeitar linha se faltar campos obrigatórios (sem quebrar o lote)
    const camposFaltando: string[] = [];
    
    if (!cpf) {
      camposFaltando.push("CPF");
    }
    if (!matricula) {
      camposFaltando.push("MATRICULA");
    }
    if (!numeroContrato) {
      camposFaltando.push("NUMERO_CONTRATO");
    }
    if (!banco) {
      camposFaltando.push("BANCO");
    }

    if (camposFaltando.length > 0) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf: cpf || null,
        matricula: matricula || null,
        errorType: "validation",
        errorMessage: `Campos obrigatórios ausentes: ${camposFaltando.join(", ")}. Linha rejeitada.`,
        rawPayload: row,
      });
      return false;
    }

    // Neste ponto, cpf e matricula foram validados como não-nulos
    const vinculo = await this.findOrCreateVinculo(cpf!, matricula!, run, undefined, orgao);
    if (!vinculo || !vinculo.pessoaId) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf,
        matricula,
        errorType: "validation",
        errorMessage: "Vínculo CPF+Matrícula não encontrado. Importe a folha primeiro.",
        rawPayload: row,
      });
      return false;
    }

    // Soft merge vinculo.orgao: preenche apenas se atual é "DESCONHECIDO" ou vazio
    if (orgao && orgao.length > 0 && vinculo.id) {
      const [vinculoAtual] = await db
        .select({ orgao: clientesVinculo.orgao })
        .from(clientesVinculo)
        .where(eq(clientesVinculo.id, vinculo.id))
        .limit(1);

      if (vinculoAtual) {
        const orgaoAtual = vinculoAtual.orgao?.trim() || "";
        // Só atualiza se orgao atual é vazio ou "DESCONHECIDO"
        if (orgaoAtual.length === 0 || orgaoAtual.toUpperCase() === "DESCONHECIDO") {
          await db
            .update(clientesVinculo)
            .set({ orgao: orgao, ultimaAtualizacao: new Date() })
            .where(eq(clientesVinculo.id, vinculo.id));
        }
      }
    }

    // D8 Pensionista: só preenche campos vazios (merge suave)
    // D8 Servidor: atualiza normalmente
    const isPensionista = run.layoutD8 === "pensionista";

    // Soft merge para pessoa: preenche nome e uf apenas se NULL/vazio no DB
    // Aplica para AMBOS layouts (Servidor e Pensionista) - nunca sobrescreve dados existentes
    const nomeD8Raw = this.extractValue(row, headerMap, "nome");
    const ufD8Raw = this.extractValue(row, headerMap, "uf");
    const nomeD8 = nomeD8Raw ? String(nomeD8Raw).trim() : null;
    const ufD8 = ufD8Raw ? String(ufD8Raw).trim().toUpperCase() : null;

    if (vinculo.pessoaId && (nomeD8 || ufD8)) {
      // Buscar pessoa atual para verificar campos NULL/vazios
      const [pessoaAtual] = await db
        .select({ nome: clientesPessoa.nome, uf: clientesPessoa.uf })
        .from(clientesPessoa)
        .where(eq(clientesPessoa.id, vinculo.pessoaId))
        .limit(1);

      if (pessoaAtual) {
        const updateFields: Record<string, any> = {};

        // Nome: preenche se atual é NULL ou string vazia
        if (nomeD8 && nomeD8.length > 0) {
          const nomeAtual = pessoaAtual.nome?.trim() || "";
          if (nomeAtual.length === 0) {
            updateFields.nome = nomeD8;
          }
        }

        // UF: preenche se atual é NULL ou string vazia
        if (ufD8 && ufD8.length > 0 && ufD8.length <= 2) {
          const ufAtual = pessoaAtual.uf?.trim() || "";
          if (ufAtual.length === 0) {
            updateFields.uf = ufD8;
          }
        }

        // Só faz update se há campos para preencher
        if (Object.keys(updateFields).length > 0) {
          updateFields.atualizadoEm = new Date();
          await db
            .update(clientesPessoa)
            .set(updateFields)
            .where(eq(clientesPessoa.id, vinculo.pessoaId));
        }
      }
    }

    const extras: Record<string, any> = {};
    if (isPensionista) {
      // Campos específicos D8 Pensionista (14 colunas)
      extras.m_instituidor = preserveMatricula(this.extractValue(row, headerMap, "m_instituidor"));
      extras.ids = this.extractValue(row, headerMap, "ids") || null;
      extras.obs = this.extractValue(row, headerMap, "obs") || null;
      extras.regime_juridico = this.extractValue(row, headerMap, "regime_juridico") || null;
    }

    // PMT: usa pmt ou valor_parcela
    const pmtNumerico = this.extractValue(row, headerMap, "pmt");
    let valorParcela: number | null = null;
    
    if (pmtNumerico) {
      valorParcela = normalizeBrDecimal(pmtNumerico);
    }

    // Prazo: normaliza para 3 dígitos
    const prazoRemanRaw = this.extractValue(row, headerMap, "prazo_remanescente");
    const prazoRemanNorm = padPrazo(prazoRemanRaw);
    
    const parcelasRestantes = prazoRemanNorm 
      ? parseInt(prazoRemanNorm, 10) || null 
      : null;

    // Status: usa situacao_contrato (servidor) ou default "ATIVO" (pensionista não tem esse campo)
    const statusContrato = isPensionista 
      ? "ATIVO" 
      : (this.extractValue(row, headerMap, "situacao_contrato") || "ATIVO");

    const contratoData = {
      pessoaId: vinculo.pessoaId,
      vinculoId: vinculo.id, // Liga ao vínculo correto (cpf+matricula+orgao)
      banco,
      numeroContrato,
      tipoContrato: this.extractValue(row, headerMap, "tipo_contrato") || "consignado",
      valorParcela,
      parcelasRestantes,
      status: statusContrato,
      competencia: run.competencia,
      baseTag: run.baseTag,
      dadosBrutos: Object.keys(extras).length > 0 ? extras : null,
    };

    // D8 Pensionista: usa merge suave (só preenche campos NULL)
    // D8 Servidor: usa upsert normal (sobrescreve)
    if (isPensionista) {
      await this.upsertContratoSoftMerge(contratoData);
    } else {
      await this.upsertContrato(contratoData);
    }

    return true;
  }

  private async processContatosRow(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    run: ImportRun,
    errors: InsertImportError[]
  ): Promise<boolean> {
    const cpf = padCpf(this.extractValue(row, headerMap, "cpf"));

    if (!cpf) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf: null,
        matricula: null,
        errorType: "validation",
        errorMessage: "CPF ausente para contatos",
        rawPayload: row,
      });
      return false;
    }

    const pessoas = await db
      .select()
      .from(clientesPessoa)
      .where(
        and(
          run.tenantId ? eq(clientesPessoa.tenantId, run.tenantId) : sql`${clientesPessoa.tenantId} IS NULL`,
          eq(clientesPessoa.cpf, cpf)
        )
      )
      .limit(10);

    if (pessoas.length === 0) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf,
        matricula: null,
        errorType: "validation",
        errorMessage: "CPF não encontrado na base. Importe a folha primeiro.",
        rawPayload: row,
      });
      return false;
    }

    const telefones: string[] = [];
    for (let i = 1; i <= 5; i++) {
      const tel = this.extractValue(row, headerMap, `telefone_${i}`);
      if (tel && tel.trim()) {
        telefones.push(tel.trim().replace(/\D/g, ""));
      }
    }

    const emails: string[] = [];
    const email1 = this.extractValue(row, headerMap, "email");
    const email2 = this.extractValue(row, headerMap, "email_2");
    if (email1) emails.push(email1.trim().toLowerCase());
    if (email2) emails.push(email2.trim().toLowerCase());

    const uniqueTelefones = Array.from(new Set(telefones));
    const uniqueEmails = Array.from(new Set(emails));

    for (const pessoa of pessoas) {
      for (const tel of uniqueTelefones) {
        await this.upsertContact(pessoa.id, "telefone", tel);
      }
      for (const email of uniqueEmails) {
        await this.upsertContact(pessoa.id, "email", email);
      }
    }

    return true;
  }

  private async findOrCreateVinculo(
    cpf: string,
    matricula: string,
    run: ImportRun,
    pessoaId?: number,
    orgao?: string
  ): Promise<{ id: number; pessoaId: number | null } | null> {
    // ORGAO: normalizar como string, sem conversão numérica
    const orgaoNorm = orgao ? String(orgao).trim() : "DESCONHECIDO";
    
    const existing = await db
      .select()
      .from(clientesVinculo)
      .where(
        and(
          run.tenantId ? eq(clientesVinculo.tenantId, run.tenantId) : sql`${clientesVinculo.tenantId} IS NULL`,
          eq(clientesVinculo.cpf, cpf),
          eq(clientesVinculo.matricula, matricula),
          eq(clientesVinculo.orgao, orgaoNorm)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      if (pessoaId && !existing[0].pessoaId) {
        await db
          .update(clientesVinculo)
          .set({ pessoaId, ultimaAtualizacao: new Date() })
          .where(eq(clientesVinculo.id, existing[0].id));
        return { id: existing[0].id, pessoaId };
      }
      return { id: existing[0].id, pessoaId: existing[0].pessoaId };
    }

    // tenantId é obrigatório na tabela, usar 1 como fallback
    const tenantIdValue = run.tenantId || 1;
    
    const vinculoValues = {
      tenantId: tenantIdValue,
      cpf,
      matricula,
      orgao: orgaoNorm,
      pessoaId: pessoaId || null,
      convenio: run.convenio || null,
    };
    
    // Usar onConflictDoUpdate para upsert atômico - atualiza apenas pessoaId se estava NULL
    const [result] = await db
      .insert(clientesVinculo)
      .values(vinculoValues)
      .onConflictDoUpdate({
        target: [clientesVinculo.tenantId, clientesVinculo.cpf, clientesVinculo.matricula, clientesVinculo.orgao],
        set: {
          // Só atualiza pessoaId se o novo valor não é null e o existente é null
          pessoaId: sql`COALESCE(${clientesVinculo.pessoaId}, ${pessoaId || null})`,
          ultimaAtualizacao: new Date(),
        },
      })
      .returning();

    return { id: result.id, pessoaId: result.pessoaId };
  }

  private async upsertPessoa(data: Record<string, any>): Promise<{ id: number } | null> {
    const existing = await db
      .select()
      .from(clientesPessoa)
      .where(
        and(
          data.tenantId ? eq(clientesPessoa.tenantId, data.tenantId) : sql`${clientesPessoa.tenantId} IS NULL`,
          eq(clientesPessoa.matricula, data.matricula)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(clientesPessoa)
        .set({ ...data, atualizadoEm: new Date() })
        .where(eq(clientesPessoa.id, existing[0].id));
      return { id: existing[0].id };
    }

    // DEBUG: Log antes do INSERT para identificar ON CONFLICT
    console.log("[DEBUG INSERT] Tabela: clientes_pessoa");
    console.log("[DEBUG INSERT] Colunas:", Object.keys(data).join(", "));
    console.log("[DEBUG INSERT] Valores:", JSON.stringify(data));
    console.log("[DEBUG INSERT] Sem Unique Index explícito (usa matricula como lookup)");
    
    const [created] = await db
      .insert(clientesPessoa)
      .values(data as any)
      .returning();
    return { id: created.id };
  }

  private async upsertFolhaMes(
    pessoaId: number,
    competencia: Date,
    row: Record<string, any>,
    headerMap: Record<string, string>,
    baseTag: string | null
  ): Promise<void> {
    const existing = await db
      .select()
      .from(clientesFolhaMes)
      .where(
        and(
          eq(clientesFolhaMes.pessoaId, pessoaId),
          eq(clientesFolhaMes.competencia, competencia)
        )
      )
      .limit(1);

    // Verifica se é atualização - se sim, usa normalizeBrDecimalOrZero (vazio = 0)
    const isUpdate = existing.length > 0;
    const normalizeNum = isUpdate ? normalizeBrDecimalOrZero : normalizeBrDecimal;
    
    const folhaData: Record<string, any> = {
      pessoaId,
      competencia,
      baseTag,
      salarioBruto: normalizeNum(this.extractValue(row, headerMap, "salario_bruto")),
      descontosBrutos: normalizeNum(this.extractValue(row, headerMap, "descontos_brutos")),
      salarioLiquido: normalizeNum(this.extractValue(row, headerMap, "salario_liquido")),
      // Margem 5% (COLUMN_MAP mapeia margem_30 → margem_5 para retrocompatibilidade)
      margemBruta5: normalizeNum(this.extractValue(row, headerMap, "margem_5_bruta")),
      margemUtilizada5: normalizeNum(this.extractValue(row, headerMap, "margem_5_utilizada")),
      margemSaldo5: normalizeNum(this.extractValue(row, headerMap, "margem_5_saldo")),
      // Margem Benefício 5%
      margemBeneficioBruta5: normalizeNum(this.extractValue(row, headerMap, "margem_beneficio_5_bruta")),
      margemBeneficioUtilizada5: normalizeNum(this.extractValue(row, headerMap, "margem_beneficio_5_utilizada")),
      margemBeneficioSaldo5: normalizeNum(this.extractValue(row, headerMap, "margem_beneficio_5_saldo")),
      // Margem 35%
      margemBruta35: normalizeNum(this.extractValue(row, headerMap, "margem_35_bruta")),
      margemUtilizada35: normalizeNum(this.extractValue(row, headerMap, "margem_35_utilizada")),
      margemSaldo35: normalizeNum(this.extractValue(row, headerMap, "margem_35_saldo")),
      // Margem 70%
      margemBruta70: normalizeNum(this.extractValue(row, headerMap, "margem_70_bruta")),
      margemUtilizada70: normalizeNum(this.extractValue(row, headerMap, "margem_70_utilizada")),
      margemSaldo70: normalizeNum(this.extractValue(row, headerMap, "margem_70_saldo")),
      margemCartaoCreditoSaldo: normalizeNum(this.extractValue(row, headerMap, "margem_cartao_credito_saldo")),
      margemCartaoBeneficioSaldo: normalizeNum(this.extractValue(row, headerMap, "margem_cartao_beneficio_saldo")),
    };

    if (isUpdate) {
      console.log(`[FOLHA UPDATE] Atualizando folha para pessoa ${pessoaId}, competência ${competencia.toISOString().slice(0,10)}`);
      await db
        .update(clientesFolhaMes)
        .set(folhaData)
        .where(eq(clientesFolhaMes.id, existing[0].id));
    } else {
      // DEBUG: Log antes do INSERT para identificar ON CONFLICT
      console.log("[DEBUG INSERT] Tabela: clientes_folha_mes");
      console.log("[DEBUG INSERT] Colunas:", Object.keys(folhaData).join(", "));
      console.log("[DEBUG INSERT] Valores (resumo):", JSON.stringify({ pessoaId: folhaData.pessoaId, competencia: folhaData.competencia, baseTag: folhaData.baseTag }));
      console.log("[DEBUG INSERT] Unique Index: idx_folha_mes_vinculo_competencia (vinculoId, competencia) - MAS AQUI USA pessoaId!");
      
      await db.insert(clientesFolhaMes).values(folhaData as any);
    }
  }

  private async upsertContrato(data: Record<string, any>): Promise<void> {
    // Usar onConflictDoUpdate para upsert atômico
    // Em caso de conflito, atualiza campos permitidos (parcelas, valor, status) mas preserva dados existentes
    await db
      .insert(clientesContratos)
      .values(data as any)
      .onConflictDoUpdate({
        target: [clientesContratos.pessoaId, clientesContratos.banco, clientesContratos.numeroContrato],
        set: {
          // Atualiza campos que podem mudar entre importações
          valorParcela: sql`COALESCE(${data.valorParcela}, ${clientesContratos.valorParcela})`,
          parcelasRestantes: sql`COALESCE(${data.parcelasRestantes}, ${clientesContratos.parcelasRestantes})`,
          status: sql`COALESCE(${data.status}, ${clientesContratos.status})`,
          // Preserva tipo se já existia, senão usa novo
          tipoContrato: sql`COALESCE(${clientesContratos.tipoContrato}, ${data.tipoContrato})`,
          // Sempre atualiza rastreabilidade
          baseTag: data.baseTag || sql`${clientesContratos.baseTag}`,
          importRunId: data.importRunId || sql`${clientesContratos.importRunId}`,
          competencia: data.competencia || sql`${clientesContratos.competencia}`,
          dadosBrutos: data.dadosBrutos || sql`${clientesContratos.dadosBrutos}`,
        },
      });
  }

  /**
   * D8 Pensionista: Merge suave - só preenche campos NULL, nunca sobrescreve dados existentes
   * Chave de merge: (pessoaId + banco + numeroContrato)
   * Usa onConflictDoUpdate para upsert atômico sem race conditions
   */
  private async upsertContratoSoftMerge(data: Record<string, any>): Promise<void> {
    // Usar onConflictDoUpdate para upsert atômico
    // Soft merge: só preenche campos que estão NULL no registro existente
    await db
      .insert(clientesContratos)
      .values(data as any)
      .onConflictDoUpdate({
        target: [clientesContratos.pessoaId, clientesContratos.banco, clientesContratos.numeroContrato],
        set: {
          // Soft merge: preserva valores existentes, só preenche NULLs
          tipoContrato: sql`COALESCE(${clientesContratos.tipoContrato}, ${data.tipoContrato})`,
          valorParcela: sql`COALESCE(${clientesContratos.valorParcela}, ${data.valorParcela})`,
          parcelasRestantes: sql`COALESCE(${clientesContratos.parcelasRestantes}, ${data.parcelasRestantes})`,
          status: sql`COALESCE(${clientesContratos.status}, ${data.status})`,
          competencia: sql`COALESCE(${clientesContratos.competencia}, ${data.competencia})`,
          dadosBrutos: sql`COALESCE(${clientesContratos.dadosBrutos}, ${data.dadosBrutos}::jsonb)`,
          // Sempre atualiza rastreabilidade
          baseTag: data.baseTag || sql`${clientesContratos.baseTag}`,
          importRunId: data.importRunId || sql`${clientesContratos.importRunId}`,
        },
      });
  }

  private async upsertContact(clientId: number, tipo: string, valor: string): Promise<void> {
    // Verificar existência antes de inserir (sem unique index nesta tabela legada)
    const existing = await db
      .select({ id: clientContacts.id })
      .from(clientContacts)
      .where(
        and(
          eq(clientContacts.clientId, clientId),
          eq(clientContacts.tipo, tipo),
          eq(clientContacts.valor, valor)
        )
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(clientContacts).values({ clientId, tipo, valor });
    }
    // Se já existe, não faz nada (idempotente)
  }

  private async updateProgress(
    runId: number,
    processedRows: number,
    successRows: number,
    errorRows: number,
    offsetAtual: number
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
      .where(eq(importRuns.id, runId));
  }

  private async flushErrors(errors: InsertImportError[]): Promise<void> {
    if (errors.length === 0) return;
    await db.insert(importErrors).values(errors as any);
  }

  private async markError(runId: number, message: string): Promise<void> {
    await db
      .update(importRuns)
      .set({
        status: "erro",
        errorMessage: message,
        updatedAt: new Date(),
      })
      .where(eq(importRuns.id, runId));
  }

  async getImportStatus(runId: number): Promise<ImportRun | null> {
    const [run] = await db.select().from(importRuns).where(eq(importRuns.id, runId)).limit(1);
    return run || null;
  }

  async getImportErrors(runId: number, limit = 100, offset = 0): Promise<any[]> {
    return db
      .select()
      .from(importErrors)
      .where(eq(importErrors.importRunId, runId))
      .limit(limit)
      .offset(offset);
  }

  private extractValue(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    targetField: string
  ): string | null {
    for (const [col, field] of Object.entries(headerMap)) {
      if (field === targetField && row[col] !== undefined) {
        return String(row[col] || "").trim() || null;
      }
    }
    return null;
  }

  private buildHeaderMap(
    headers: string[],
    columnMap: Record<string, string>
  ): Record<string, string> {
    const map: Record<string, string> = {};
    for (const header of headers) {
      const normalized = normalizeCol(header);
      if (columnMap[normalized]) {
        map[header] = columnMap[normalized];
      }
    }
    return map;
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    const delimiter = line.includes(";") ? ";" : ",";

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
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
    const stats = fs.statSync(filePath);
    const sampleSize = Math.min(stats.size, 1024 * 1024);
    const sample = Buffer.alloc(sampleSize);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, sample, 0, sampleSize, 0);
    fs.closeSync(fd);

    const sampleStr = sample.toString("utf8");
    const lineCount = (sampleStr.match(/\n/g) || []).length;
    const avgLineSize = sampleSize / Math.max(lineCount, 1);

    return Math.ceil(stats.size / avgLineSize);
  }

  private generateBaseTag(options: StreamImportOptions): string {
    const parts: string[] = [];
    if (options.convenio) parts.push(options.convenio.toUpperCase().replace(/\s+/g, "_"));
    if (options.tipoImport) parts.push(options.tipoImport.toUpperCase());
    if (options.competencia) {
      const d = options.competencia;
      parts.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    if (options.banco) parts.push(options.banco.toUpperCase().replace(/\s+/g, "_"));
    parts.push(Date.now().toString(36));
    return parts.join("_");
  }
}

export const streamingImportService = new StreamingImportService();
