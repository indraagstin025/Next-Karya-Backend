import { Request, Response, NextFunction } from "express";
import { cache as defaultCache } from "../config/redis";
import { env as defaultEnv, EnvConfig } from "../config/env";
import { ICacheService } from "../container/types";
import { sendError } from "../utils/response";

export interface RateLimiterOptions {
  windowSec: number;
  maxRequests: number;
  prefix?: string;
}

/**
 * Creates a configurable fixed-window IP rate limiter factory backed by `ICacheService`.
 * Emits `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and `Retry-After` headers,
 * and bypasses loopback requests in `development` mode to prevent local dev lockouts.
 */
export function createRateLimiterFactory(
  deps: { cache: ICacheService; env: EnvConfig } = {
    cache: defaultCache,
    env: defaultEnv,
  }
) {
  return function rateLimiter({
    windowSec,
    maxRequests,
    prefix = "rl",
  }: RateLimiterOptions) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const forwarded = req.headers["x-forwarded-for"];
        const ip =
          (typeof forwarded === "string"
            ? forwarded.split(",")[0].trim()
            : undefined) ||
          req.socket.remoteAddress ||
          "127.0.0.1";

        const key = `${prefix}:${ip}`;

        if (
          deps.env.NODE_ENV === "development" &&
          (ip === "127.0.0.1" || ip === "::1" || ip.includes("127.0.0.1"))
        ) {
          return next();
        }

        const count = await deps.cache.incr(key, windowSec);
        const remaining = Math.max(0, maxRequests - count);

        res.setHeader("X-RateLimit-Limit", maxRequests.toString());
        res.setHeader("X-RateLimit-Remaining", remaining.toString());

        if (count > maxRequests) {
          res.setHeader("Retry-After", windowSec.toString());
          return sendError(
            res,
            429,
            "RATE_LIMIT_EXCEEDED",
            `Batas frekuensi permintaan terlampaui (maksimal ${maxRequests} permintaan per ${windowSec} detik). Silakan coba lagi nanti.`
          );
        }

        return next();
      } catch {
        // Allow request through if cache backend experiences a transient failure.
        return next();
      }
    };
  };
}

export const rateLimiter = createRateLimiterFactory();
