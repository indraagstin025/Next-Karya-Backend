/**
 * Contract for structured application and security audit logging.
 */
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  security(event: string, meta?: Record<string, unknown>): void;
}

const SENSITIVE_KEY_PATTERN =
  /password|token|secret|authorization|cookie|credential|api[-_]?key/i;

/**
 * Recursively traverses metadata objects up to depth 4, redacting keys that match
 * credential patterns and truncating long strings to prevent log-injection or secret leaks.
 */
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

/**
 * Structured JSON logger that automatically redacts sensitive fields before writing to stdout/stderr.
 */
export class SecurityLogger implements ILogger {
  constructor(private readonly envMode: string = "development") { }

  /**
   * Serializes a log entry as a single-line JSON string with ISO timestamp and sanitized metadata.
   */
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

  /**
   * Records normal operational milestones such as server startup, cron completion, or staff login.
   */
  info(message: string, meta?: Record<string, unknown>): void {
    console.log(this.formatEntry("INFO", message, meta));
  }

  /**
   * Records recoverable anomalies such as webhook retry failures or non-fatal file cleanup issues.
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatEntry("WARN", message, meta));
  }

  /**
   * Records unhandled exceptions and database/infrastructure failures with correlation context.
   */
  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatEntry("ERROR", message, meta));
  }

  /**
   * Records high-priority security events including account lockouts, revoked token usage,
   * emergency overrides, and blocked malicious payloads.
   */
  security(event: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatEntry("SECURITY", `[SECURITY_EVENT] ${event}`, meta));
  }
}

export const defaultLogger: ILogger = new SecurityLogger();
export const logger: ILogger = defaultLogger;
