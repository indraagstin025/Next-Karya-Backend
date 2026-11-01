export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  security(event: string, meta?: Record<string, unknown>): void;
}

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|credential|api[-_]?key/i;

function sanitizeMeta(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || value === undefined) {
    return value;
  }
  if (typeof value === "string") {
    return value.length > 500 ? `${value.slice(0, 500)}...[TRUNCATED]` : value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMeta(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(k)) {
        out[k] = "[REDACTED]";
      } else {
        out[k] = sanitizeMeta(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

export class SecurityLogger implements ILogger {
  constructor(private readonly envMode: string = "development") {}

  private formatEntry(
    level: "INFO" | "WARN" | "ERROR" | "SECURITY",
    message: string,
    meta?: Record<string, unknown>
  ): string {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...(meta ? { meta: sanitizeMeta(meta) } : {}),
    };
    return JSON.stringify(payload);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatEntry("INFO", message, meta));
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatEntry("WARN", message, meta));
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatEntry("ERROR", message, meta));
  }

  security(event: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatEntry("SECURITY", `[SECURITY_EVENT] ${event}`, meta));
  }
}

export const defaultLogger: ILogger = new SecurityLogger();
export const logger: ILogger = defaultLogger;

