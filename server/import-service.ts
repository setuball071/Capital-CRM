import { db } from "./storage";
import { 
  importRuns, importErrors, clientesPessoa, clientesFolhaMes, 
  clientesContratos, basesImportadas, 
  type ImportRun, type InsertImportError 
} from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

// COLUMN_MAP: Mapeamento de headers do XLSX para campos internos
// Headers canônicos do modelo: Orgão, Matricula, Base Calc, Bruta 5%, Utilz 5%, Saldo 5%, 
// Beneficio Bruta 5%, Beneficio Utilizado 5%, Beneficio Saldo 5%, Bruta 35%, Utilz 35%, Saldo 35%, 
// Bruta 70%, Utilz 70%, Saldo 70%, Créditos, Débitos, Líquido, ARQ. UPAG, EXC QTD, EXC Soma, RJUR, Sit Func, CPF, Margem
export const COLUMN_MAP: Record<string, string> = {
  // === CAMPOS BÁSICOS (Headers: "CPF", "Matricula", "Orgão") ===
  cpf: "cpf",
  matricula: "matricula",
  nome: "nome",
  orgao: "orgaodesc",
  orgaodesc: "orgaodesc",
  uf: "uf",
  municipio: "municipio",
  
  // === SITUAÇÃO FUNCIONAL (Header: "Sit Func") ===
  situacao_funcional: "sit_func",
  sit_func: "sit_func",
  sitfunc: "sit_func",
  
  data_nascimento: "data_nascimento",
  idade: "idade",
  telefone_1: "telefone_1",
  telefone_2: "telefone_2",
  telefone_3: "telefone_3",
  telefone_4: "telefone_4",
  telefone_5: "telefone_5",
  email: "email",
  banco_salario: "banco_salario",
  agencia_salario: "agencia_salario",
  conta_salario: "conta_salario",
  
  // === UPAG (Header: "ARQ. UPAG") - sinônimos expandidos ===
  upag: "upag",
  arq_upag: "upag",
  arqupag: "upag",
  arq__upag: "upag",
  arq_upag_: "upag", // "ARQ. UPAG" normalizado com trailing
  
  // === RJUR (Header: "RJUR") ===
  rejur: "rjur",
  rjur: "rjur",
  regime_juridico: "rjur",
  
  // === SALÁRIO/RENDIMENTOS (Headers: "Créditos", "Débitos", "Líquido") ===
  creditos: "creditos",
  credito: "creditos",
  debitos: "debitos",
  debito: "debitos",
  liquido: "liquido",
  
  // === SALÁRIO ADICIONAL (Headers: "Salário Bruto", "Descontos Brutos", "Salário Líquido") ===
  // Estes são ALIASES que mapeiam para os mesmos campos creditos/debitos/liquido
  salario_bruto: "creditos",
  salariobruto: "creditos",
  descontos_brutos: "debitos",
  descontosbrutos: "debitos",
  salario_liquido: "liquido",
  salarioliquido: "liquido",
  
  competencia_folha: "competencia_folha",
  
  // === MARGEM 70% (Headers: "Bruta 70%", "Utilz 70%", "Saldo 70%") ===
  margem_70_bruta: "margem_70_bruta",
  margem_70_utilizada: "margem_70_utilizada",
  margem_70_saldo: "margem_70_saldo",
  bruta_70: "margem_70_bruta",
  bruta_70_: "margem_70_bruta",
  utiliz_70: "margem_70_utilizada",
  utilz_70: "margem_70_utilizada",
  utilz_70_: "margem_70_utilizada",
  saldo_70: "margem_70_saldo",
  saldo_70_: "margem_70_saldo",
  
  // === MARGEM 35% (Headers: "Bruta 35%", "Utilz 35%", "Saldo 35%") ===
  margem_35_bruta: "margem_35_bruta",
  margem_35_utilizada: "margem_35_utilizada",
  margem_35_saldo: "margem_35_saldo",
  bruta_35: "margem_35_bruta",
  bruta_35_: "margem_35_bruta",
  utiliz_35: "margem_35_utilizada",
  utilz_35: "margem_35_utilizada",
  utilz_35_: "margem_35_utilizada",
  saldo_35: "margem_35_saldo",
  saldo_35_: "margem_35_saldo",
  
  // === MARGEM 5% (Headers: "Bruta 5%", "Utilz 5%", "Saldo 5%") ===
  margem_5_bruta: "margem_5_bruta",
  margem_5_utilizada: "margem_5_utilizada",
  margem_5_saldo: "margem_5_saldo",
  bruta_5: "margem_5_bruta",
  bruta_5_: "margem_5_bruta",
  utiliz_5: "margem_5_utilizada",
  utilz_5: "margem_5_utilizada",
  utilz_5_: "margem_5_utilizada",
  saldo_5: "margem_5_saldo",
  saldo_5_: "margem_5_saldo",
  // Alias MARGEM_30 → MARGEM_5 (retrocompatibilidade)
  margem_30_bruta: "margem_5_bruta",
  margem_30_utilizada: "margem_5_utilizada",
  margem_30_saldo: "margem_5_saldo",
  
  // === MARGEM BENEFÍCIO 5% (Headers: "Beneficio Bruta 5%", "Beneficio Utilizado 5%", "Beneficio Saldo 5%") ===
  margem_beneficio_5_bruta: "margem_beneficio_5_bruta",
  margem_beneficio_5_utilizada: "margem_beneficio_5_utilizada",
  margem_beneficio_5_saldo: "margem_beneficio_5_saldo",
  beneficio_bruta_5: "margem_beneficio_5_bruta",
  beneficio_bruta_5_: "margem_beneficio_5_bruta",
  beneficio_utilizado_5: "margem_beneficio_5_utilizada",
  beneficio_utilizado_5_: "margem_beneficio_5_utilizada",
  beneficio_saldo_5: "margem_beneficio_5_saldo",
  beneficio_saldo_5_: "margem_beneficio_5_saldo",
  
  // === CARTÃO (Campos legados) ===
  margem_cartao_credito_bruta: "margem_cartao_credito_bruta",
  margem_cartao_credito_utilizada: "margem_cartao_credito_utilizada",
  margem_cartao_credito_saldo: "margem_cartao_credito_saldo",
  margem_cartao_beneficio_bruta: "margem_cartao_beneficio_bruta",
  margem_cartao_beneficio_utilizada: "margem_cartao_beneficio_utilizada",
  margem_cartao_beneficio_saldo: "margem_cartao_beneficio_saldo",
  
  // === BASE DE CÁLCULO (Header: "Base Calc") ===
  base_calc: "base_calc",
  base_calculo: "base_calc",
  basecalc: "base_calc",
  
  // === EXCLUSÕES (Headers: "EXC QTD", "EXC Soma") ===
  exc_qtd: "exc_qtd",
  exc_soma: "exc_soma",
  excqtd: "exc_qtd",
  excsoma: "exc_soma",
  
  // === MARGEM GERAL (Header: "Margem") ===
  margem: "margem",
  
  // === INSTITUIDOR (pensionista) ===
  instituidor: "instituidor",
  
  // === CAMPOS D8/CONTRATOS ===
  banco_emprestimo: "banco_emprestimo",
  tipo_produto: "tipo_produto",
  valor_parcela: "valor_parcela",
  pmt: "valor_parcela",
  saldo_devedor: "saldo_devedor",
  prazo_remanescente: "prazo_remanescente",
  prazo: "prazo_remanescente",
  numero_contrato: "numero_contrato",
  situacao_contrato: "situacao_contrato",
  competencia_contrato: "competencia_contrato",
};

export function normalizeCol(col: string): string {
  return col
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export function padCpf(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).replace(/\D/g, "").trim();
  if (str.length === 0) return null;
  return str.padStart(11, "0");
}

export function padUpag(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).replace(/\D/g, "").trim();
  if (str.length === 0) return null;
  // Remove zeros à esquerda para normalizar (947 em vez de 000000947)
  // Mantém pelo menos 1 caractere (para o caso de UPAG = "0")
  return str.replace(/^0+/, "") || "0";
}

export function padPrazo(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  const str = String(value).replace(/\D/g, "").trim();
  if (str.length === 0) return null;
  return str.padStart(3, "0");
}

export function preserveMatricula(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

export function preserveNumeroContrato(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === "") return null;
  return String(value).trim();
}

export function normalizeBrDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  
  // Se já for número, retorna direto
  if (typeof value === "number") return isNaN(value) ? null : value;
  
  let str = String(value).trim();
  if (str.length === 0) return null;
  
  // Remove prefixos de moeda (R$, $, etc) e espaços
  str = str.replace(/^[R$\s]+/i, "").trim();
  if (str.length === 0) return null;
  
  // Detecta formato brasileiro completo: 1.234,56
  const hasBrFormat = /^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(str);
  
  if (hasBrFormat) {
    // Formato brasileiro: remove pontos de milhar e troca vírgula por ponto
    str = str.replace(/\./g, "").replace(",", ".");
  } else {
    // Formato simples ou americano: apenas troca vírgula por ponto
    str = str.replace(/,/g, ".");
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? null : num;
}

/**
 * Similar a normalizeBrDecimal, mas retorna 0 em vez de null para valores vazios.
 * Útil para atualizações de folha onde vazio significa "zerado".
 */
export function normalizeBrDecimalOrZero(value: string | number | null | undefined): number {
  const result = normalizeBrDecimal(value);
  return result === null ? 0 : result;
}

export function normalizePmtRaw(value: string | null | undefined): { pmtValue: number | null; pmtRaw: string | null } {
  if (value === null || value === undefined || value === "") {
    return { pmtValue: null, pmtRaw: null };
  }
  
  const pmtRaw = String(value).trim();
  const pmtValue = normalizeBrDecimal(value);
  
  return { pmtValue, pmtRaw };
}

export function parseDate(value: any): Date | null {
  if (!value) return null;
  
  const str = String(value).trim();
  if (!str) return null;
  
  const brDate = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(str);
  if (brDate) {
    const [, day, month, year] = brDate;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  const isoDate = /^(\d{4})-(\d{2})-(\d{2})/.exec(str);
  if (isoDate) {
    return new Date(str);
  }
  
  const excelSerial = parseFloat(str);
  if (!isNaN(excelSerial) && excelSerial > 1 && excelSerial < 100000) {
    const excelEpoch = new Date(1899, 11, 30);
    return new Date(excelEpoch.getTime() + excelSerial * 24 * 60 * 60 * 1000);
  }
  
  return null;
}

export interface ImportJobConfig {
  tenantId: number | null;
  tipoImport: string;
  convenio: string;
  competencia: Date;
  baseTag: string;
  arquivoOrigem: string;
  arquivoTamanhoBytes: number;
  chunkSize?: number;
  createdById: number;
}

export interface ImportProgress {
  importRunId: number;
  status: string;
  processedRows: number;
  totalRows: number;
  successRows: number;
  errorRows: number;
  currentChunk: number;
  percentComplete: number;
}

export class ImportService {
  private defaultChunkSize = 10000;

  async createImportRun(config: ImportJobConfig): Promise<ImportRun> {
    const [run] = await db.insert(importRuns).values({
      tenantId: config.tenantId,
      tipoImport: config.tipoImport,
      convenio: config.convenio,
      competencia: config.competencia,
      baseTag: config.baseTag,
      arquivoOrigem: config.arquivoOrigem,
      arquivoTamanhoBytes: config.arquivoTamanhoBytes,
      chunkSize: config.chunkSize || this.defaultChunkSize,
      createdById: config.createdById,
      status: "pendente",
    }).returning();
    
    return run;
  }

  async updateImportRunProgress(
    runId: number, 
    processedRows: number, 
    successRows: number, 
    errorRows: number,
    currentChunk: number,
    status?: string
  ): Promise<void> {
    const updates: Record<string, any> = {
      processedRows,
      successRows,
      errorRows,
      currentChunk,
      updatedAt: new Date(),
    };
    
    if (status) {
      updates.status = status;
      if (status === "processando" && !updates.startedAt) {
        updates.startedAt = new Date();
      }
      if (status === "concluido" || status === "erro") {
        updates.completedAt = new Date();
      }
    }
    
    await db.update(importRuns)
      .set(updates)
      .where(eq(importRuns.id, runId));
  }

  async setImportRunTotal(runId: number, totalRows: number): Promise<void> {
    await db.update(importRuns)
      .set({ totalRows, status: "processando", startedAt: new Date(), updatedAt: new Date() })
      .where(eq(importRuns.id, runId));
  }

  async getImportRun(runId: number): Promise<ImportRun | undefined> {
    const [run] = await db.select().from(importRuns).where(eq(importRuns.id, runId));
    return run;
  }

  async recordError(error: InsertImportError): Promise<void> {
    await db.insert(importErrors).values(error);
  }

  async recordErrors(errors: InsertImportError[]): Promise<void> {
    if (errors.length === 0) return;
    await db.insert(importErrors).values(errors);
  }

  async getImportProgress(runId: number): Promise<ImportProgress | null> {
    const run = await this.getImportRun(runId);
    if (!run) return null;
    
    const percentComplete = run.totalRows > 0 
      ? Math.round((run.processedRows / run.totalRows) * 100) 
      : 0;
    
    return {
      importRunId: run.id,
      status: run.status,
      processedRows: run.processedRows,
      totalRows: run.totalRows,
      successRows: run.successRows,
      errorRows: run.errorRows,
      currentChunk: run.currentChunk,
      percentComplete,
    };
  }

  async getImportErrors(runId: number, limit = 100, offset = 0): Promise<any[]> {
    return await db.select()
      .from(importErrors)
      .where(eq(importErrors.importRunId, runId))
      .limit(limit)
      .offset(offset);
  }

  async processChunk(
    data: any[],
    run: ImportRun,
    headerMap: Record<string, string>,
    startIndex: number
  ): Promise<{ successCount: number; errorCount: number; errors: InsertImportError[] }> {
    let successCount = 0;
    let errorCount = 0;
    const errors: InsertImportError[] = [];
    const competenciaDate = run.competencia || new Date();
    const baseTag = run.baseTag || "";
    const convenio = run.convenio || "";

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNumber = startIndex + i + 1;
      
      try {
        let matricula: string | null = null;
        let cpf: string | null = null;
        
        for (const [col, field] of Object.entries(headerMap)) {
          if (field === "matricula") {
            matricula = preserveMatricula(row[col]);
          }
          if (field === "cpf") {
            cpf = padCpf(row[col]);
          }
        }
        
        if (!matricula) {
          errors.push({
            importRunId: run.id,
            rowNumber,
            cpf,
            matricula,
            errorType: "validation",
            errorMessage: "Matrícula é obrigatória",
            rawPayload: row,
          });
          errorCount++;
          continue;
        }
        
        const pessoaData: Record<string, any> = {
          tenantId: run.tenantId,
          matricula,
          cpf,
          convenio,
          baseTagUltima: baseTag,
        };
        
        const folhaData: Record<string, any> = {
          competencia: competenciaDate,
          baseTag,
        };
        
        const contratoData: Record<string, any> = {
          competencia: competenciaDate,
          baseTag,
        };
        
        const telefones: string[] = [];
        
        for (const [col, value] of Object.entries(row)) {
          const field = headerMap[col];
          if (!field) continue;
          
          if (field === "nome") {
            pessoaData.nome = String(value || "").trim() || null;
          } else if (field === "orgaodesc") {
            pessoaData.orgaodesc = String(value || "").trim() || null;
          } else if (field === "sit_func") {
            pessoaData.sitFunc = String(value || "").trim() || null;
          } else if (field === "uf") {
            pessoaData.uf = String(value || "").trim() || null;
          } else if (field === "municipio") {
            pessoaData.municipio = String(value || "").trim() || null;
          } else if (field === "upag") {
            pessoaData.upag = padUpag(value as string | number | null);
          } else if (field === "banco_salario") {
            pessoaData.bancoCodigo = String(value || "").trim() || null;
          } else if (field === "agencia_salario") {
            pessoaData.agencia = String(value || "").trim() || null;
          } else if (field === "conta_salario") {
            pessoaData.conta = String(value || "").trim() || null;
          } else if (field === "data_nascimento") {
            pessoaData.dataNascimento = parseDate(value);
          } else if (field === "salario_bruto") {
            folhaData.salarioBruto = normalizeBrDecimal(value as any);
          } else if (field === "descontos_brutos") {
            folhaData.descontosBrutos = normalizeBrDecimal(value as any);
          } else if (field === "salario_liquido") {
            folhaData.salarioLiquido = normalizeBrDecimal(value as any);
          } else if (field.startsWith("margem_")) {
            const camelField = field.split("_").map((p, i) => 
              i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1)
            ).join("");
            folhaData[camelField] = normalizeBrDecimal(value as string | number | null);
          } else if (field.startsWith("telefone_")) {
            const tel = String(value || "").trim();
            if (tel) telefones.push(tel);
          } else if (field === "banco_emprestimo") {
            contratoData.banco = String(value || "").trim() || null;
          } else if (field === "valor_parcela") {
            contratoData.valorParcela = normalizeBrDecimal(value as any);
          } else if (field === "saldo_devedor") {
            contratoData.saldoDevedor = normalizeBrDecimal(value as any);
          } else if (field === "prazo_remanescente") {
            const prazoNum = parseInt(String(value || "0"), 10);
            contratoData.parcelasRestantes = isNaN(prazoNum) ? null : prazoNum;
          } else if (field === "numero_contrato") {
            contratoData.numeroContrato = preserveNumeroContrato(value as string | number | null);
          } else if (field === "tipo_produto") {
            contratoData.tipoContrato = String(value || "").trim() || null;
          }
        }
        
        pessoaData.telefonesBase = telefones;
        
        let pessoa = await this.upsertPessoa(pessoaData, convenio);
        
        if (pessoa) {
          await this.createFolhaMes(pessoa.id, folhaData);
          
          if (contratoData.banco || contratoData.valorParcela || contratoData.numeroContrato) {
            await this.upsertContrato(pessoa.id, contratoData);
          }
          
          successCount++;
        } else {
          errors.push({
            importRunId: run.id,
            rowNumber,
            cpf,
            matricula,
            errorType: "database",
            errorMessage: "Falha ao criar/atualizar pessoa",
            rawPayload: row,
          });
          errorCount++;
        }
        
      } catch (err: any) {
        const cpfRow = Object.entries(headerMap).find(([, f]) => f === "cpf")?.[0];
        const matRow = Object.entries(headerMap).find(([, f]) => f === "matricula")?.[0];
        
        errors.push({
          importRunId: run.id,
          rowNumber,
          cpf: cpfRow ? padCpf(row[cpfRow] as string | number | null) : null,
          matricula: matRow ? preserveMatricula(row[matRow] as string | number | null) : null,
          errorType: "exception",
          errorMessage: err.message || "Erro desconhecido",
          rawPayload: row,
        });
        errorCount++;
      }
    }
    
    return { successCount, errorCount, errors };
  }

  private async upsertPessoa(data: Record<string, any>, convenio: string): Promise<any> {
    const existing = await db.select()
      .from(clientesPessoa)
      .where(
        and(
          data.tenantId ? eq(clientesPessoa.tenantId, data.tenantId) : sql`${clientesPessoa.tenantId} IS NULL`,
          eq(clientesPessoa.matricula, data.matricula),
          eq(clientesPessoa.convenio, convenio)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      const [updated] = await db.update(clientesPessoa)
        .set({ ...data, atualizadoEm: new Date() })
        .where(eq(clientesPessoa.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(clientesPessoa)
        .values(data as any)
        .returning();
      return created;
    }
  }

  private async createFolhaMes(pessoaId: number, data: Record<string, any>): Promise<void> {
    await db.insert(clientesFolhaMes).values({
      pessoaId,
      ...data,
    } as any);
  }

  private async upsertContrato(pessoaId: number, data: Record<string, any>): Promise<void> {
    if (data.numeroContrato) {
      const existing = await db.select()
        .from(clientesContratos)
        .where(
          and(
            eq(clientesContratos.pessoaId, pessoaId),
            eq(clientesContratos.numeroContrato, data.numeroContrato)
          )
        )
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(clientesContratos)
          .set(data)
          .where(eq(clientesContratos.id, existing[0].id));
        return;
      }
    }
    
    await db.insert(clientesContratos).values({
      pessoaId,
      tipoContrato: data.tipoContrato || "consignado",
      ...data,
    } as any);
  }
}

export const importService = new ImportService();
