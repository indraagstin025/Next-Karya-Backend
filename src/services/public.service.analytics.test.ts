import { describe, expect, it, vi } from "vitest";
import { PublicService } from "./public.service";

const tenantGuard = {
  resolveAuthorizedSiteId: (raw?: unknown) =>
    typeof raw === "string" && raw.length > 0 ? raw : "nextkarya-main",
};

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  security: vi.fn(),
};

function createPublicService() {
  const create = vi.fn().mockResolvedValue({ id: 1n });
  const service = new PublicService({
    prisma: { analyticsEvent: { create } } as never,
    tenantGuard: tenantGuard as never,
    logger: logger as never,
    env: {
      ANALYTICS_SALT_SECRET: "test-analytics-salt-secret-minimum-32-chars",
      JWT_SECRET: "test-jwt-secret-minimum-32-characters-long",
      FRONTEND_URL: "https://nextkarya.web.id",
      NODE_ENV: "production",
    } as never,
  });

  return { service, create };
}

const basePayload = {
  site_id: "nextkarya-main",
  sessionId: "nk_session_abcdefghijklmnop",
  eventName: "pageview" as const,
  path: "/layanan",
  referrer: null,
  source: "direct",
  device: "mobile" as const,
  browser: "Chrome",
  os: "Android",
  durationSec: 0,
};

describe("PublicService.recordAnalyticsEvent", () => {
  it("counts the same IP as one visitor across different sessions", async () => {
    const { service, create } = createPublicService();

    await service.recordAnalyticsEvent(basePayload, {
      clientIp: "203.0.113.7",
      host: "nextkarya.web.id",
    });
    await service.recordAnalyticsEvent(
      {
        ...basePayload,
        sessionId: "nk_session_second_visit_1234",
      },
      {
        clientIp: "203.0.113.7",
        host: "nextkarya.web.id",
      }
    );

    const firstHash = create.mock.calls[0][0].data.visitorIdHash;
    const secondHash = create.mock.calls[1][0].data.visitorIdHash;

    expect(firstHash).toBe(secondHash);
    expect(firstHash).toHaveLength(64);
  });

  it("falls back to the session when no client IP is available", async () => {
    const { service, create } = createPublicService();

    await service.recordAnalyticsEvent(basePayload, {
      host: "nextkarya.web.id",
    });
    await service.recordAnalyticsEvent(basePayload, {
      host: "nextkarya.web.id",
    });

    expect(create.mock.calls[0][0].data.visitorIdHash).toBe(
      create.mock.calls[1][0].data.visitorIdHash
    );
  });

  it("stores the content click target path", async () => {
    const { service, create } = createPublicService();

    await service.recordAnalyticsEvent(
      {
        ...basePayload,
        eventName: "service_click",
        targetPath: "/layanan/web-development",
      },
      { clientIp: "203.0.113.7", host: "nextkarya.web.id" }
    );

    expect(create.mock.calls[0][0].data).toMatchObject({
      eventName: "service_click",
      targetPath: "/layanan/web-development",
      browser: "Chrome",
      os: "Android",
    });
  });

  it("rejects a beacon from an unregistered origin", async () => {
    const { service, create } = createPublicService();

    await expect(
      service.recordAnalyticsEvent(basePayload, {
        clientIp: "203.0.113.7",
        host: "nextkarya.web.id",
        origin: "https://evil.example",
      })
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(create).not.toHaveBeenCalled();
  });

  it("accepts a beacon without origin headers from a mobile webview", async () => {
    const { service, create } = createPublicService();

    await service.recordAnalyticsEvent(basePayload, {
      clientIp: "203.0.113.7",
      host: "nextkarya.web.id",
    });

    expect(create).toHaveBeenCalledOnce();
  });

  it("accepts a beacon from the configured frontend origin", async () => {
    const { service, create } = createPublicService();

    await service.recordAnalyticsEvent(basePayload, {
      clientIp: "203.0.113.7",
      host: "backend-internal:5000",
      origin: "https://nextkarya.web.id",
    });

    expect(create).toHaveBeenCalledOnce();
  });
});
