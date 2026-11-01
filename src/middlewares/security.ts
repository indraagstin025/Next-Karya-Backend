import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { defaultLogger, ILogger } from "../core/logger";
import { sendError } from "../utils/response";

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function hasForbiddenKeysOrNullBytes(input: unknown, depth = 0): boolean {
  if (depth > 8 || input === null || input === undefined) {
    return false;
  }
  if (typeof input === "string") {
    return input.includes("\0");
  }
  if (Array.isArray(input)) {
    return input.some((item) => hasForbiddenKeysOrNullBytes(item, depth + 1));
  }
  if (typeof input === "object") {
    for (const key of Object.getOwnPropertyNames(input)) {
      if (FORBIDDEN_OBJECT_KEYS.has(key) || key.includes("\0")) {
        return true;
      }
      const val = (input as Record<string, unknown>)[key];
      if (hasForbiddenKeysOrNullBytes(val, depth + 1)) {
        return true;
      }
    }
  }
  return false;
}

export function createSecurityMiddleware(logger: ILogger = defaultLogger) {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Request Correlation ID
    const incomingReqId = req.headers["x-request-id"];
    const requestId =
      typeof incomingReqId === "string" &&
      /^[a-zA-Z0-9_-]{8,64}$/.test(incomingReqId)
        ? incomingReqId
        : crypto.randomUUID();

    req.requestId = requestId;
    res.setHeader("X-Request-Id", requestId);

    // 2. Hardened Security Headers
    res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    );

    if (
      req.method !== "GET" ||
      req.path.startsWith("/api/v1/auth") ||
      req.path.startsWith("/api/v1/cms") ||
      req.path.startsWith("/api/v1/crm") ||
      req.path.startsWith("/api/v1/emergency") ||
      req.path.startsWith("/api/v1/users")
    ) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
    }

    // 3. Null-byte injection check on URL
    if (req.originalUrl.includes("\0") || req.originalUrl.includes("%00")) {
      logger.security("NULL_BYTE_URL_BLOCKED", {
        requestId,
        ip: req.ip,
        path: req.path,
      });
      return sendError(res, 400, "BAD_REQUEST", "Permintaan mengandung karakter ilegal.");
    }

    // 4. HTTP Parameter Pollution (HPP) Normalization on req.query
    if (req.query && typeof req.query === "object") {
      for (const [key, val] of Object.entries(req.query)) {
        if (Array.isArray(val)) {
          const lastVal = val[val.length - 1];
          (req.query as Record<string, unknown>)[key] =
            typeof lastVal === "string" ? lastVal : String(lastVal ?? "");
        }
      }
    }

    // 5. Prototype Pollution & Null-Byte Inspection on query, params, and body
    if (
      hasForbiddenKeysOrNullBytes(req.query) ||
      hasForbiddenKeysOrNullBytes(req.params) ||
      hasForbiddenKeysOrNullBytes(req.body)
    ) {
      logger.security("MALICIOUS_PAYLOAD_BLOCKED", {
        requestId,
        ip: req.ip,
        path: req.path,
        method: req.method,
      });
      return sendError(
        res,
        400,
        "MALICIOUS_PAYLOAD",
        "Struktur payload tidak diizinkan demi keamanan sistem."
      );
    }

    return next();
  };
}

export const securityMiddleware = createSecurityMiddleware();
