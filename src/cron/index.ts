import cron from "node-cron";
import { prisma } from "../config/prisma";

export function initCronJobs() {
  console.log("[Cron] Initializing background workers...");

  // 1. Hourly Rollup (Runs at minute 0 every hour: "0 * * * *")
  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Starting hourly analytics rollup...");
    try {
      // Execute CTE rollup query from raw analytics_events into analytics_daily
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
      console.log("[Cron] Hourly analytics rollup completed successfully.");
    } catch (err: any) {
      console.error("[Cron Error] Analytics rollup failed:", err.message);
    }
  });

  // 2. Daily Purge at 02:00 WIB / 19:00 UTC (Runs every day: "0 19 * * *")
  cron.schedule("0 19 * * *", async () => {
    console.log("[Cron] Starting 90-day analytics event purge...");
    try {
      const deletedCount = await prisma.$executeRaw`
        DELETE FROM analytics_events 
        WHERE occurred_at < NOW() - INTERVAL '90 days';
      `;
      console.log(`[Cron] Purged ${deletedCount} raw events older than 90 days.`);
    } catch (err: any) {
      console.error("[Cron Error] Event purge failed:", err.message);
    }
  });

  console.log("[Cron] Workers registered successfully.");
}
