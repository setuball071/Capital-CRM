import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
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
  COLUMN_MAP,
} from "./import-service";

const MAX_LINHAS_POR_EXECUCAO = 1_000_000;
const BUFFER_SIZE = 100_000;

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
  matricula: "matricula",
  nome: "nome",
  banco: "banco",
  numero_contrato: "numero_contrato",
  n_contrato: "numero_contrato",
  tipo_contrato: "tipo_contrato",
  tipo_produto: "tipo_contrato",
  valor_parcela: "valor_parcela",
  pmt: "pmt",
  pmt_fmt: "pmt_fmt",
  saldo_devedor: "saldo_devedor",
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo",
  prazo_total: "prazo",
  situacao_contrato: "situacao_contrato",
  data_inicio: "data_inicio",
  data_fim: "data_fim",
};

const D8_COLUMN_MAP_PENSIONISTA: Record<string, string> = {
  ...D8_COLUMN_MAP_SERVIDOR,
  m_instituidor: "m_instituidor",
  cpf_instituidor: "cpf_instituidor",
  matricula_instituidor: "matricula_instituidor",
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
    const columnMap =
      run.layoutD8 === "pensionista"
        ? D8_COLUMN_MAP_PENSIONISTA
        : D8_COLUMN_MAP_SERVIDOR;

    return this.processGenericStream(run, columnMap, async (row, headerMap, errors) => {
      return this.processD8Row(row, headerMap, run, errors);
    });
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

    const headerFirstLineStream = fs.createReadStream(filePath, {
      start: 0,
      end: 20000,
      encoding: "utf8",
    });
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
    headerFirstLineStream.destroy();

    const fileStream = fs.createReadStream(filePath, {
      start: startOffset,
      encoding: "utf8",
    });

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
    fileStream.destroy();

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
          offsetAtual: lastByteOffset,
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

    let vinculo: { id: number; pessoaId: number | null } | null = await this.findOrCreateVinculo(cpf, matricula, run);
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

      vinculo = await this.findOrCreateVinculo(cpf, matricula, run, pessoa.id);
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

    if (!cpf || !matricula) {
      errors.push({
        importRunId: run.id,
        rowNumber: run.processedRows + 1,
        cpf,
        matricula,
        errorType: "validation",
        errorMessage: "CPF ou matrícula ausente para D8",
        rawPayload: row,
      });
      return false;
    }

    const vinculo = await this.findOrCreateVinculo(cpf, matricula, run);
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

    // D8 contém nome do cliente - atualizar pessoa se nome estiver disponível e não vazio
    const nomeD8 = this.extractValue(row, headerMap, "nome");
    if (nomeD8 && nomeD8.trim().length > 0 && vinculo.pessoaId) {
      await db
        .update(clientesPessoa)
        .set({ nome: nomeD8.trim(), atualizadoEm: new Date() })
        .where(eq(clientesPessoa.id, vinculo.pessoaId));
    }

    const extras: Record<string, any> = {};
    if (run.layoutD8 === "pensionista") {
      extras.m_instituidor = preserveMatricula(this.extractValue(row, headerMap, "m_instituidor"));
      extras.cpf_instituidor = padCpf(this.extractValue(row, headerMap, "cpf_instituidor"));
      extras.matricula_instituidor = preserveMatricula(this.extractValue(row, headerMap, "matricula_instituidor"));
    }

    // PMT: pmt_fmt (texto) tem prioridade sobre pmt (número)
    const pmtFmt = this.extractValue(row, headerMap, "pmt_fmt");
    const pmtNumerico = this.extractValue(row, headerMap, "pmt");
    const valorParcelaRaw = this.extractValue(row, headerMap, "valor_parcela");
    let valorParcela: number | null = null;
    
    if (pmtFmt && pmtFmt.trim().length > 0) {
      valorParcela = normalizeBrDecimal(pmtFmt);
    } else if (pmtNumerico) {
      valorParcela = normalizeBrDecimal(pmtNumerico);
    } else if (valorParcelaRaw) {
      valorParcela = normalizeBrDecimal(valorParcelaRaw);
    }

    // Prazo: normaliza para 3 dígitos
    const prazoRaw = this.extractValue(row, headerMap, "prazo");
    const prazoRemanRaw = this.extractValue(row, headerMap, "prazo_remanescente");
    const prazoNorm = padPrazo(prazoRaw);
    const prazoRemanNorm = padPrazo(prazoRemanRaw);
    
    const parcelasRestantes = prazoRemanNorm 
      ? parseInt(prazoRemanNorm, 10) || null 
      : (prazoNorm ? parseInt(prazoNorm, 10) || null : null);

    await this.upsertContrato({
      pessoaId: vinculo.pessoaId,
      banco,
      numeroContrato,
      tipoContrato: this.extractValue(row, headerMap, "tipo_contrato") || "consignado",
      valorParcela,
      saldoDevedor: normalizeBrDecimal(this.extractValue(row, headerMap, "saldo_devedor")),
      parcelasRestantes,
      status: this.extractValue(row, headerMap, "situacao_contrato") || "ATIVO",
      competencia: run.competencia,
      baseTag: run.baseTag,
      dadosBrutos: extras.m_instituidor ? extras : null,
    });

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
    pessoaId?: number
  ): Promise<{ id: number; pessoaId: number | null } | null> {
    const existing = await db
      .select()
      .from(clientesVinculo)
      .where(
        and(
          run.tenantId ? eq(clientesVinculo.tenantId, run.tenantId) : sql`${clientesVinculo.tenantId} IS NULL`,
          eq(clientesVinculo.cpf, cpf),
          eq(clientesVinculo.matricula, matricula)
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

    const [created] = await db
      .insert(clientesVinculo)
      .values({
        tenantId: run.tenantId || null,
        cpf,
        matricula,
        pessoaId: pessoaId || null,
        convenio: run.convenio || null,
      })
      .returning();

    return { id: created.id, pessoaId: created.pessoaId };
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

    const folhaData: Record<string, any> = {
      pessoaId,
      competencia,
      baseTag,
      salarioBruto: normalizeBrDecimal(this.extractValue(row, headerMap, "salario_bruto")),
      descontosBrutos: normalizeBrDecimal(this.extractValue(row, headerMap, "descontos_brutos")),
      salarioLiquido: normalizeBrDecimal(this.extractValue(row, headerMap, "salario_liquido")),
      margemBruta30: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_30_bruta")),
      margemUtilizada30: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_30_utilizada")),
      margemSaldo30: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_30_saldo")),
      margemBruta35: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_35_bruta")),
      margemUtilizada35: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_35_utilizada")),
      margemSaldo35: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_35_saldo")),
      margemBruta70: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_70_bruta")),
      margemUtilizada70: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_70_utilizada")),
      margemSaldo70: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_70_saldo")),
      margemCartaoCreditoSaldo: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_cartao_credito_saldo")),
      margemCartaoBeneficioSaldo: normalizeBrDecimal(this.extractValue(row, headerMap, "margem_cartao_beneficio_saldo")),
    };

    if (existing.length > 0) {
      await db
        .update(clientesFolhaMes)
        .set(folhaData)
        .where(eq(clientesFolhaMes.id, existing[0].id));
    } else {
      await db.insert(clientesFolhaMes).values(folhaData as any);
    }
  }

  private async upsertContrato(data: Record<string, any>): Promise<void> {
    if (data.numeroContrato && data.banco) {
      const existing = await db
        .select()
        .from(clientesContratos)
        .where(
          and(
            eq(clientesContratos.pessoaId, data.pessoaId),
            eq(clientesContratos.banco, data.banco),
            eq(clientesContratos.numeroContrato, data.numeroContrato)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(clientesContratos)
          .set(data)
          .where(eq(clientesContratos.id, existing[0].id));
        return;
      }
    }

    await db.insert(clientesContratos).values(data as any);
  }

  private async upsertContact(clientId: number, tipo: string, valor: string): Promise<void> {
    const existing = await db
      .select()
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
