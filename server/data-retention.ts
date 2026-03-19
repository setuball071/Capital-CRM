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
          WHERE created_at < NOW() - INTERVAL '1 day' * ${RETENTION_DAYS} 
          LIMIT ${BATCH_SIZE}
        )
      `);

      const deleted = Number(result.rowCount || 0);
      if (deleted === 0) break;

      totalDeleted += deleted;
      console.log(`[DataRetention] Deleted batch of ${deleted} rows. Total so far: ${totalDeleted}`);

      await new Promise(r => setTimeout(r, 1000));
    }

    if (totalDeleted > 10000) {
      try {
        await db.execute(sql`ANALYZE import_run_rows`);
      } catch (e) {}
    }

    const countResult = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM import_run_rows
    `);
    const estimatedRows = Number((countResult.rows?.[0] as any)?.cnt || 0);

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

async function cleanupOldContratos(): Promise<number> {
  let totalDeleted = 0;
  try {
    console.log("[DataRetention] Starting cleanup of contratos older than 90 days...");

    while (true) {
      const result = await db.execute(sql`
        DELETE FROM clientes_contratos
        WHERE id IN (
          SELECT id FROM clientes_contratos
          WHERE competencia < NOW() - INTERVAL '90 days'
          LIMIT ${BATCH_SIZE}
        )
      `);

      const deleted = Number(result.rowCount || 0);
      if (deleted === 0) break;

      totalDeleted += deleted;
      console.log(`[DataRetention] Deleted ${deleted} old contratos. Total: ${totalDeleted}`);
      await new Promise(r => setTimeout(r, 1000));
    }

    if (totalDeleted > 0) {
      console.log(`[DataRetention] Old contratos cleanup complete. Total deleted: ${totalDeleted}`);
    } else {
      console.log("[DataRetention] No old contratos to clean up.");
    }
  } catch (error: any) {
    console.error("[DataRetention] Error cleaning old contratos:", error.message);
  }
  return totalDeleted;
}

async function cleanupOrphanedStaging(): Promise<void> {
  try {
    const stalledRuns = await db.execute(sql`
      UPDATE import_runs 
      SET status = 'erro', error_message = 'Importação travada - timeout automático'
      WHERE status IN ('processing', 'staging', 'merging', 'processando')
      AND COALESCE(updated_at, created_at) < NOW() - INTERVAL '24 hours'
      RETURNING id
    `);

    if (stalledRuns.rows && stalledRuns.rows.length > 0) {
      const ids = stalledRuns.rows.map((r: any) => r.id);
      console.log(`[DataRetention] Marked ${ids.length} stalled imports as error: ${ids.join(', ')}`);
    }

    const terminalRunIds = await db.execute(sql`
      SELECT DISTINCT s.import_run_id FROM (
        SELECT DISTINCT import_run_id FROM staging_folha
        UNION ALL
        SELECT DISTINCT import_run_id FROM staging_d8
        UNION ALL
        SELECT DISTINCT import_run_id FROM staging_contatos
      ) AS s
      WHERE s.import_run_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM import_runs ir 
          WHERE ir.id = s.import_run_id
            AND ir.status IN ('concluido', 'concluido_com_erros', 'erro', 'cancelado')
        )
    `);

    const orphanedRunIds = await db.execute(sql`
      SELECT DISTINCT s.import_run_id FROM (
        SELECT DISTINCT import_run_id FROM staging_folha
        UNION ALL
        SELECT DISTINCT import_run_id FROM staging_d8
        UNION ALL
        SELECT DISTINCT import_run_id FROM staging_contatos
      ) AS s
      WHERE s.import_run_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM import_runs ir 
          WHERE ir.id = s.import_run_id
        )
    `);

    const idsToClean: number[] = [];
    if (terminalRunIds.rows) {
      for (const r of terminalRunIds.rows) idsToClean.push((r as any).import_run_id);
    }
    if (orphanedRunIds.rows) {
      for (const r of orphanedRunIds.rows) idsToClean.push((r as any).import_run_id);
    }

    if (idsToClean.length === 0) return;

    console.log(`[DataRetention] Cleaning staging data for ${idsToClean.length} terminal/orphaned import runs: ${idsToClean.join(', ')}`);

    for (const runId of idsToClean) {
      await db.execute(sql`DELETE FROM staging_folha WHERE import_run_id = ${runId}`);
      await db.execute(sql`DELETE FROM staging_d8 WHERE import_run_id = ${runId}`);
      await db.execute(sql`DELETE FROM staging_contatos WHERE import_run_id = ${runId}`);
    }

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
    await cleanupOldContratos();
    await cleanupOrphanedStaging();
  }, 60 * 1000);

  intervalId = setInterval(async () => {
    await cleanupOldImportRunRows();
    await cleanupOldContratos();
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
