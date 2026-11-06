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

const ANALYTICS_TIME_ZONE = "Asia/Jakarta";

/**
 * Recomputes complete daily rollups for the last `days` calendar days.
 *
 * Four granularities are written so dashboard queries never double count:
 * - `path='*', source='all', device='all'` for site-wide KPIs
 * - `path=<path>, source='all', device='all'` for per-page reporting
 * - `path='*', source=<source>, device='all'` for acquisition channels
 * - `path='*', source='all', device=<device>` for device distribution
 *
 * Because the whole day is recalculated, the job is idempotent and safe to run
 * after downtime or with late-arriving events.
 */
export async function runAnalyticsRollup(
  prisma: PrismaClient,
  logger: ILogger,
  days = 2
): Promise<number> {
  const safeDays = Math.max(1, Math.min(Math.trunc(days), 90));
  const startedAt = Date.now();

  const affected = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        DELETE FROM analytics_daily
        WHERE "date" >= (
          (CURRENT_TIMESTAMP AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date
          - (${safeDays - 1}::int)
        )
        AND "date" <= (CURRENT_TIMESTAMP AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date;
      `;

      return tx.$executeRaw`
    WITH recent AS (
      SELECT
        site_id,
        DATE("occurredAt" AT TIME ZONE ${ANALYTICS_TIME_ZONE}) AS date_bucket,
        path,
        COALESCE(NULLIF(source, ''), 'direct') AS source,
        COALESCE(NULLIF(device, ''), 'unknown') AS device,
        "sessionId",
        "visitorIdHash",
        "eventName",
        "durationSec"
      FROM analytics_events
      WHERE "occurredAt" >= (
        (
          (CURRENT_TIMESTAMP AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date
          - (${safeDays - 1}::int)
        )::timestamp AT TIME ZONE ${ANALYTICS_TIME_ZONE}
      )
    ),
    session_stats AS (
      SELECT
        site_id,
        date_bucket,
        "sessionId",
        COUNT(*) FILTER (WHERE "eventName" = 'pageview') AS pageviews,
        COUNT(*) FILTER (WHERE "eventName" = 'heartbeat') AS heartbeats,
        COUNT(*) FILTER (WHERE "eventName" IN ('whatsapp_click', 'form_submit')) AS conversions
      FROM recent
      GROUP BY site_id, date_bucket, "sessionId"
    ),
    bounced_sessions AS (
      SELECT site_id, date_bucket, "sessionId"
      FROM session_stats
      WHERE pageviews <= 1 AND heartbeats = 0 AND conversions = 0
    ),
    bounce_totals AS (
      SELECT site_id, date_bucket, COUNT(*) AS bounces
      FROM bounced_sessions
      GROUP BY site_id, date_bucket
    ),
    session_paths AS (
      SELECT DISTINCT site_id, date_bucket, "sessionId", path
      FROM recent
      WHERE "eventName" = 'pageview'
    ),
    path_bounces AS (
      SELECT sp.site_id, sp.date_bucket, sp.path, COUNT(*) AS bounces
      FROM session_paths sp
      JOIN bounced_sessions bs
        ON bs.site_id = sp.site_id
       AND bs.date_bucket = sp.date_bucket
       AND bs."sessionId" = sp."sessionId"
      GROUP BY sp.site_id, sp.date_bucket, sp.path
    ),
    global_stats AS (
      SELECT
        r.site_id,
        r.date_bucket,
        '*'::varchar AS path,
        'all'::varchar AS source,
        'all'::varchar AS device,
        COUNT(DISTINCT r."visitorIdHash") AS visitors,
        COUNT(DISTINCT r."sessionId") AS sessions,
        COUNT(*) FILTER (WHERE r."eventName" = 'pageview') AS pageviews,
        COALESCE(SUM(r."durationSec") FILTER (WHERE r."eventName" = 'heartbeat'), 0) AS duration_sec,
        COALESCE(MAX(bt.bounces), 0) AS bounces,
        COUNT(*) FILTER (WHERE r."eventName" = 'whatsapp_click') AS whatsapp_clicks,
        COUNT(*) FILTER (WHERE r."eventName" = 'form_submit') AS form_submits
      FROM recent r
      LEFT JOIN bounce_totals bt
        ON bt.site_id = r.site_id
       AND bt.date_bucket = r.date_bucket
      GROUP BY r.site_id, r.date_bucket
    ),
    path_stats AS (
      SELECT
        r.site_id,
        r.date_bucket,
        r.path,
        'all'::varchar AS source,
        'all'::varchar AS device,
        COUNT(DISTINCT r."visitorIdHash") AS visitors,
        COUNT(DISTINCT r."sessionId") AS sessions,
        COUNT(*) FILTER (WHERE r."eventName" = 'pageview') AS pageviews,
        COALESCE(SUM(r."durationSec") FILTER (WHERE r."eventName" = 'heartbeat'), 0) AS duration_sec,
        COALESCE(MAX(pb.bounces), 0) AS bounces,
        COUNT(*) FILTER (WHERE r."eventName" = 'whatsapp_click') AS whatsapp_clicks,
        COUNT(*) FILTER (WHERE r."eventName" = 'form_submit') AS form_submits
      FROM recent r
      LEFT JOIN path_bounces pb
        ON pb.site_id = r.site_id
       AND pb.date_bucket = r.date_bucket
       AND pb.path = r.path
      GROUP BY r.site_id, r.date_bucket, r.path
    ),
    source_stats AS (
      SELECT
        site_id,
        date_bucket,
        '*'::varchar AS path,
        source,
        'all'::varchar AS device,
        COUNT(DISTINCT "visitorIdHash") AS visitors,
        COUNT(DISTINCT "sessionId") AS sessions,
        COUNT(*) FILTER (WHERE "eventName" = 'pageview') AS pageviews,
        COALESCE(SUM("durationSec") FILTER (WHERE "eventName" = 'heartbeat'), 0) AS duration_sec,
        0::bigint AS bounces,
        COUNT(*) FILTER (WHERE "eventName" = 'whatsapp_click') AS whatsapp_clicks,
        COUNT(*) FILTER (WHERE "eventName" = 'form_submit') AS form_submits
      FROM recent
      GROUP BY site_id, date_bucket, source
    ),
    device_stats AS (
      SELECT
        site_id,
        date_bucket,
        '*'::varchar AS path,
        'all'::varchar AS source,
        device,
        COUNT(DISTINCT "visitorIdHash") AS visitors,
        COUNT(DISTINCT "sessionId") AS sessions,
        COUNT(*) FILTER (WHERE "eventName" = 'pageview') AS pageviews,
        COALESCE(SUM("durationSec") FILTER (WHERE "eventName" = 'heartbeat'), 0) AS duration_sec,
        0::bigint AS bounces,
        COUNT(*) FILTER (WHERE "eventName" = 'whatsapp_click') AS whatsapp_clicks,
        COUNT(*) FILTER (WHERE "eventName" = 'form_submit') AS form_submits
      FROM recent
      GROUP BY site_id, date_bucket, device
    ),
    combined AS (
      SELECT * FROM global_stats
      UNION ALL
      SELECT * FROM path_stats
      UNION ALL
      SELECT * FROM source_stats
      UNION ALL
      SELECT * FROM device_stats
    )
    INSERT INTO analytics_daily (
      site_id,
      "date",
      path,
      source,
      device,
      visitors,
      sessions,
      pageviews,
      "durationSec",
      bounces,
      "whatsappClicks",
      "formSubmits",
      conversions
    )
    SELECT
      site_id,
      date_bucket,
      path,
      source,
      device,
      visitors,
      sessions,
      pageviews,
      duration_sec,
      bounces,
      whatsapp_clicks,
      form_submits,
      whatsapp_clicks + form_submits
    FROM combined
    ON CONFLICT (site_id, "date", path, source, device)
    DO UPDATE SET
      visitors = EXCLUDED.visitors,
      sessions = EXCLUDED.sessions,
      pageviews = EXCLUDED.pageviews,
      "durationSec" = EXCLUDED."durationSec",
      bounces = EXCLUDED.bounces,
      "whatsappClicks" = EXCLUDED."whatsappClicks",
      "formSubmits" = EXCLUDED."formSubmits",
      conversions = EXCLUDED.conversions;
      `;
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  logger.info("[Cron] Analytics rollup completed", {
    days: safeDays,
    affectedRows: affected,
    durationMs: Date.now() - startedAt,
  });

  return affected;
}

/**
 * Recomputes hourly busy-hour rollups for the last `days` Jakarta calendar days.
 *
 * The bucket is `(Jakarta date, hour)`, so the dashboard can read a compact
 * 24-row pattern without scanning raw events. Rebuilding the whole day keeps
 * the job idempotent when late events arrive.
 */
export async function runHourlyAnalyticsRollup(
  prisma: PrismaClient,
  logger: ILogger,
  days = 2
): Promise<number> {
  const startedAt = Date.now();
  const safeDays = Math.max(1, Math.min(90, Math.trunc(days)));

  const affected = await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`
        DELETE FROM analytics_hourly
        WHERE "date" >= (
          (CURRENT_TIMESTAMP AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date
          - (${safeDays - 1}::int)
        )
        AND "date" <= (CURRENT_TIMESTAMP AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date;
      `;

      return tx.$executeRaw`
        WITH recent AS (
          SELECT
            site_id,
            DATE("occurredAt" AT TIME ZONE ${ANALYTICS_TIME_ZONE}) AS date_bucket,
            EXTRACT(HOUR FROM ("occurredAt" AT TIME ZONE ${ANALYTICS_TIME_ZONE}))::int AS hour_bucket,
            "sessionId",
            "visitorIdHash",
            "eventName",
            "durationSec"
          FROM analytics_events
          WHERE "occurredAt" >= (
            (
              (CURRENT_TIMESTAMP AT TIME ZONE ${ANALYTICS_TIME_ZONE})::date
              - (${safeDays - 1}::int)
            )::timestamp AT TIME ZONE ${ANALYTICS_TIME_ZONE}
          )
        ),
        hourly AS (
          SELECT
            site_id,
            date_bucket,
            hour_bucket,
            COUNT(DISTINCT "visitorIdHash") AS visitors,
            COUNT(DISTINCT "sessionId") AS sessions,
            COUNT(*) FILTER (WHERE "eventName" = 'pageview') AS pageviews,
            COALESCE(SUM("durationSec") FILTER (WHERE "eventName" = 'heartbeat'), 0) AS duration_sec,
            COUNT(*) FILTER (WHERE "eventName" IN ('whatsapp_click', 'form_submit')) AS conversions
          FROM recent
          GROUP BY site_id, date_bucket, hour_bucket
        )
        INSERT INTO analytics_hourly (
          site_id,
          "date",
          "hour",
          visitors,
          sessions,
          pageviews,
          "durationSec",
          conversions
        )
        SELECT
          site_id,
          date_bucket,
          hour_bucket,
          visitors,
          sessions,
          pageviews,
          duration_sec,
          conversions
        FROM hourly
        ON CONFLICT (site_id, "date", "hour")
        DO UPDATE SET
          visitors = EXCLUDED.visitors,
          sessions = EXCLUDED.sessions,
          pageviews = EXCLUDED.pageviews,
          "durationSec" = EXCLUDED."durationSec",
          conversions = EXCLUDED.conversions;
      `;
    },
    { maxWait: 10_000, timeout: 120_000 }
  );

  logger.info("[Cron] Hourly analytics rollup completed", {
    days: safeDays,
    affectedRows: affected,
    durationMs: Date.now() - startedAt,
  });

  return affected;
}

/**
 * Deletes raw analytics events older than the retention window.
 */
export async function purgeAnalyticsEvents(
  prisma: PrismaClient,
  logger: ILogger,
  retentionDays = 90
): Promise<number> {
  const safeDays = Math.max(1, Math.trunc(retentionDays));
  const deleted = await prisma.$executeRaw`
    DELETE FROM analytics_events
    WHERE "occurredAt" < NOW() - (${safeDays}::int * INTERVAL '1 day');
  `;

  logger.info("[Cron] Purged raw analytics events", {
    retentionDays: safeDays,
    deletedRows: deleted,
  });

  return deleted;
}

/**
 * Registers background cron schedules for hourly `analytics_daily` and
 * `analytics_hourly` rollups, plus daily 90-day raw `analytics_events`
 * retention cleanup.
 */
export function initCronJobs(deps: Partial<CronDeps> = {}) {
  const prisma = deps.prisma ?? defaultPrisma;
  const logger = deps.logger ?? defaultLogger;

  logger.info("[Cron] Initializing background workers...");

  cron.schedule("0 * * * *", async () => {
    logger.info("[Cron] Starting hourly analytics rollup...");
    try {
      await runAnalyticsRollup(prisma, logger, 2);
    } catch (err: any) {
      logger.error("[Cron Error] Analytics rollup failed", { error: err?.message });
    }

    try {
      await runHourlyAnalyticsRollup(prisma, logger, 2);
    } catch (err: any) {
      logger.error("[Cron Error] Hourly analytics rollup failed", {
        error: err?.message,
      });
    }
  });

  cron.schedule("0 19 * * *", async () => {
    logger.info("[Cron] Starting 90-day analytics event purge...");
    try {
      await purgeAnalyticsEvents(prisma, logger, 90);
    } catch (err: any) {
      logger.error("[Cron Error] Event purge failed", { error: err?.message });
    }
  });

  logger.info("[Cron] Workers registered successfully.");
}
