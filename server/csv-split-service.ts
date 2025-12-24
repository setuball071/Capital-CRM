import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import archiver from "archiver";
import { db } from "./storage";
import { csvSplitRuns, type CsvSplitRun } from "@shared/schema";
import { eq } from "drizzle-orm";

const LINES_PER_PART = 100_000;
const MAX_EXECUTION_TIME_MS = 25_000;
const CHUNK_READ_SIZE = 1024 * 1024; // 1MB chunks for better performance with large files

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
  fileSize?: number;
  bytesProcessed?: number;
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

  async convertXlsxToCsv(xlsxPath: string, onProgress?: (rows: number) => void): Promise<string> {
    const csvPath = xlsxPath.replace(/\.xlsx$/i, ".csv");
    
    const workbook = new ExcelJS.stream.xlsx.WorkbookReader(xlsxPath, {
      sharedStrings: "cache",
      hyperlinks: "ignore",
      styles: "ignore",
      worksheets: "emit",
    });

    const writeStream = fs.createWriteStream(csvPath, { 
      encoding: "utf8",
      highWaterMark: 1024 * 1024 // 1MB buffer for write stream
    });
    
    let worksheetProcessed = false;
    let rowCount = 0;

    for await (const worksheetReader of workbook) {
      if (worksheetProcessed) break;
      worksheetProcessed = true;

      for await (const row of worksheetReader) {
        if (!row.hasValues) continue;

        const values: string[] = [];
        const cellCount = row.cellCount || 0;
        
        for (let i = 1; i <= cellCount; i++) {
          const cell = row.getCell(i);
          let cellValue = "";

          if (cell.text !== undefined && cell.text !== null && cell.text !== "") {
            cellValue = cell.text;
          } else if (cell.value !== null && cell.value !== undefined) {
            if (typeof cell.value === "object") {
              if ("richText" in cell.value && Array.isArray(cell.value.richText)) {
                cellValue = cell.value.richText.map((rt: any) => String(rt.text || "")).join("");
              } else if ("text" in cell.value) {
                cellValue = String(cell.value.text || "");
              } else if ("result" in cell.value) {
                cellValue = String(cell.value.result || "");
              } else {
                cellValue = "";
              }
            } else {
              cellValue = String(cell.value);
            }
          }

          if (cellValue.includes(",") || cellValue.includes('"') || cellValue.includes("\n") || cellValue.includes("\r")) {
            cellValue = '"' + cellValue.replace(/"/g, '""') + '"';
          }

          values.push(cellValue);
        }

        const line = values.join(",") + "\n";
        
        // Backpressure handling: wait if buffer is full
        const canContinue = writeStream.write(line);
        if (!canContinue) {
          await new Promise<void>(resolve => writeStream.once("drain", resolve));
        }
        
        rowCount++;
        if (onProgress && rowCount % 10000 === 0) {
          onProgress(rowCount);
        }
      }
    }

    writeStream.end();
    
    await new Promise<void>((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    return csvPath;
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

  async getFileSize(runId: number): Promise<number> {
    const run = await this.getRun(runId);
    if (!run) return 0;
    try {
      const stats = await fs.promises.stat(run.storagePath);
      return stats.size;
    } catch {
      return 0;
    }
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
      const fileSize = await this.getFileSize(runId);
      return {
        success: true,
        runId,
        status: "completed",
        currentPart: run.currentPart,
        lineOffset: run.lineOffset,
        totalLinesProcessed: run.totalLinesProcessed,
        totalParts: run.totalParts || run.currentPart,
        message: "Processamento já concluído",
        fileSize,
        bytesProcessed: run.lineOffset,
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
        fileSize,
        bytesProcessed: byteOffset,
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

            // Use streaming write for the part file
            const partWriteStream = fs.createWriteStream(partPath, { encoding: "utf8" });
            partWriteStream.write(headerLine + "\n");
            
            // Write lines in batches to avoid memory issues
            const BATCH_SIZE = 10000;
            for (let i = 0; i < currentPartLines.length; i += BATCH_SIZE) {
              const batch = currentPartLines.slice(i, Math.min(i + BATCH_SIZE, currentPartLines.length));
              const canContinue = partWriteStream.write(batch.join("\n") + "\n");
              if (!canContinue) {
                await new Promise<void>(resolve => partWriteStream.once("drain", resolve));
              }
            }
            
            partWriteStream.end();
            await new Promise<void>((resolve, reject) => {
              partWriteStream.on("finish", resolve);
              partWriteStream.on("error", reject);
            });

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
            // Process up to 3 parts per execution or 25 seconds max
            if (elapsed >= MAX_EXECUTION_TIME_MS || partsCreatedThisExecution >= 3) {
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

          const partWriteStream = fs.createWriteStream(partPath, { encoding: "utf8" });
          partWriteStream.write(headerLine + "\n");
          partWriteStream.write(currentPartLines.join("\n") + "\n");
          partWriteStream.end();
          
          await new Promise<void>((resolve, reject) => {
            partWriteStream.on("finish", resolve);
            partWriteStream.on("error", reject);
          });

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
      fileSize,
      bytesProcessed: adjustedByteOffset,
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

  async createZip(runId: number): Promise<string | null> {
    const run = await this.getRun(runId);
    if (!run || !run.outputFolder) return null;
    
    const outputFolder = run.outputFolder;
    if (!fs.existsSync(outputFolder)) return null;
    
    const files = await fs.promises.readdir(outputFolder);
    const csvFiles = files.filter(f => f.endsWith(".csv")).sort();
    
    if (csvFiles.length === 0) return null;
    
    const zipPath = path.join(outputFolder, `${run.baseName || "partes"}_completo.zip`);
    
    // Check if ZIP already exists and is complete
    if (fs.existsSync(zipPath)) {
      return zipPath;
    }
    
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", {
      zlib: { level: 6 } // Balanced compression
    });
    
    return new Promise((resolve, reject) => {
      output.on("close", () => resolve(zipPath));
      output.on("error", reject);
      archive.on("error", reject);
      
      archive.pipe(output);
      
      for (const file of csvFiles) {
        archive.file(path.join(outputFolder, file), { name: file });
      }
      
      archive.finalize();
    });
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
