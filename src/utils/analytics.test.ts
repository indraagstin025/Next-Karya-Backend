import { describe, expect, it } from "vitest";
import {
  ANALYTICS_MAX_RANGE_DAYS,
  buildVisitorIdHash,
  getJakartaDateKey,
  isAllowedAnalyticsOrigin,
  jakartaDateKeys,
  jakartaDateRange,
  resolveClientIp,
  validateAnalyticsDateRange,
} from "./analytics";

const secret = "test-analytics-salt-secret-minimum-32-characters";
const baseInput = {
  secret,
  siteId: "nextkarya-main",
  dateKey: "2026-11-06",
  sessionId: "nk_session_abcdefghijklmnop",
};

describe("buildVisitorIdHash", () => {
  it("maps the same IP to one visitor within the same Jakarta day", () => {
    const first = buildVisitorIdHash({
      ...baseInput,
      clientIp: "203.0.113.7",
    });
    const second = buildVisitorIdHash({
      ...baseInput,
      clientIp: "203.0.113.7",
      sessionId: "nk_session_other_device_1234",
    });

    expect(first).toBe(second);
    expect(first).toHaveLength(64);
  });

  it("separates the same IP across different days", () => {
    const today = buildVisitorIdHash({
      ...baseInput,
      clientIp: "203.0.113.7",
    });
    const tomorrow = buildVisitorIdHash({
      ...baseInput,
      dateKey: "2026-11-07",
      clientIp: "203.0.113.7",
    });

    expect(today).not.toBe(tomorrow);
  });

  it("separates different IPs on the same day", () => {
    const first = buildVisitorIdHash({
      ...baseInput,
      clientIp: "203.0.113.7",
    });
    const second = buildVisitorIdHash({
      ...baseInput,
      clientIp: "203.0.113.8",
    });

    expect(first).not.toBe(second);
  });

  it("falls back to the session when the IP is unavailable", () => {
    const first = buildVisitorIdHash({ ...baseInput, clientIp: null });
    const reusedSession = buildVisitorIdHash({
      ...baseInput,
      clientIp: null,
    });
    const rotatedSession = buildVisitorIdHash({
      ...baseInput,
      clientIp: null,
      sessionId: "nk_session_rotated_after_idle",
    });

    expect(first).toBe(reusedSession);
    expect(first).not.toBe(rotatedSession);
  });

  it("never embeds the raw IP in the stored hash", () => {
    const hash = buildVisitorIdHash({
      ...baseInput,
      clientIp: "203.0.113.7",
    });

    expect(hash).not.toContain("203.0.113.7");
  });
});

describe("resolveClientIp", () => {
  it("prefers the explicit BFF analytics header", () => {
    expect(
      resolveClientIp({
        "x-analytics-client-ip": "203.0.113.7",
        "x-forwarded-for": "198.51.100.20, 10.0.0.1",
        "x-real-ip": "10.0.0.2",
      })
    ).toBe("203.0.113.7");
  });

  it("uses the first forwarded address when the explicit header is absent", () => {
    expect(
      resolveClientIp({
        "x-forwarded-for": "198.51.100.20, 10.0.0.1",
      })
    ).toBe("198.51.100.20");
  });

  it("ignores malformed values", () => {
    expect(resolveClientIp({ "x-analytics-client-ip": "not-an-ip" })).toBeNull();
    expect(resolveClientIp({})).toBeNull();
  });
});

describe("getJakartaDateKey", () => {
  it("rolls over at Jakarta midnight", () => {
    expect(getJakartaDateKey(new Date("2026-11-05T16:59:59.999Z"))).toBe(
      "2026-11-05"
    );
    expect(getJakartaDateKey(new Date("2026-11-05T17:00:00.000Z"))).toBe(
      "2026-11-06"
    );
  });
});

describe("jakartaDateRange", () => {
  it("covers complete Jakarta calendar days", () => {
    const range = jakartaDateRange("2026-11-01", "2026-11-02");

    expect(range.gte.toISOString()).toBe("2026-10-31T17:00:00.000Z");
    expect(range.lte.toISOString()).toBe("2026-11-02T16:59:59.999Z");
  });
});

describe("jakartaDateKeys", () => {
  it("keeps explicit valid bounds", () => {
    expect(jakartaDateKeys("2026-11-01", "2026-11-02")).toEqual({
      fromKey: "2026-11-01",
      toKey: "2026-11-02",
    });
  });

  it("falls back to a 30-day window ending at the explicit end date", () => {
    expect(jakartaDateKeys(undefined, "2026-11-06")).toEqual({
      fromKey: "2026-10-08",
      toKey: "2026-11-06",
    });
  });
});

describe("validateAnalyticsDateRange", () => {
  const now = new Date("2026-11-06T05:00:00.000Z");

  it("accepts a normal range", () => {
    expect(
      validateAnalyticsDateRange("2026-10-01", "2026-10-31", now)
    ).toBeNull();
  });

  it("accepts an omitted end date because it defaults to today", () => {
    expect(validateAnalyticsDateRange("2026-11-01", undefined, now)).toBeNull();
  });

  it("rejects malformed or impossible dates", () => {
    expect(validateAnalyticsDateRange("2026-13-01", "2026-11-06", now)).toBe(
      "Tanggal awal tidak valid."
    );
    expect(validateAnalyticsDateRange("2026-02-30", "2026-03-01", now)).toBe(
      "Tanggal awal tidak valid."
    );
    expect(validateAnalyticsDateRange("2026-11-01", "today", now)).toBe(
      "Tanggal akhir tidak valid."
    );
  });

  it("rejects reversed dates", () => {
    expect(validateAnalyticsDateRange("2026-11-07", "2026-11-06", now)).toBe(
      "Tanggal awal tidak boleh melewati tanggal akhir."
    );
  });

  it("rejects a future end date", () => {
    expect(validateAnalyticsDateRange("2026-11-01", "2026-11-07", now)).toBe(
      "Tanggal akhir tidak boleh melewati hari ini."
    );
  });

  it("rejects a range longer than the maximum", () => {
    expect(
      validateAnalyticsDateRange("2024-01-01", "2026-01-02", now)
    ).toBe(`Rentang maksimal ${ANALYTICS_MAX_RANGE_DAYS} hari.`);
  });
});

describe("isAllowedAnalyticsOrigin", () => {
  const allowed = ["https://nextkarya.web.id", "http://localhost:3000"];

  it("accepts the canonical site origin", () => {
    expect(
      isAllowedAnalyticsOrigin({
        origin: "https://nextkarya.web.id",
        host: "nextkarya.web.id",
        allowedOrigins: allowed,
      })
    ).toBe(true);
  });

  it("rejects an unknown origin", () => {
    expect(
      isAllowedAnalyticsOrigin({
        origin: "https://evil.example",
        host: "nextkarya.web.id",
        allowedOrigins: allowed,
      })
    ).toBe(false);
  });

  it("uses the referer when the origin header is absent", () => {
    expect(
      isAllowedAnalyticsOrigin({
        referer: "https://nextkarya.web.id/layanan",
        host: "nextkarya.web.id",
        allowedOrigins: allowed,
      })
    ).toBe(true);
  });

  it("allows requests without origin and referer for mobile webviews", () => {
    expect(
      isAllowedAnalyticsOrigin({
        host: "nextkarya.web.id",
        allowedOrigins: allowed,
      })
    ).toBe(true);
  });

  it("rejects a malformed origin", () => {
    expect(
      isAllowedAnalyticsOrigin({
        origin: "nextkarya.web.id",
        host: "nextkarya.web.id",
        allowedOrigins: allowed,
      })
    ).toBe(false);
  });
});
