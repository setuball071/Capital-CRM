import { db } from "./storage";
import { csvSplitRuns } from "@shared/schema";
import { eq, inArray } from "drizzle-orm";
import { csvSplitService } from "./csv-split-service";

const PROCESSING_INTERVAL_MS = 2000;
const MAX_CONCURRENT_JOBS = 2;

class CsvSplitRunner {
  private isRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private activeJobs = new Set<number>();

  start() {
    if (this.intervalId) return;
    
    console.log("[csv-split-runner] Starting background processor...");
    
    this.intervalId = setInterval(async () => {
      await this.tick();
    }, PROCESSING_INTERVAL_MS);

    this.tick();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  async enqueue(runId: number) {
    console.log(`[csv-split-runner] Enqueued job ${runId}`);
    setImmediate(() => this.tick());
  }

  private async tick() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const availableSlots = MAX_CONCURRENT_JOBS - this.activeJobs.size;
      if (availableSlots <= 0) return;

      const pendingRuns = await db
        .select()
        .from(csvSplitRuns)
        .where(inArray(csvSplitRuns.status, ["pendente", "processando", "convertendo"]))
        .limit(availableSlots);

      for (const run of pendingRuns) {
        if (this.activeJobs.has(run.id)) continue;
        
        this.activeJobs.add(run.id);
        this.processJob(run.id).finally(() => {
          this.activeJobs.delete(run.id);
        });
      }
    } catch (error) {
      console.error("[csv-split-runner] Tick error:", error);
    } finally {
      this.isRunning = false;
    }
  }

  private async processJob(runId: number) {
    console.log(`[csv-split-runner] Processing job ${runId}...`);
    
    try {
      const run = await csvSplitService.getRun(runId);
      if (!run) {
        console.error(`[csv-split-runner] Job ${runId} not found`);
        return;
      }

      // Handle XLSX conversion first if needed
      if (run.status === "convertendo") {
        console.log(`[csv-split-runner] Converting XLSX to CSV for job ${runId}...`);
        const csvPath = await csvSplitService.convertXlsxToCsv(run.storagePath);
        await csvSplitService.updateStoragePath(runId, csvPath);
        console.log(`[csv-split-runner] Conversion complete: ${csvPath}`);
      }

      // Process ONE chunk only (time-sliced), then release
      const result = await csvSplitService.processChunk(runId);
      
      if (result.status === "completed") {
        console.log(`[csv-split-runner] Job ${runId} completed: ${result.totalParts} parts, ${result.totalLinesProcessed} lines`);
      } else if (result.status === "error") {
        console.error(`[csv-split-runner] Job ${runId} error: ${result.message}`);
      }
      // If "continue", the job stays in "processando" status and will be picked up on next tick
    } catch (error: any) {
      console.error(`[csv-split-runner] Job ${runId} failed:`, error);
      
      await db
        .update(csvSplitRuns)
        .set({
          status: "erro",
          errorMessage: error.message || "Erro interno no runner",
          updatedAt: new Date(),
        })
        .where(eq(csvSplitRuns.id, runId));
    }
  }

  getActiveJobs(): number[] {
    return Array.from(this.activeJobs);
  }
}

export const csvSplitRunner = new CsvSplitRunner();
