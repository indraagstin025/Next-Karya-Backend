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

  it("adds reading time and traffic share to the page ranking", async () => {
    const { service } = createService([
      [
        dailyRow({
          path: "/layanan",
          pageviews: 60,
          visitors: 50,
          sessions: 3,
          durationSec: 180,
        }),
        dailyRow({
          path: "/portofolio",
          pageviews: 40,
          visitors: 30,
          sessions: 2,
          durationSec: 120,
        }),
      ],
    ]);

    const result = await service.getPages(
      "nextkarya-main",
      "2026-11-01",
      "2026-11-02"
    );

    expect(result[0]).toMatchObject({
      path: "/layanan",
      pageviews: 60,
      averageDurationSec: 60,
      sharePercentage: 60,
    });
    expect(result[1]).toMatchObject({
      path: "/portofolio",
      pageviews: 40,
      averageDurationSec: 60,
      sharePercentage: 40,
    });
  });

  it("excludes paths that only recorded clicks or heartbeats", async () => {
    const { service } = createService([
      [
        dailyRow({ path: "/layanan", pageviews: 0, visitors: 1, sessions: 1 }),
        dailyRow({
          path: "/blog",
          pageviews: 5,
          visitors: 4,
          sessions: 4,
          durationSec: 40,
        }),
      ],
    ]);

    const result = await service.getPages(
      "nextkarya-main",
      "2026-11-01",
      "2026-11-02"
    );

    expect(result.map((page) => page.path)).toEqual(["/blog"]);
    expect(result[0].sharePercentage).toBe(100);
  });
});

function createEventService(
  rowsByDimension: Record<string, unknown[]>
) {
  const groupBy = vi.fn().mockImplementation((args: { by: string[] }) => {
    return Promise.resolve(rowsByDimension[args.by[0]] ?? []);
  });

  const service = new AnalyticsService({
    prisma: { analyticsEvent: { groupBy } } as never,
    tenantGuard: tenantGuard as never,
  });

  return { service, groupBy };
}

describe("AnalyticsService audience", () => {
  it("aggregates browser and OS shares from pageview events", async () => {
    const { service, groupBy } = createEventService({
      browser: [
        { browser: "Chrome", _count: { _all: 60 } },
        { browser: "Safari", _count: { _all: 40 } },
      ],
      os: [
        { os: "Android", _count: { _all: 70 } },
        { os: "iOS", _count: { _all: 20 } },
        { os: null, _count: { _all: 10 } },
      ],
    });

    const result = await service.getAudience(
      "nextkarya-main",
      "2026-11-01",
      "2026-11-02"
    );

    expect(result.browsers).toEqual([
      { name: "Chrome", pageviews: 60, sharePercentage: 60 },
      { name: "Safari", pageviews: 40, sharePercentage: 40 },
    ]);
    expect(result.os[0]).toEqual({
      name: "Android",
      pageviews: 70,
      sharePercentage: 70,
    });
    expect(result.os[2]).toMatchObject({
      name: "Tidak diketahui",
      pageviews: 10,
      sharePercentage: 10,
    });
    expect(groupBy.mock.calls[0][0].where.occurredAt.gte.toISOString()).toBe(
      "2026-10-31T17:00:00.000Z"
    );
    expect(groupBy.mock.calls[0][0].where.eventName).toBe("pageview");
  });

  it("returns empty breakdowns when there are no pageview events", async () => {
    const { service } = createEventService({ browser: [], os: [] });

    const result = await service.getAudience(
      "nextkarya-main",
      "2026-11-01",
      "2026-11-02"
    );

    expect(result.browsers).toEqual([]);
    expect(result.os).toEqual([]);
  });
});

describe("AnalyticsService content clicks", () => {
  it("ranks service and portfolio click targets", async () => {
    const { service, groupBy } = createEventService({
      eventName: [
        {
          eventName: "portfolio_click",
          targetPath: "/portofolio/aplikasi-kasir",
          _count: { _all: 9 },
        },
        {
          eventName: "service_click",
          targetPath: "/layanan/web-development",
          _count: { _all: 7 },
        },
        {
          eventName: "service_click",
          targetPath: "/layanan#paket-layanan",
          _count: { _all: 3 },
        },
      ],
    });

    const result = await service.getContentClicks(
      "nextkarya-main",
      "2026-11-01",
      "2026-11-02"
    );

    expect(result.items.map((item) => item.targetPath)).toEqual([
      "/portofolio/aplikasi-kasir",
      "/layanan/web-development",
      "/layanan#paket-layanan",
    ]);
    expect(result.items[0]).toMatchObject({
      type: "portfolio",
      clicks: 9,
    });
    expect(result.items[1]).toMatchObject({
      type: "service",
      clicks: 7,
    });
    expect(result.totalServiceClicks).toBe(10);
    expect(result.totalPortfolioClicks).toBe(9);
    expect(groupBy.mock.calls[0][0].where.eventName).toEqual({
      in: ["service_click", "portfolio_click"],
    });
  });
});
