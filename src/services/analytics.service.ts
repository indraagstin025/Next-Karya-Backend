import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { ITenantGuard } from "../container/types";
import { defaultTenantGuard } from "../utils/optimistic";

export interface AnalyticsServiceDeps {
  prisma: PrismaClient;
  tenantGuard: ITenantGuard;
}

/**
 * Aggregates pre-rolled-up daily traffic metrics (`analytics_daily`) for the internal CMS dashboard.
 */
export class AnalyticsService {
  constructor(
    private readonly deps: AnalyticsServiceDeps = {
      prisma: defaultPrisma,
      tenantGuard: defaultTenantGuard,
    }
  ) {}

  /**
   * Computes site-wide KPI totals (visitors, sessions, pageviews, bounce rate, and conversion rate)
   * over the requested date window by querying global rollup rows (`path = '*'`).
   */
  async getOverview(rawSiteId?: string, fromDateStr?: string, toDateStr?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const to = toDateStr ? new Date(toDateStr) : new Date();
    const from = fromDateStr
      ? new Date(fromDateStr)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const records = await this.deps.prisma.analyticsDaily.findMany({
      where: {
        site_id,
        path: "*",
        date: {
          gte: from,
          lte: to,
        },
      },
    });

    let totalVisitors = 0;
    let totalSessions = 0;
    let totalPageviews = 0;
    let totalDurationSec = 0;
    let totalBounces = 0;
    let totalWhatsappClicks = 0;
    let totalFormSubmits = 0;

    for (const r of records) {
      totalVisitors += r.visitors;
      totalSessions += r.sessions;
      totalPageviews += r.pageviews;
      totalDurationSec += r.durationSec;
      totalBounces += r.bounces;
      totalWhatsappClicks += r.whatsappClicks;
      totalFormSubmits += r.formSubmits;
    }

    const totalConversions = totalWhatsappClicks + totalFormSubmits;
    const averageDurationSec =
      totalSessions > 0 ? Math.round(totalDurationSec / totalSessions) : 0;
    const bounceRate =
      totalSessions > 0
        ? parseFloat(((totalBounces / totalSessions) * 100).toFixed(2))
        : 0;
    const conversionRate =
      totalVisitors > 0
        ? parseFloat(((totalConversions / totalVisitors) * 100).toFixed(2))
        : 0;

    let visitorsChange = 0;
    let sessionsChange = 0;
    let pageviewsChange = 0;
    let averageDurationChange = 0;
    let bounceRateChange = 0;
    let conversionsChange = 0;
    let conversionRateChange = 0;

    if (records.length > 0) {
      const windowMs = to.getTime() - from.getTime();
      const prevTo = new Date(from.getTime());
      const prevFrom = new Date(prevTo.getTime() - windowMs);

      const prevRecords = await this.deps.prisma.analyticsDaily.findMany({
        where: {
          site_id,
          path: "*",
          date: {
            gte: prevFrom,
            lte: prevTo,
          },
        },
      });

      if (prevRecords.length > 0) {
        let prevVisitors = 0;
        let prevSessions = 0;
        let prevPageviews = 0;
        let prevDurationSec = 0;
        let prevBounces = 0;
        let prevWhatsapp = 0;
        let prevForm = 0;

        for (const pr of prevRecords) {
          prevVisitors += pr.visitors;
          prevSessions += pr.sessions;
          prevPageviews += pr.pageviews;
          prevDurationSec += pr.durationSec;
          prevBounces += pr.bounces;
          prevWhatsapp += pr.whatsappClicks;
          prevForm += pr.formSubmits;
        }

        const prevConversions = prevWhatsapp + prevForm;
        const prevAvgDuration =
          prevSessions > 0 ? Math.round(prevDurationSec / prevSessions) : 0;
        const prevBounceRate =
          prevSessions > 0 ? (prevBounces / prevSessions) * 100 : 0;
        const prevConversionRate =
          prevVisitors > 0 ? (prevConversions / prevVisitors) * 100 : 0;

        visitorsChange =
          prevVisitors > 0
            ? parseFloat(
                (((totalVisitors - prevVisitors) / prevVisitors) * 100).toFixed(1)
              )
            : 0;
        sessionsChange =
          prevSessions > 0
            ? parseFloat(
                (((totalSessions - prevSessions) / prevSessions) * 100).toFixed(1)
              )
            : 0;
        pageviewsChange =
          prevPageviews > 0
            ? parseFloat(
                (
                  ((totalPageviews - prevPageviews) / prevPageviews) *
                  100
                ).toFixed(1)
              )
            : 0;
        averageDurationChange =
          prevAvgDuration > 0
            ? parseFloat(
                (
                  ((averageDurationSec - prevAvgDuration) / prevAvgDuration) *
                  100
                ).toFixed(1)
              )
            : 0;
        bounceRateChange = parseFloat(
          (bounceRate - prevBounceRate).toFixed(1)
        );
        conversionsChange =
          prevConversions > 0
            ? parseFloat(
                (
                  ((totalConversions - prevConversions) / prevConversions) *
                  100
                ).toFixed(1)
              )
            : 0;
        conversionRateChange = parseFloat(
          (conversionRate - prevConversionRate).toFixed(2)
        );
      }
    }

    return {
      site_id,
      period: {
        from: from.toISOString().slice(0, 10),
        to: to.toISOString().slice(0, 10),
      },
      metrics: {
        visitors: totalVisitors,
        visitorsChange,
        sessions: totalSessions,
        sessionsChange,
        pageviews: totalPageviews,
        pageviewsChange,
        averageDurationSec,
        averageDurationChange,
        bounceRate,
        bounceRateChange,
        whatsappClicks: totalWhatsappClicks,
        formSubmits: totalFormSubmits,
        conversions: totalConversions,
        conversionsChange,
        conversionRate,
        conversionRateChange,
      },
    };
  }

  /**
   * Ranks individual URL paths (`path !== '*'`) by total pageviews and calculates per-page
   * bounce and conversion rates, capped to a maximum of 100 rows.
   */
  async getPages(
    rawSiteId?: string,
    fromDateStr?: string,
    toDateStr?: string,
    limit = 10
  ) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const to = toDateStr ? new Date(toDateStr) : new Date();
    const from = fromDateStr
      ? new Date(fromDateStr)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const records = await this.deps.prisma.analyticsDaily.findMany({
      where: {
        site_id,
        path: { not: "*" },
        date: { gte: from, lte: to },
      },
    });

    const pathMap = new Map<
      string,
      {
        path: string;
        pageviews: number;
        visitors: number;
        sessions: number;
        bounces: number;
        conversions: number;
      }
    >();

    for (const r of records) {
      const existing = pathMap.get(r.path) || {
        path: r.path,
        pageviews: 0,
        visitors: 0,
        sessions: 0,
        bounces: 0,
        conversions: 0,
      };
      existing.pageviews += r.pageviews;
      existing.visitors += r.visitors;
      existing.sessions += r.sessions;
      existing.bounces += r.bounces;
      existing.conversions += r.whatsappClicks + r.formSubmits;
      pathMap.set(r.path, existing);
    }

    const sorted = Array.from(pathMap.values())
      .sort((a, b) => b.pageviews - a.pageviews)
      .slice(0, safeLimit);

    return sorted.map((r) => {
      const pageviews = r.pageviews;
      const visitors = r.visitors;
      const bounceRate =
        r.sessions > 0
          ? parseFloat(((r.bounces / r.sessions) * 100).toFixed(2))
          : 0;
      const conversionRate =
        visitors > 0
          ? parseFloat(((r.conversions / visitors) * 100).toFixed(2))
          : 0;

      return {
        path: r.path,
        pageviews,
        visitors,
        bounceRate,
        conversions: r.conversions,
        conversionRate,
      };
    });
  }

  /**
   * Groups daily analytics rollups by acquisition channel (`google`, `direct`, `instagram`, `referral`)
   * and computes each channel's percentage share of total pageviews.
   */
  async getSources(rawSiteId?: string, fromDateStr?: string, toDateStr?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const to = toDateStr ? new Date(toDateStr) : new Date();
    const from = fromDateStr
      ? new Date(fromDateStr)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const records = await this.deps.prisma.analyticsDaily.findMany({
      where: {
        site_id,
        path: { not: "*" },
        source: { not: "all" },
        date: { gte: from, lte: to },
      },
    });

    const sourceMap = new Map<
      string,
      {
        source: string;
        pageviews: number;
        visitors: number;
        conversions: number;
      }
    >();

    for (const r of records) {
      const src = r.source || "direct";
      const existing = sourceMap.get(src) || {
        source: src,
        pageviews: 0,
        visitors: 0,
        conversions: 0,
      };
      existing.pageviews += r.pageviews;
      existing.visitors += r.visitors;
      existing.conversions += r.whatsappClicks + r.formSubmits;
      sourceMap.set(src, existing);
    }

    const rows = Array.from(sourceMap.values()).sort(
      (a, b) => b.pageviews - a.pageviews
    );
    const totalPageviews = rows.reduce((acc, r) => acc + r.pageviews, 0);

    const labels: Record<string, string> = {
      google: "Pencarian Organik (Google)",
      direct: "Langsung (Direct)",
      instagram: "Media Sosial (Instagram)",
      referral: "Tautan Rujukan Mitra",
      unknown: "Lainnya",
    };

    return rows.map((r) => {
      const pageviews = r.pageviews;
      const sharePercentage =
        totalPageviews > 0
          ? parseFloat(((pageviews / totalPageviews) * 100).toFixed(2))
          : 0;

      return {
        source: r.source,
        label: labels[r.source] || r.source,
        pageviews,
        visitors: r.visitors,
        conversions: r.conversions,
        sharePercentage,
      };
    });
  }
}
