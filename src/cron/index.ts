import cron from "node-cron";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { ILogger, logger as defaultLogger } from "../core/logger";

/**
 * Dependencies required by scheduled background workers.
 */
export interface CronDeps {
  prisma: PrismaClient;
  logger: ILogger;
}

/**
 * Registers background cron schedules for hourly `analytics_daily` rollups
 * and daily 90-day raw `analytics_events` retention cleanup.
 */
export function initCronJobs(deps: Partial<CronDeps> = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const logger = deps.logger ?? defaultLogger;

  logger.info("[Cron] Initializing background workers...");

  cron.schedule("0 * * * *", async () => {
    logger.info("[Cron] Starting hourly analytics rollup...");
    try {
      await prisma.$executeRaw`
        WITH session_summary AS (
          SELECT 
            site_id,
            DATE(occurred_at) AS date_bucket,
            path,
            COUNT(DISTINCT session_id) AS visitors,
            COUNT(DISTINCT session_id) AS sessions,
            COUNT(*) AS pageviews,
            SUM(duration_sec) AS total_duration,
            COUNT(CASE WHEN duration_sec = 0 AND event_name = 'pageview' THEN 1 END) AS bounces,
            COUNT(CASE WHEN event_name = 'whatsapp_click' THEN 1 END) AS wa_clicks,
            COUNT(CASE WHEN event_name = 'form_submit' THEN 1 END) AS form_submits
          FROM analytics_events
          WHERE occurred_at >= NOW() - INTERVAL '2 hours'
          GROUP BY site_id, DATE(occurred_at), path
        )
        INSERT INTO analytics_daily (
          site_id, date, path, visitors, sessions, pageviews, duration_sec, bounces, whatsapp_clicks, form_submits, updated_at
        )
        SELECT 
          site_id, date_bucket, path, visitors, sessions, pageviews, total_duration, bounces, wa_clicks, form_submits, NOW()
        FROM session_summary
        ON CONFLICT (site_id, date, path)
        DO UPDATE SET
          visitors = EXCLUDED.visitors,
          sessions = EXCLUDED.sessions,
          pageviews = EXCLUDED.pageviews,
          duration_sec = EXCLUDED.duration_sec,
          bounces = EXCLUDED.bounces,
          whatsapp_clicks = EXCLUDED.whatsapp_clicks,
          form_submits = EXCLUDED.form_submits,
          updated_at = NOW();
      `;
      logger.info("[Cron] Hourly analytics rollup completed successfully.");
    } catch (err: any) {
      logger.error("[Cron Error] Analytics rollup failed", { error: err?.message });
    }
  });

  cron.schedule("0 19 * * *", async () => {
    logger.info("[Cron] Starting 90-day analytics event purge...");
    try {
      const deletedCount = await prisma.$executeRaw`
        DELETE FROM analytics_events 
        WHERE occurred_at < NOW() - INTERVAL '90 days';
      `;
      logger.info(`[Cron] Purged ${deletedCount} raw events older than 90 days.`);
    } catch (err: any) {
      logger.error("[Cron Error] Event purge failed", { error: err?.message });
    }
  });

  logger.info("[Cron] Workers registered successfully.");
}
