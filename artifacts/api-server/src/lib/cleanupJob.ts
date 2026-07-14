import { db } from "@workspace/db";
import { alertsTable } from "@workspace/db/schema";
import { and, eq, lt, or } from "drizzle-orm";
import { logger } from "./logger";

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

async function runCleanup() {
  const cutoff = new Date(Date.now() - TWO_DAYS_MS);

  try {
    const deleted = await db
      .delete(alertsTable)
      .where(
        and(
          eq(alertsTable.active, false),
          or(
            lt(alertsTable.triggeredAt, cutoff),
            lt(alertsTable.createdAt, cutoff)
          )
        )
      )
      .returning({ id: alertsTable.id });

    if (deleted.length > 0) {
      logger.info({ count: deleted.length, cutoff }, "Cleaned up old inactive alerts");
    }
  } catch (err) {
    logger.error({ err }, "Cleanup job failed");
  }
}

export function startCleanupJob() {
  const INTERVAL_MS = 24 * 60 * 60 * 1000;

  runCleanup();
  setInterval(runCleanup, INTERVAL_MS);
  logger.info({ intervalMs: INTERVAL_MS }, "Cleanup job started");
}
