import { db } from "./storage";
import { sql } from "drizzle-orm";

const RETENTION_DAYS = 3;
const BATCH_SIZE = 10000;
const CLEANUP_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours
const MAX_ROWS_TOTAL = 200000;

let isRunning = false;

async function cleanupOldImportRunRows(): Promise<number> {
  if (isRunning) {
    console.log("[DataRetention] Cleanup already in progress, skipping...");
    return 0;
  }

  isRunning = true;
  let totalDeleted = 0;

  try {
    console.log(`[DataRetention] Starting cleanup of import_run_rows older than ${RETENTION_DAYS} days...`);

    while (true) {
      const result = await db.execute(sql`
        DELETE FROM import_run_rows 
        WHERE id IN (
          SELECT id FROM import_run_rows 
          WHERE created_at < NOW() - INTERVAL '3 days' 
          LIMIT ${BATCH_SIZE}
        )
      `);

      const deleted = Number(result.rowCount || 0);
      if (deleted === 0) break;

      totalDeleted += deleted;
      console.log(`[DataRetention] Deleted batch of ${deleted} rows. Total so far: ${totalDeleted}`);

      await new Promise(r => setTimeout(r, 1000));
    }

    const countResult = await db.execute(sql`
      SELECT reltuples::bigint AS estimated_rows FROM pg_class WHERE relname = 'import_run_rows'
    `);
    const estimatedRows = Number((countResult.rows?.[0] as any)?.estimated_rows || 0);

    if (estimatedRows > MAX_ROWS_TOTAL) {
      console.log(`[DataRetention] Table still has ~${estimatedRows} rows (max ${MAX_ROWS_TOTAL}). Cleaning oldest entries...`);
      while (true) {
        const result = await db.execute(sql`
          DELETE FROM import_run_rows 
          WHERE id IN (
            SELECT id FROM import_run_rows 
            ORDER BY id ASC
            LIMIT ${BATCH_SIZE}
          )
        `);
        const deleted = Number(result.rowCount || 0);
        if (deleted === 0) break;
        totalDeleted += deleted;
        console.log(`[DataRetention] Overflow cleanup: deleted ${deleted} rows. Total: ${totalDeleted}`);
        await new Promise(r => setTimeout(r, 1000));

        const recheck = await db.execute(sql`SELECT COUNT(*) as cnt FROM import_run_rows`);
        const remaining = Number((recheck.rows?.[0] as any)?.cnt || 0);
        if (remaining <= MAX_ROWS_TOTAL) break;
      }
    }

    if (totalDeleted > 0) {
      console.log(`[DataRetention] Cleanup complete. Total rows deleted: ${totalDeleted}`);
      try {
        if (totalDeleted > 50000) {
          console.log("[DataRetention] Running VACUUM on import_run_rows...");
          await db.execute(sql`VACUUM import_run_rows`);
          console.log("[DataRetention] VACUUM complete.");
        }
      } catch (vacErr: any) {
        console.log("[DataRetention] VACUUM skipped:", vacErr.message);
      }
    } else {
      console.log("[DataRetention] No old rows to clean up.");
    }
  } catch (error: any) {
    console.error("[DataRetention] Error during cleanup:", error.message);
  } finally {
    isRunning = false;
  }

  return totalDeleted;
}

async function cleanupOrphanedStaging(): Promise<void> {
  try {
    const activeRuns = await db.execute(sql`
      SELECT id FROM import_runs 
      WHERE status IN ('processing', 'staging', 'merging', 'pending', 'processando')
      AND created_at > NOW() - INTERVAL '2 hours'
    `);

    if (activeRuns.rows && activeRuns.rows.length > 0) {
      console.log("[DataRetention] Active imports found, skipping staging cleanup.");
      return;
    }

    const stalledRuns = await db.execute(sql`
      UPDATE import_runs 
      SET status = 'erro', error_message = 'Importação travada - timeout automático'
      WHERE status IN ('processing', 'staging', 'merging', 'pending', 'processando')
      AND created_at < NOW() - INTERVAL '2 hours'
      RETURNING id
    `);

    if (stalledRuns.rows && stalledRuns.rows.length > 0) {
      const ids = stalledRuns.rows.map((r: any) => r.id);
      console.log(`[DataRetention] Marked ${ids.length} stalled imports as error: ${ids.join(', ')}`);
    }

    const stagingCounts = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM staging_folha) AS folha,
        (SELECT COUNT(*) FROM staging_d8) AS d8,
        (SELECT COUNT(*) FROM staging_contatos) AS contatos
    `);

    const row = stagingCounts.rows?.[0] as any;
    const folha = Number(row?.folha || 0);
    const d8 = Number(row?.d8 || 0);
    const contatos = Number(row?.contatos || 0);

    if (folha + d8 + contatos === 0) return;

    console.log(`[DataRetention] Cleaning orphaned staging data: folha=${folha}, d8=${d8}, contatos=${contatos}`);

    if (folha > 0) await db.execute(sql`TRUNCATE TABLE staging_folha`);
    if (d8 > 0) await db.execute(sql`TRUNCATE TABLE staging_d8`);
    if (contatos > 0) await db.execute(sql`TRUNCATE TABLE staging_contatos`);

    console.log("[DataRetention] Orphaned staging data cleaned.");
  } catch (error: any) {
    console.error("[DataRetention] Error cleaning staging:", error.message);
  }
}

let intervalId: NodeJS.Timeout | null = null;

export function startDataRetention(): void {
  console.log(`[DataRetention] Starting automatic retention (every ${CLEANUP_INTERVAL_MS / 3600000}h, keeping ${RETENTION_DAYS} days, max ${MAX_ROWS_TOTAL} rows)`);

  setTimeout(async () => {
    await cleanupOldImportRunRows();
    await cleanupOrphanedStaging();
  }, 60 * 1000);

  intervalId = setInterval(async () => {
    await cleanupOldImportRunRows();
    await cleanupOrphanedStaging();
  }, CLEANUP_INTERVAL_MS);
}

export function stopDataRetention(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[DataRetention] Stopped automatic retention.");
  }
}
