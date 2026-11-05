import path from "path";
import dotenv from "dotenv";
import { prisma } from "../src/config/prisma";
import { logger } from "../src/core/logger";
import { runAnalyticsRollup } from "../src/cron";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

/**
 * Rebuilds `analytics_daily` for the last N calendar days from raw events.
 * Usage: npm run analytics:backfill -- 90
 */
async function main() {
  const daysArgument = Number(process.argv[2] ?? 90);
  const days = Number.isFinite(daysArgument) ? Math.trunc(daysArgument) : 90;

  if (days < 1 || days > 90) {
    console.error("Rentang backfill harus antara 1 dan 90 hari.");
    process.exitCode = 1;
    return;
  }

  logger.info("[Backfill] Starting analytics rollup", { days });

  try {
    const affected = await runAnalyticsRollup(prisma, logger, days);
    logger.info("[Backfill] Analytics rollup finished", { days, affectedRows: affected });
  } catch (error) {
    logger.error("[Backfill] Analytics rollup failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
