import * as fs from "fs";
import * as readline from "readline";
import * as path from "path";
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

const BATCH_INSERT_SIZE = 1000;
const MAX_LINHAS_POR_EXECUCAO = 500_000;
const MERGE_BATCH_SIZE = 5000;

export interface FastImportOptions {
  tipoImport: "folha" | "d8" | "contatos";
  competencia?: Date;
  banco?: string;
  layoutD8?: "servidor" | "pensionista";
  convenio?: string;
  tenantId?: number;
  createdById?: number;
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
}

const D8_COLUMN_MAP: Record<string, string> = {
  cpf: "cpf",
  matricula: "matricula",
  nome: "nome",
  banco: "banco",
  numero_contrato: "numero_contrato",
  n_contrato: "numero_contrato",
  tipo_contrato: "tipo_contrato",
  tipo_produto: "tipo_contrato",
  valor_parcela: "valor_parcela",
  pmt: "valor_parcela",
  saldo_devedor: "saldo_devedor",
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo_remanescente",
  prazo_total: "prazo_total",
  situacao_contrato: "situacao_contrato",
  data_inicio: "data_inicio",
  data_fim: "data_fim",
  m_instituidor: "m_instituidor",
  cpf_instituidor: "cpf_instituidor",
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

class FastImportService {
  async startFastImport(
    filePath: string,
    options: FastImportOptions
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
        chunkSize: BATCH_INSERT_SIZE,
        baseTag,
        convenio: options.convenio || null,
        maxLinhasExecucao: MAX_LINHAS_POR_EXECUCAO,
        createdById: options.createdById || null,
      })
      .returning();

    console.log(
      `[FastImport] Job ${importRun.id} created for ${options.tipoImport}, estimated ${totalEstimatedRows} rows`
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
      .set({ status: "processando", startedAt: new Date(), updatedAt: new Date() })
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
    const columnMap = this.getColumnMap(run.tipoImport);
    const headerMap = this.buildHeaderMap(headers, columnMap);
    
    const batchBuffer: any[] = [];
    
    const fileStream = fs.createReadStream(filePath, {
      start: startOffset,
      encoding: "utf8",
    });

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
          await this.updateProgress(run.id, run.processedRows + processedInThisRun, 0, run.errorRows + errorCount, bytesRead);
          console.log(`[FastImport] Staged ${run.processedRows + processedInThisRun} rows...`);
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

    await this.updateProgress(run.id, totalProcessed, 0, totalErrors, bytesRead);

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
      }

      // Registrar TODAS as linhas em import_run_rows ANTES de limpar staging
      await this.registerAllRows(run, tipoImport, mergedCount, errorCount);

      await this.cleanupStaging(run.id, tipoImport);

      // Calcular contadores reais a partir de import_run_rows
      const realCounts = await this.getRealRowCounts(run.id);

      await db
        .update(importRuns)
        .set({
          status: realCounts.errorRows > 0 && realCounts.successRows === 0 ? "erro" : 
                  realCounts.errorRows > 0 ? "concluido" : "concluido",
          processedRows: realCounts.totalRows,
          successRows: realCounts.successRows,
          errorRows: realCounts.errorRows,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(importRuns.id, run.id));

      console.log(`[FastImport] Merge complete: ${realCounts.successRows} OK, ${realCounts.errorRows} errors`);

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
    errorCount: number
  ): Promise<void> {
    console.log(`[FastImport] Registering all rows for run ${run.id}...`);
    
    const stagingTable = tipoImport === "folha" ? "staging_folha" : 
                         tipoImport === "d8" ? "staging_d8" : "staging_contatos";
    
    // Inserir todas as linhas válidas como 'ok'
    const okResult = await db.execute(sql`
      INSERT INTO import_run_rows (import_run_id, row_number, cpf, matricula, status, raw_data)
      SELECT 
        ${run.id},
        s.row_number,
        s.cpf,
        ${tipoImport === "contatos" ? sql`NULL` : sql`s.matricula`},
        'ok',
        row_to_json(s)
      FROM ${sql.raw(stagingTable)} s
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND (${tipoImport === "contatos" ? sql`TRUE` : sql`s.matricula IS NOT NULL AND s.matricula != ''`})
    `);

    // Inserir linhas inválidas como 'erro'
    const errorResult = await db.execute(sql`
      INSERT INTO import_run_rows (import_run_id, row_number, cpf, matricula, status, error_message, raw_data)
      SELECT 
        ${run.id},
        s.row_number,
        s.cpf,
        ${tipoImport === "contatos" ? sql`NULL` : sql`s.matricula`},
        'erro',
        CASE 
          WHEN s.cpf IS NULL OR s.cpf = '' THEN 'CPF inválido ou vazio'
          WHEN ${tipoImport !== "contatos"} AND (${tipoImport === "contatos" ? sql`FALSE` : sql`s.matricula IS NULL OR s.matricula = ''`}) THEN 'Matrícula inválida ou vazia'
          ELSE 'Dados incompletos'
        END,
        row_to_json(s)
      FROM ${sql.raw(stagingTable)} s
      WHERE s.import_run_id = ${run.id}
        AND (s.cpf IS NULL OR s.cpf = '' OR (${tipoImport !== "contatos"} AND ${tipoImport === "contatos" ? sql`FALSE` : sql`(s.matricula IS NULL OR s.matricula = '')`}))
    `);

    console.log(`[FastImport] Registered: ${okResult.rowCount || 0} ok, ${errorResult.rowCount || 0} errors`);
  }

  // Obter contadores reais de import_run_rows
  private async getRealRowCounts(importRunId: number): Promise<{ totalRows: number; successRows: number; errorRows: number }> {
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

  private async mergeFolha(run: ImportRun): Promise<{ merged: number; errors: number }> {
    const competencia = run.competencia || new Date();
    const convenio = run.convenio || "SIAPE";
    const tenantId = run.tenantId || null;
    const baseTag = run.baseTag || "";

    console.log(`[FastImport] Starting SQL-based merge for folha...`);

    const pessoaResult = await db.execute(sql`
      INSERT INTO clientes_pessoa (tenant_id, cpf, matricula, nome, orgaodesc, upag, uf, municipio, convenio, base_tag_ultima)
      SELECT DISTINCT ON (s.cpf)
        ${tenantId}::integer,
        s.cpf,
        s.matricula,
        s.nome,
        s.orgaodesc,
        s.upag,
        s.uf,
        s.municipio,
        ${convenio},
        ${baseTag}
      FROM staging_folha s
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.matricula IS NOT NULL AND s.matricula != ''
      ON CONFLICT (cpf) DO UPDATE SET
        nome = COALESCE(EXCLUDED.nome, clientes_pessoa.nome),
        orgaodesc = COALESCE(EXCLUDED.orgaodesc, clientes_pessoa.orgaodesc),
        upag = COALESCE(EXCLUDED.upag, clientes_pessoa.upag),
        uf = COALESCE(EXCLUDED.uf, clientes_pessoa.uf),
        municipio = COALESCE(EXCLUDED.municipio, clientes_pessoa.municipio),
        convenio = ${convenio},
        base_tag_ultima = ${baseTag},
        atualizado_em = NOW()
    `);

    console.log(`[FastImport] Pessoas upserted: ${pessoaResult.rowCount || 0}`);

    const vinculoResult = await db.execute(sql`
      INSERT INTO clientes_vinculo (cpf, matricula, convenio, pessoa_id)
      SELECT DISTINCT ON (s.cpf, s.matricula)
        s.cpf,
        s.matricula,
        ${convenio},
        p.id
      FROM staging_folha s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.matricula IS NOT NULL AND s.matricula != ''
      ON CONFLICT (cpf, matricula) DO UPDATE SET
        pessoa_id = COALESCE(EXCLUDED.pessoa_id, clientes_vinculo.pessoa_id),
        ultima_atualizacao = NOW()
    `);

    console.log(`[FastImport] Vinculos upserted: ${vinculoResult.rowCount || 0}`);

    const folhaResult = await db.execute(sql`
      INSERT INTO clientes_folha_mes (
        pessoa_id, competencia,
        margem_bruta_5, margem_utilizada_5, margem_saldo_5,
        margem_beneficio_bruta_5, margem_beneficio_utilizada_5, margem_beneficio_saldo_5,
        margem_bruta_35, margem_utilizada_35, margem_saldo_35,
        margem_bruta_70, margem_utilizada_70, margem_saldo_70,
        creditos, debitos, liquido, salario_bruto, salario_liquido,
        sit_func_no_mes, base_tag
      )
      SELECT DISTINCT ON (p.id)
        p.id,
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
        s.creditos::numeric,
        s.debitos::numeric,
        s.liquido::numeric,
        s.creditos::numeric,
        s.liquido::numeric,
        s.sit_func,
        ${baseTag}
      FROM staging_folha s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.matricula IS NOT NULL AND s.matricula != ''
      ON CONFLICT (pessoa_id, competencia) DO UPDATE SET
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
        creditos = COALESCE(EXCLUDED.creditos, clientes_folha_mes.creditos),
        debitos = COALESCE(EXCLUDED.debitos, clientes_folha_mes.debitos),
        liquido = COALESCE(EXCLUDED.liquido, clientes_folha_mes.liquido),
        base_tag = ${baseTag}
    `);

    console.log(`[FastImport] Folha upserted: ${folhaResult.rowCount || 0}`);

    const mergedCount = folhaResult.rowCount || 0;

    return { merged: mergedCount, errors: 0 };
  }

  private async mergeD8(run: ImportRun): Promise<{ merged: number; errors: number }> {
    const banco = run.banco || "DESCONHECIDO";
    const tenantId = run.tenantId || null;

    console.log(`[FastImport] Starting SQL-based merge for D8...`);

    const contratoResult = await db.execute(sql`
      INSERT INTO clientes_contratos (pessoa_id, banco, numero_contrato, tipo_contrato, valor_parcela, saldo_devedor, parcelas_restantes, prazo_total, situacao, data_inicio, data_fim)
      SELECT DISTINCT ON (p.id, s.numero_contrato)
        p.id,
        COALESCE(s.banco, ${banco}),
        s.numero_contrato,
        s.tipo_contrato,
        s.valor_parcela,
        s.saldo_devedor,
        s.prazo_remanescente,
        s.prazo_total,
        s.situacao_contrato,
        s.data_inicio,
        s.data_fim
      FROM staging_d8 s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.numero_contrato IS NOT NULL AND s.numero_contrato != ''
      ON CONFLICT (pessoa_id, numero_contrato) DO UPDATE SET
        banco = COALESCE(EXCLUDED.banco, clientes_contratos.banco),
        tipo_contrato = COALESCE(EXCLUDED.tipo_contrato, clientes_contratos.tipo_contrato),
        valor_parcela = COALESCE(EXCLUDED.valor_parcela, clientes_contratos.valor_parcela),
        saldo_devedor = COALESCE(EXCLUDED.saldo_devedor, clientes_contratos.saldo_devedor),
        parcelas_restantes = COALESCE(EXCLUDED.parcelas_restantes, clientes_contratos.parcelas_restantes),
        prazo_total = COALESCE(EXCLUDED.prazo_total, clientes_contratos.prazo_total),
        situacao = COALESCE(EXCLUDED.situacao, clientes_contratos.situacao),
        data_inicio = COALESCE(EXCLUDED.data_inicio, clientes_contratos.data_inicio),
        data_fim = COALESCE(EXCLUDED.data_fim, clientes_contratos.data_fim),
        atualizado_em = NOW()
    `);

    console.log(`[FastImport] Contratos upserted: ${contratoResult.rowCount || 0}`);

    return { merged: contratoResult.rowCount || 0, errors: 0 };
  }

  private async mergeContatos(run: ImportRun): Promise<{ merged: number; errors: number }> {
    console.log(`[FastImport] Starting SQL-based merge for contatos...`);

    const telefone1Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, tipo, valor)
      SELECT p.id, 'telefone', s.telefone_1
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_1 IS NOT NULL AND s.telefone_1 != ''
      ON CONFLICT (client_id, tipo, valor) DO NOTHING
    `);

    const telefone2Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, tipo, valor)
      SELECT p.id, 'telefone', s.telefone_2
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_2 IS NOT NULL AND s.telefone_2 != ''
      ON CONFLICT (client_id, tipo, valor) DO NOTHING
    `);

    const telefone3Result = await db.execute(sql`
      INSERT INTO client_contacts (client_id, tipo, valor)
      SELECT p.id, 'telefone', s.telefone_3
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.telefone_3 IS NOT NULL AND s.telefone_3 != ''
      ON CONFLICT (client_id, tipo, valor) DO NOTHING
    `);

    const emailResult = await db.execute(sql`
      INSERT INTO client_contacts (client_id, tipo, valor)
      SELECT p.id, 'email', s.email
      FROM staging_contatos s
      JOIN clientes_pessoa p ON p.cpf = s.cpf
      WHERE s.import_run_id = ${run.id}
        AND s.cpf IS NOT NULL AND s.cpf != ''
        AND s.email IS NOT NULL AND s.email != ''
      ON CONFLICT (client_id, tipo, valor) DO NOTHING
    `);

    const totalInserted = (telefone1Result.rowCount || 0) + (telefone2Result.rowCount || 0) + 
                          (telefone3Result.rowCount || 0) + (emailResult.rowCount || 0);

    console.log(`[FastImport] Contatos upserted: ${totalInserted}`);

    return { merged: totalInserted, errors: 0 };
  }

  private async cleanupStaging(importRunId: number, tipoImport: string): Promise<void> {
    switch (tipoImport) {
      case "folha":
        await db.delete(stagingFolha).where(eq(stagingFolha.importRunId, importRunId));
        break;
      case "d8":
        await db.delete(stagingD8).where(eq(stagingD8.importRunId, importRunId));
        break;
      case "contatos":
        await db.delete(stagingContatos).where(eq(stagingContatos.importRunId, importRunId));
        break;
    }
    console.log(`[FastImport] Cleaned up staging for run ${importRunId}`);
  }

  private mapToStagingRow(
    row: Record<string, any>,
    headerMap: Record<string, string>,
    run: ImportRun,
    rowNum: number
  ): any | null {
    const tipoImport = run.tipoImport;
    const getValue = (field: string) => {
      const col = headerMap[field];
      return col ? row[col] : null;
    };
    const parseNum = (val: any): number | null => {
      if (!val) return null;
      const n = normalizeBrDecimal(String(val));
      return (n === null || isNaN(n)) ? null : n;
    };

    if (tipoImport === "folha") {
      return {
        importRunId: run.id,
        cpf: padCpf(getValue("cpf")),
        matricula: preserveMatricula(getValue("matricula")),
        nome: getValue("nome") || null,
        orgaodesc: getValue("orgaodesc") || null,
        upag: padUpag(getValue("upag")),
        uf: getValue("uf") || null,
        municipio: getValue("municipio") || null,
        baseCalc: parseNum(getValue("base_calc")),
        margem5Bruta: parseNum(getValue("margem_5_bruta")),
        margem5Utilizada: parseNum(getValue("margem_5_utilizada")),
        margem5Saldo: parseNum(getValue("margem_5_saldo")),
        margemBeneficio5Bruta: parseNum(getValue("margem_beneficio_5_bruta")),
        margemBeneficio5Utilizada: parseNum(getValue("margem_beneficio_5_utilizada")),
        margemBeneficio5Saldo: parseNum(getValue("margem_beneficio_5_saldo")),
        margem35Bruta: parseNum(getValue("margem_35_bruta")),
        margem35Utilizada: parseNum(getValue("margem_35_utilizada")),
        margem35Saldo: parseNum(getValue("margem_35_saldo")),
        margem70Bruta: parseNum(getValue("margem_70_bruta")),
        margem70Utilizada: parseNum(getValue("margem_70_utilizada")),
        margem70Saldo: parseNum(getValue("margem_70_saldo")),
        creditos: parseNum(getValue("creditos")),
        debitos: parseNum(getValue("debitos")),
        liquido: parseNum(getValue("liquido")),
        excQtd: parseInt(getValue("exc_qtd") || "0", 10) || null,
        excSoma: parseNum(getValue("exc_soma")),
        rjur: getValue("rjur") || null,
        sitFunc: getValue("sit_func") || null,
        margem: parseNum(getValue("margem")),
        instituidor: getValue("instituidor") || null,
        rowNum,
      };
    } else if (tipoImport === "d8") {
      return {
        importRunId: run.id,
        cpf: padCpf(getValue("cpf")),
        matricula: preserveMatricula(getValue("matricula")),
        nome: getValue("nome") || null,
        banco: getValue("banco") || run.banco || null,
        numeroContrato: preserveNumeroContrato(getValue("numero_contrato")),
        tipoContrato: getValue("tipo_contrato") || null,
        valorParcela: parseNum(getValue("valor_parcela")),
        saldoDevedor: parseNum(getValue("saldo_devedor")),
        prazoRemanescente: parseInt(getValue("prazo_remanescente") || "0", 10) || null,
        prazoTotal: parseInt(getValue("prazo_total") || "0", 10) || null,
        situacaoContrato: getValue("situacao_contrato") || null,
        dataInicio: getValue("data_inicio") || null,
        dataFim: getValue("data_fim") || null,
        mInstituidor: getValue("m_instituidor") || null,
        cpfInstituidor: padCpf(getValue("cpf_instituidor")),
        rowNum,
      };
    } else if (tipoImport === "contatos") {
      return {
        importRunId: run.id,
        cpf: padCpf(getValue("cpf")),
        telefone1: getValue("telefone_1") || null,
        telefone2: getValue("telefone_2") || null,
        telefone3: getValue("telefone_3") || null,
        telefone4: getValue("telefone_4") || null,
        telefone5: getValue("telefone_5") || null,
        email: getValue("email") || null,
        email2: getValue("email_2") || null,
        endereco: getValue("endereco") || null,
        cidade: getValue("cidade") || null,
        uf: getValue("uf") || null,
        cep: getValue("cep") || null,
        rowNum,
      };
    }

    return null;
  }

  private async insertStagingBatch(tipoImport: string, batch: any[]): Promise<void> {
    if (batch.length === 0) return;

    switch (tipoImport) {
      case "folha":
        await db.insert(stagingFolha).values(batch);
        break;
      case "d8":
        await db.insert(stagingD8).values(batch);
        break;
      case "contatos":
        await db.insert(stagingContatos).values(batch);
        break;
    }
  }

  private getColumnMap(tipoImport: string): Record<string, string> {
    switch (tipoImport) {
      case "folha":
        return COLUMN_MAP;
      case "d8":
        return D8_COLUMN_MAP;
      case "contatos":
        return CONTATOS_COLUMN_MAP;
      default:
        return COLUMN_MAP;
    }
  }

  private async readHeaders(filePath: string): Promise<string[]> {
    const stream = fs.createReadStream(filePath, { start: 0, end: 20000, encoding: "utf8" });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
    
    let headers: string[] = [];
    for await (const line of rl) {
      headers = this.parseCSVLine(line);
      break;
    }
    
    rl.close();
    stream.destroy();
    return headers;
  }

  private buildHeaderMap(headers: string[], columnMap: Record<string, string>): Record<string, string> {
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
      const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
      
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
    return `${year}${month}${options.tipoImport.substring(0, 2)}`;
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
