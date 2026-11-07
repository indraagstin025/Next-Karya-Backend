import crypto from "crypto";
import { isIP } from "net";

export const ANALYTICS_TIME_ZONE = "Asia/Jakarta";
export const ANALYTICS_MAX_RANGE_DAYS = 366;
const JAKARTA_OFFSET = "+07:00";
const DEFAULT_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface VisitorHashInput {
  secret: string;
  siteId: string;
  dateKey: string;
  sessionId: string;
  clientIp?: string | null;
}

export interface JakartaDateRange {
  gte: Date;
  lte: Date;
}

export interface JakartaDateKeys {
  fromKey: string;
  toKey: string;
}

export interface OriginCheckInput {
  origin?: string | null;
  referer?: string | null;
  host?: string | null;
  allowedOrigins?: string[];
}

/**
 * Derives a daily visitor identity so repeat visits from the same network count
 * once, without storing the IP address itself.
 */
export function buildVisitorIdHash(input: VisitorHashInput): string {
  const identity = input.clientIp?.trim()
    ? `ip:${input.clientIp.trim()}`
    : `session:${input.sessionId}`;

  return crypto
    .createHmac("sha256", input.secret)
    .update([input.siteId, input.dateKey, identity].join("|"))
    .digest("hex");
}

/**
 * Returns the Jakarta calendar date (YYYY-MM-DD) for a timestamp.
 */
export function getJakartaDateKey(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return date.toISOString().slice(0, 10);
  }

  return `${year}-${month}-${day}`;
}

/**
 * Resolves the Jakarta calendar-day window. Missing bounds fall back to the
 * last 30 days ending today so report endpoints keep their existing defaults.
 */
export function jakartaDateKeys(
  fromDateStr?: string,
  toDateStr?: string,
  now: Date = new Date()
): JakartaDateKeys {
  const toKey = isDateKey(toDateStr) ? toDateStr : getJakartaDateKey(now);
  const fallbackFrom = getJakartaDateKey(
    new Date(
      new Date(`${toKey}T00:00:00.000${JAKARTA_OFFSET}`).getTime() -
        (DEFAULT_RANGE_DAYS - 1) * DAY_MS
    )
  );
  const fromKey = isDateKey(fromDateStr) ? fromDateStr : fallbackFrom;

  return { fromKey, toKey };
}

/**
 * Validates report date filters before they reach the aggregation queries.
 * Returns a user-facing message, or `null` when the range is acceptable.
 */
export function validateAnalyticsDateRange(
  fromDateStr?: string,
  toDateStr?: string,
  now: Date = new Date()
): string | null {
  if (fromDateStr !== undefined && !isDateKey(fromDateStr)) {
    return "Tanggal awal tidak valid.";
  }

  if (toDateStr !== undefined && !isDateKey(toDateStr)) {
    return "Tanggal akhir tidak valid.";
  }

  const { fromKey, toKey } = jakartaDateKeys(fromDateStr, toDateStr, now);
  const fromTime = parseDateKey(fromKey);
  const toTime = parseDateKey(toKey);
  const todayTime = parseDateKey(getJakartaDateKey(now));

  if (fromTime === null || toTime === null || todayTime === null) {
    return "Rentang tanggal tidak valid.";
  }

  if (fromTime > toTime) {
    return "Tanggal awal tidak boleh melewati tanggal akhir.";
  }

  if (toTime > todayTime) {
    return "Tanggal akhir tidak boleh melewati hari ini.";
  }

  const days = Math.round((toTime - fromTime) / DAY_MS) + 1;
  if (days > ANALYTICS_MAX_RANGE_DAYS) {
    return `Rentang maksimal ${ANALYTICS_MAX_RANGE_DAYS} hari.`;
  }

  return null;
}

/**
 * Converts a Jakarta calendar-day window into absolute UTC timestamps so raw
 * event queries match the same days shown by the dashboard.
 */
export function jakartaDateRange(
  fromDateStr?: string,
  toDateStr?: string
): JakartaDateRange {
  const { fromKey, toKey } = jakartaDateKeys(fromDateStr, toDateStr);

  return {
    gte: new Date(`${fromKey}T00:00:00.000${JAKARTA_OFFSET}`),
    lte: new Date(`${toKey}T23:59:59.999${JAKARTA_OFFSET}`),
  };
}

/**
 * Reads the visitor IP forwarded by the Next.js BFF, falling back to the
 * standard proxy headers. Returns null when no valid address is present.
 */
export function resolveClientIp(
  headers: Record<string, string | string[] | undefined>
): string | null {
  const candidates = [
    headerValue(headers["x-analytics-client-ip"]),
    headerValue(headers["cf-connecting-ip"]),
    firstHeaderEntry(headerValue(headers["x-forwarded-for"])),
    headerValue(headers["x-real-ip"]),
  ];

  for (const candidate of candidates) {
    const ip = normalizeIp(candidate);
    if (ip) return ip;
  }

  return null;
}

/**
 * Accepts beacons only from the request's own host or a configured public
 * origin. Missing origin headers stay allowed for mobile in-app webviews.
 */
export function isAllowedAnalyticsOrigin(input: OriginCheckInput): boolean {
  const provided = input.origin?.trim() || input.referer?.trim();
  if (!provided) return true;

  let parsed: URL;
  try {
    parsed = new URL(provided);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  const allowedHosts = new Set<string>();
  const requestHost = input.host?.trim().toLowerCase();
  if (requestHost) allowedHosts.add(requestHost);

  for (const origin of input.allowedOrigins ?? []) {
    const host = parseHost(origin);
    if (host) allowedHosts.add(host);
  }

  return allowedHosts.has(parsed.host.toLowerCase());
}

function parseDateKey(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return timestamp;
}

function isDateKey(value?: string): value is string {
  return typeof value === "string" && parseDateKey(value) !== null;
}

function headerValue(
  value: string | string[] | undefined
): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return typeof value === "string" ? value : null;
}

function firstHeaderEntry(value: string | null): string | null {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}

function parseHost(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

function normalizeIp(raw: string | null): string | null {
  if (!raw) return null;

  let candidate = raw.trim();
  if (!candidate) return null;

  if (candidate.startsWith("[")) {
    const closingBracket = candidate.indexOf("]");
    if (closingBracket > 0) {
      candidate = candidate.slice(1, closingBracket);
    }
  } else if (candidate.split(":").length === 2) {
    const [host, port] = candidate.split(":");
    if (/^\d+$/.test(port)) candidate = host;
  }

  return isIP(candidate) ? candidate : null;
}
