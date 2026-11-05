import { describe, expect, it, vi } from "vitest";
import { AnalyticsService } from "./analytics.service";

const tenantGuard = {
  resolveAuthorizedSiteId: (raw?: unknown) =>
    typeof raw === "string" && raw.length > 0 ? raw : "nextkarya-main",
};

function dailyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1n,
    site_id: "nextkarya-main",
    date: new Date("2026-11-01T00:00:00.000Z"),
    path: "*",
    source: "all",
    device: "all",
    pageviews: 0,
    visitors: 0,
    sessions: 0,
    bounces: 0,
    durationSec: 0,
    whatsappClicks: 0,
    formSubmits: 0,
    conversions: 0,
    ...overrides,
  };
}

function createService(rowsByCall: unknown[][]) {
  const findMany = vi.fn();
  for (const rows of rowsByCall) {
    findMany.mockResolvedValueOnce(rows);
  }

  const prisma = { analyticsDaily: { findMany } };
  const service = new AnalyticsService({
    prisma: prisma as never,
    tenantGuard: tenantGuard as never,
  });

  return { service, findMany };
}

describe("AnalyticsService", () => {
  it("reads only global rollup rows and computes site-wide KPIs", async () => {
    const { service, findMany } = createService([
      [
        dailyRow({
          visitors: 100,
          sessions: 120,
          pageviews: 300,
          durationSec: 600,
          bounces: 30,
          whatsappClicks: 4,
          formSubmits: 6,
        }),
      ],
      [
        dailyRow({
          visitors: 80,
          sessions: 100,
          pageviews: 200,
          durationSec: 400,
          bounces: 25,
          whatsappClicks: 2,
          formSubmits: 3,
        }),
      ],
      [],
    ]);

    const result = await service.getOverview(
      "nextkarya-main",
      "2026-11-01",
      "2026-11-02"
    );

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      site_id: "nextkarya-main",
      path: "*",
      source: "all",
      device: "all",
    });

    expect(result.metrics.visitors).toBe(100);
    expect(result.metrics.sessions).toBe(120);
    expect(result.metrics.pageviews).toBe(300);
    expect(result.metrics.conversions).toBe(10);
    expect(result.metrics.conversionRate).toBe(10);
    expect(result.metrics.averageDurationSec).toBe(5);
    expect(result.metrics.bounceRate).toBe(25);
    expect(result.metrics.visitorsChange).toBe(25);
  });

  it("uses per-path rows for the page ranking", async () => {
    const { service, findMany } = createService([[]]);

    await service.getPages("nextkarya-main", "2026-11-01", "2026-11-02");

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      path: { not: "*" },
      source: "all",
      device: "all",
    });
  });

  it("uses source dimension rows for acquisition reporting", async () => {
    const { service, findMany } = createService([[]]);

    await service.getSources("nextkarya-main", "2026-11-01", "2026-11-02");

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      path: "*",
      source: { not: "all" },
      device: "all",
    });
  });

  it("uses device dimension rows for device reporting", async () => {
    const { service, findMany } = createService([[]]);

    await service.getDevices("nextkarya-main", "2026-11-01", "2026-11-02");

    expect(findMany.mock.calls[0][0].where).toMatchObject({
      path: "*",
      source: "all",
      device: { not: "all" },
    });
  });

  it("compares a single-day range against the previous day", async () => {
    const { service, findMany } = createService([[dailyRow({ visitors: 10 })], [], []]);

    await service.getOverview("nextkarya-main", "2026-11-02", "2026-11-02");

    const previousWindow = findMany.mock.calls[1][0].where.date;
    expect(previousWindow.gte.toISOString()).toBe("2026-11-01T00:00:00.000Z");
    expect(previousWindow.lte.toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("compares a seven-day range against the previous seven days", async () => {
    const { service, findMany } = createService([[dailyRow({ visitors: 10 })], [], []]);

    await service.getOverview("nextkarya-main", "2026-10-27", "2026-11-02");

    const previousWindow = findMany.mock.calls[1][0].where.date;
    expect(previousWindow.gte.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(previousWindow.lte.toISOString()).toBe("2026-10-26T00:00:00.000Z");
  });
});
