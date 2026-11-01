import { Request, Response, NextFunction } from "express";
import { cache } from "../config/redis";
import { sendError } from "../utils/response";

export interface RateLimiterOptions {
  windowSec: number;
  maxRequests: number;
  prefix?: string;
}

export function rateLimiter({ windowSec, maxRequests, prefix = "rl" }: RateLimiterOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const forwarded = req.headers["x-forwarded-for"];
      const ip =
        (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : undefined) ||
        req.socket.remoteAddress ||
        "127.0.0.1";

      const key = `${prefix}:${ip}`;

      // In local development, bypass rate limiting for localhost to prevent dev loop lockouts
      if (process.env.NODE_ENV === "development" && (ip === "127.0.0.1" || ip === "::1" || ip.includes("127.0.0.1"))) {
        return next();
      }

      const count = await cache.incr(key, windowSec);

      if (count > maxRequests) {
        res.setHeader("Retry-After", windowSec.toString());
        return sendError(
          res,
          429,
          "RATE_LIMIT_EXCEEDED",
          `Batas frekuensi permintaan terlampaui (maksimal ${maxRequests} permintaan per ${windowSec} detik). Silakan coba lagi nanti.`
        );
      }

      next();
    } catch {
      // In case of any rate limit check error, gracefully allow the request
      next();
    }
  };
}
