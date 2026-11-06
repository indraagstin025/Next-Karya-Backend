import { describe, expect, it } from "vitest";
import { analyticsEventSchema } from "./public";

const baseEvent = {
  site_id: "nextkarya-main",
  sessionId: "nk_session_abcdefghijklmnop",
  path: "/layanan",
  source: "direct",
  device: "mobile" as const,
  browser: "Chrome",
  os: "Android",
};

describe("analyticsEventSchema", () => {
  it("accepts a service click with an internal target path", () => {
    const parsed = analyticsEventSchema.parse({
      ...baseEvent,
      eventName: "service_click",
      targetPath: "/layanan/web-development",
    });

    expect(parsed.targetPath).toBe("/layanan/web-development");
  });

  it("accepts a portfolio click with an anchor target", () => {
    const parsed = analyticsEventSchema.parse({
      ...baseEvent,
      eventName: "portfolio_click",
      targetPath: "/portofolio/aplikasi-kasir#galeri",
    });

    expect(parsed.targetPath).toBe("/portofolio/aplikasi-kasir#galeri");
  });

  it("rejects content clicks without a target path", () => {
    expect(() =>
      analyticsEventSchema.parse({
        ...baseEvent,
        eventName: "service_click",
      })
    ).toThrow();
  });

  it("rejects traversal in the target path", () => {
    expect(() =>
      analyticsEventSchema.parse({
        ...baseEvent,
        eventName: "portfolio_click",
        targetPath: "/portofolio/../admin",
      })
    ).toThrow();
  });

  it("still accepts heartbeat duration and rejects it for other events", () => {
    expect(
      analyticsEventSchema.parse({
        ...baseEvent,
        eventName: "heartbeat",
        durationSec: 45,
      }).durationSec
    ).toBe(45);

    expect(() =>
      analyticsEventSchema.parse({
        ...baseEvent,
        eventName: "pageview",
        durationSec: 45,
      })
    ).toThrow();
  });
});
