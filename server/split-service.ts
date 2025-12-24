import * as fs from "fs";
import * as path from "path";
import { db } from "./storage";
import { splitRuns, type SplitRun } from "@shared/schema";
import { eq } from "drizzle-orm";

const LINES_PER_PART = 100_000;
const MAX_EXECUTION_TIME_MS = 25_000;
const CHUNK_READ_SIZE = 64 * 1024;

export interface SplitJobResult {
  success: boolean;
  runId: number;
  status: "continue" | "completed" | "error";
  currentPart: number;
  linesInCurrentPart: number;
  totalLinesProcessed: number;
  totalParts: number;
  message: string;
  outputFiles?: string[];
}

class SplitService {
  async createRun(
    tenantId: number,
    storagePath: string,
    originalFilename: string,
    createdById: number,
    linesPerPart: number = LINES_PER_PART
  ): Promise<SplitRun> {
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const outputFolder = `/tmp/split_exports/${tenantId}/${Date.now()}`;
    
    await fs.promises.mkdir(outputFolder, { recursive: true });

    const [run] = await db
      .insert(splitRuns)
      .values({
        tenantId,
        storagePath,
        originalFilename,
        linesPerPart,
        outputFolder,
        status: "pendente",
        createdById,
      })
      .returning();

    return run;
  }

  async getRun(runId: number): Promise<SplitRun | null> {
    const [run] = await db.select().from(splitRuns).where(eq(splitRuns.id, runId));
    return run || null;
  }

  async processChunk(runId: number): Promise<SplitJobResult> {
    const run = await this.getRun(runId);
    if (!run) {
      return {
        success: false,
        runId,
        status: "error",
        currentPart: 0,
        linesInCurrentPart: 0,
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
        linesInCurrentPart: 0,
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
        linesInCurrentPart: run.linesInCurrentPart,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.totalParts || 0,
        message: run.errorMessage || "Erro desconhecido",
      };
    }

    await db
      .update(splitRuns)
      .set({ status: "processando", updatedAt: new Date() })
      .where(eq(splitRuns.id, runId));

    try {
      const result = await this.processIncremental(run);
      return result;
    } catch (error: any) {
      await db
        .update(splitRuns)
        .set({
          status: "erro",
          errorMessage: error.message || "Erro no processamento",
          updatedAt: new Date(),
        })
        .where(eq(splitRuns.id, runId));

      return {
        success: false,
        runId,
        status: "error",
        currentPart: run.currentPart,
        linesInCurrentPart: run.linesInCurrentPart,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.totalParts || 0,
        message: error.message || "Erro no processamento",
      };
    }
  }

  private async processIncremental(run: SplitRun): Promise<SplitJobResult> {
    const startTime = Date.now();
    const filePath = run.storagePath;
    const linesPerPart = run.linesPerPart;
    const outputFolder = run.outputFolder!;

    if (!fs.existsSync(filePath)) {
      throw new Error(`Arquivo não encontrado: ${filePath}`);
    }

    const fileStats = await fs.promises.stat(filePath);
    const fileSize = fileStats.size;

    let byteOffset = run.byteOffset;
    let currentPart = run.currentPart;
    let linesInCurrentPart = run.linesInCurrentPart;
    let totalLinesProcessed = run.totalLinesProcessed;
    let buffer = "";
    let headers: string[] | null = null;
    let headerLine = "";
    let currentPartLines: string[] = [];
    let generatedFiles: string[] = [];

    const fileHandle = await fs.promises.open(filePath, "r");

    try {
      if (byteOffset === 0) {
        currentPart = 1;
        linesInCurrentPart = 0;
      }

      const readBuffer = Buffer.alloc(CHUNK_READ_SIZE);
      let bytesRead: number;
      let currentByteOffset = byteOffset;

      while ((bytesRead = (await fileHandle.read(readBuffer, 0, CHUNK_READ_SIZE, currentByteOffset)).bytesRead) > 0) {
        if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
          await this.savePartialProgress(run.id, currentPart, linesInCurrentPart, currentByteOffset, totalLinesProcessed);
          await fileHandle.close();

          return {
            success: true,
            runId: run.id,
            status: "continue",
            currentPart,
            linesInCurrentPart,
            totalLinesProcessed,
            totalParts: 0,
            message: `Tempo limite atingido. Processados ${totalLinesProcessed} linhas. Continuando...`,
            outputFiles: generatedFiles,
          };
        }

        buffer += readBuffer.slice(0, bytesRead).toString("utf-8");
        currentByteOffset += bytesRead;

        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;

          if (!headers) {
            headers = this.parseColumns(line);
            headerLine = headers.join(",");
            continue;
          }

          const columns = this.parseColumns(line);
          const csvLine = columns.map((c) => this.escapeCSV(c)).join(",");
          currentPartLines.push(csvLine);
          linesInCurrentPart++;
          totalLinesProcessed++;

          if (linesInCurrentPart >= linesPerPart) {
            const partFile = await this.writePartFile(
              outputFolder,
              run.originalFilename!,
              currentPart,
              headerLine,
              currentPartLines
            );
            generatedFiles.push(partFile);

            currentPart++;
            linesInCurrentPart = 0;
            currentPartLines = [];

            await this.savePartialProgress(run.id, currentPart, 0, currentByteOffset, totalLinesProcessed);

            if (Date.now() - startTime > MAX_EXECUTION_TIME_MS) {
              await fileHandle.close();
              return {
                success: true,
                runId: run.id,
                status: "continue",
                currentPart,
                linesInCurrentPart: 0,
                totalLinesProcessed,
                totalParts: 0,
                message: `Parte ${currentPart - 1} gerada. Processados ${totalLinesProcessed} linhas. Continuando...`,
                outputFiles: generatedFiles,
              };
            }
          }
        }
      }

      if (buffer.trim() && headers) {
        const columns = this.parseColumns(buffer);
        const csvLine = columns.map((c) => this.escapeCSV(c)).join(",");
        currentPartLines.push(csvLine);
        linesInCurrentPart++;
        totalLinesProcessed++;
      }

      if (currentPartLines.length > 0 && headerLine) {
        const partFile = await this.writePartFile(
          outputFolder,
          run.originalFilename!,
          currentPart,
          headerLine,
          currentPartLines
        );
        generatedFiles.push(partFile);
      }

      await db
        .update(splitRuns)
        .set({
          status: "concluido",
          currentPart,
          linesInCurrentPart: 0,
          byteOffset: fileSize,
          totalLinesProcessed,
          totalParts: currentPart,
          updatedAt: new Date(),
        })
        .where(eq(splitRuns.id, run.id));

      await fileHandle.close();

      return {
        success: true,
        runId: run.id,
        status: "completed",
        currentPart,
        linesInCurrentPart: 0,
        totalLinesProcessed,
        totalParts: currentPart,
        message: `Concluído! ${currentPart} partes geradas com ${totalLinesProcessed} linhas total.`,
        outputFiles: generatedFiles,
      };
    } catch (error) {
      await fileHandle.close();
      throw error;
    }
  }

  private parseColumns(line: string): string[] {
    return line.split(/\s{2,}/).map((col) => col.trim()).filter((col) => col.length > 0);
  }

  private escapeCSV(value: string): string {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  private async writePartFile(
    outputFolder: string,
    originalFilename: string,
    partNumber: number,
    headerLine: string,
    lines: string[]
  ): Promise<string> {
    const baseName = path.basename(originalFilename, path.extname(originalFilename));
    const partStr = String(partNumber).padStart(6, "0");
    const fileName = `${baseName}_parte_${partStr}.csv`;
    const filePath = path.join(outputFolder, fileName);

    const content = [headerLine, ...lines].join("\n");
    await fs.promises.writeFile(filePath, content, "utf-8");

    return filePath;
  }

  private async savePartialProgress(
    runId: number,
    currentPart: number,
    linesInCurrentPart: number,
    byteOffset: number,
    totalLinesProcessed: number
  ): Promise<void> {
    await db
      .update(splitRuns)
      .set({
        status: "pausado",
        currentPart,
        linesInCurrentPart,
        byteOffset,
        totalLinesProcessed,
        updatedAt: new Date(),
      })
      .where(eq(splitRuns.id, runId));
  }

  async listOutputFiles(runId: number): Promise<string[]> {
    const run = await this.getRun(runId);
    if (!run || !run.outputFolder) return [];

    try {
      const files = await fs.promises.readdir(run.outputFolder);
      return files
        .filter((f) => f.endsWith(".csv"))
        .sort()
        .map((f) => path.join(run.outputFolder!, f));
    } catch {
      return [];
    }
  }

  async getRunsByTenant(tenantId: number): Promise<SplitRun[]> {
    return db.select().from(splitRuns).where(eq(splitRuns.tenantId, tenantId));
  }
}

export const splitService = new SplitService();
