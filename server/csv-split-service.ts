import * as fs from "fs";
import * as path from "path";
import { db } from "./storage";
import { csvSplitRuns, type CsvSplitRun } from "@shared/schema";
import { eq } from "drizzle-orm";

const LINES_PER_PART = 100_000;
const MAX_EXECUTION_TIME_MS = 25_000;
const CHUNK_READ_SIZE = 64 * 1024;

export interface CsvSplitJobResult {
  success: boolean;
  runId: number;
  status: "continue" | "completed" | "error";
  currentPart: number;
  lineOffset: number;
  totalLinesProcessed: number;
  totalParts: number;
  message: string;
  outputFiles?: string[];
}

class CsvSplitService {
  async createRun(
    tenantId: number,
    storagePath: string,
    originalFilename: string,
    createdById: number,
    baseName?: string,
    linesPerPart: number = LINES_PER_PART
  ): Promise<CsvSplitRun> {
    const finalBaseName = baseName || path.basename(originalFilename, path.extname(originalFilename));
    const outputFolder = `/tmp/csv_split_exports/${tenantId}/${Date.now()}`;
    
    await fs.promises.mkdir(outputFolder, { recursive: true });

    const { headerLine, headerByteLength } = await this.extractHeaderWithBytes(storagePath);

    const [run] = await db
      .insert(csvSplitRuns)
      .values({
        tenantId,
        storagePath,
        originalFilename,
        baseName: finalBaseName,
        linesPerPart,
        outputFolder,
        headerLine,
        lineOffset: headerByteLength,
        status: "pendente",
        createdById,
      })
      .returning();

    return run;
  }

  private async extractHeaderWithBytes(filePath: string): Promise<{ headerLine: string; headerByteLength: number }> {
    const fd = await fs.promises.open(filePath, "r");
    try {
      const buffer = Buffer.alloc(CHUNK_READ_SIZE);
      const { bytesRead } = await fd.read(buffer, 0, CHUNK_READ_SIZE, 0);
      
      const content = buffer.toString("utf8", 0, bytesRead);
      let newlineIndex = content.indexOf("\n");
      
      if (newlineIndex === -1) {
        return { headerLine: content, headerByteLength: bytesRead };
      }

      let headerLine = content.substring(0, newlineIndex);
      if (headerLine.endsWith("\r")) {
        headerLine = headerLine.substring(0, headerLine.length - 1);
      }
      
      const headerByteLength = Buffer.byteLength(content.substring(0, newlineIndex + 1), "utf8");
      
      return { headerLine, headerByteLength };
    } finally {
      await fd.close();
    }
  }

  async getRun(runId: number): Promise<CsvSplitRun | null> {
    const [run] = await db.select().from(csvSplitRuns).where(eq(csvSplitRuns.id, runId));
    return run || null;
  }

  async getRunsByTenant(tenantId: number): Promise<CsvSplitRun[]> {
    return await db
      .select()
      .from(csvSplitRuns)
      .where(eq(csvSplitRuns.tenantId, tenantId))
      .orderBy(csvSplitRuns.createdAt);
  }

  async processChunk(runId: number): Promise<CsvSplitJobResult> {
    const run = await this.getRun(runId);
    if (!run) {
      return {
        success: false,
        runId,
        status: "error",
        currentPart: 0,
        lineOffset: 0,
        totalLinesProcessed: 0,
        totalParts: 0,
        message: "Run não encontrado",
      };
    }

    if (run.status === "concluido") {
      return {
        success: true,
        runId,
        status: "completed",
        currentPart: run.currentPart,
        lineOffset: run.lineOffset,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.totalParts || run.currentPart,
        message: "Processamento já concluído",
      };
    }

    if (run.status === "erro") {
      return {
        success: false,
        runId,
        status: "error",
        currentPart: run.currentPart,
        lineOffset: run.lineOffset,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.totalParts || 0,
        message: run.errorMessage || "Erro desconhecido",
      };
    }

    await db
      .update(csvSplitRuns)
      .set({ status: "processando", updatedAt: new Date() })
      .where(eq(csvSplitRuns.id, runId));

    try {
      const result = await this.processIncremental(run);
      return result;
    } catch (error: any) {
      await db
        .update(csvSplitRuns)
        .set({
          status: "erro",
          errorMessage: error.message || "Erro no processamento",
          updatedAt: new Date(),
        })
        .where(eq(csvSplitRuns.id, runId));

      return {
        success: false,
        runId,
        status: "error",
        currentPart: run.currentPart,
        lineOffset: run.lineOffset,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.totalParts || 0,
        message: error.message || "Erro no processamento",
      };
    }
  }

  private async processIncremental(run: CsvSplitRun): Promise<CsvSplitJobResult> {
    const startTime = Date.now();
    const filePath = run.storagePath;
    const linesPerPart = run.linesPerPart;
    const outputFolder = run.outputFolder!;
    const baseName = run.baseName || "parte";
    const headerLine = run.headerLine || "";

    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;
    let byteOffset = run.lineOffset;

    if (byteOffset >= fileSize) {
      await db
        .update(csvSplitRuns)
        .set({
          status: "concluido",
          totalParts: run.currentPart,
          updatedAt: new Date(),
        })
        .where(eq(csvSplitRuns.id, run.id));

      return {
        success: true,
        runId: run.id,
        status: "completed",
        currentPart: run.currentPart,
        lineOffset: byteOffset,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.currentPart,
        message: `Processamento concluído! Total: ${run.currentPart} partes.`,
      };
    }

    let currentPart = run.currentPart;
    let totalLinesProcessed = run.totalLinesProcessed;
    let currentPartLines: string[] = [];
    let partsCreatedThisExecution = 0;
    let shouldStop = false;
    let isCompleted = false;

    const fd = await fs.promises.open(filePath, "r");
    try {
      let leftover = "";
      const buffer = Buffer.alloc(CHUNK_READ_SIZE);

      while (!shouldStop) {
        const { bytesRead } = await fd.read(buffer, 0, CHUNK_READ_SIZE, byteOffset);
        
        if (bytesRead === 0) {
          isCompleted = true;
          break;
        }

        const chunk = leftover + buffer.toString("utf8", 0, bytesRead);
        const lines = chunk.split(/\r?\n/);
        
        leftover = lines.pop() || "";
        byteOffset += bytesRead;

        for (const line of lines) {
          if (line.length === 0) continue;
          
          currentPartLines.push(line);

          if (currentPartLines.length >= linesPerPart) {
            currentPart++;
            const partFilename = `${baseName}_parte_${String(currentPart).padStart(6, "0")}.csv`;
            const partPath = path.join(outputFolder, partFilename);

            const content = headerLine + "\n" + currentPartLines.join("\n") + "\n";
            await fs.promises.writeFile(partPath, content, "utf8");

            totalLinesProcessed += currentPartLines.length;
            partsCreatedThisExecution++;

            const actualBytesConsumed = byteOffset - Buffer.byteLength(leftover, "utf8");

            await db
              .update(csvSplitRuns)
              .set({
                currentPart,
                lineOffset: actualBytesConsumed,
                totalLinesProcessed,
                updatedAt: new Date(),
              })
              .where(eq(csvSplitRuns.id, run.id));

            currentPartLines = [];

            const elapsed = Date.now() - startTime;
            if (elapsed >= MAX_EXECUTION_TIME_MS || partsCreatedThisExecution >= 1) {
              shouldStop = true;
              break;
            }
          }
        }
      }

      if (!shouldStop) {
        if (leftover.length > 0) {
          currentPartLines.push(leftover);
        }

        if (currentPartLines.length > 0) {
          currentPart++;
          const partFilename = `${baseName}_parte_${String(currentPart).padStart(6, "0")}.csv`;
          const partPath = path.join(outputFolder, partFilename);

          const content = headerLine + "\n" + currentPartLines.join("\n") + "\n";
          await fs.promises.writeFile(partPath, content, "utf8");

          totalLinesProcessed += currentPartLines.length;
        }
        isCompleted = true;
      }

    } finally {
      await fd.close();
    }

    const adjustedByteOffset = byteOffset - Buffer.byteLength("", "utf8");
    const newStatus = isCompleted ? "concluido" : "processando";

    await db
      .update(csvSplitRuns)
      .set({
        status: newStatus,
        currentPart,
        lineOffset: adjustedByteOffset,
        totalLinesProcessed,
        totalParts: isCompleted ? currentPart : null,
        updatedAt: new Date(),
      })
      .where(eq(csvSplitRuns.id, run.id));

    return {
      success: true,
      runId: run.id,
      status: isCompleted ? "completed" : "continue",
      currentPart,
      lineOffset: adjustedByteOffset,
      totalLinesProcessed,
      totalParts: currentPart,
      message: isCompleted 
        ? `Processamento concluído! Total: ${currentPart} partes, ${totalLinesProcessed} linhas.`
        : `Parte ${currentPart} criada. Continue processando...`,
    };
  }

  async getOutputFiles(runId: number): Promise<{ name: string; path: string }[]> {
    const run = await this.getRun(runId);
    if (!run || !run.outputFolder) return [];

    const outputFolder = run.outputFolder;
    if (!fs.existsSync(outputFolder)) return [];

    const files = await fs.promises.readdir(outputFolder);
    return files
      .filter(f => f.endsWith(".csv"))
      .sort()
      .map(f => ({
        name: f,
        path: path.join(outputFolder, f),
      }));
  }

  async resetRun(runId: number): Promise<void> {
    await db
      .update(csvSplitRuns)
      .set({
        status: "pendente",
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(csvSplitRuns.id, runId));
  }
}

export const csvSplitService = new CsvSplitService();
