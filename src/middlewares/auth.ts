import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { env, EnvConfig } from "../config/env";
import { prisma as defaultPrisma } from "../config/prisma";
import { cache as defaultCache } from "../config/redis";
import { ICacheService } from "../container/types";
import { defaultLogger, ILogger } from "../core/logger";
import { sendError } from "../utils/response";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  jobTitle: string;
  role: "STAFF";
  tokenVersion: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export const JWT_ISSUER = "nextkarya-api";
export const JWT_AUDIENCE = "nextkarya-cms";

/**
 * Checks whether an incoming request carries a non-empty `Authorization: Bearer <token>` header,
 * used by dual-mounted public/CMS routes to route authenticated requests to the CMS controller.
 */
export function hasBearerAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  return Boolean(authHeader && authHeader.startsWith("Bearer ") && authHeader.length > 15);
}

/**
 * Builds an Express authentication middleware that verifies HS256 JWT signatures,
 * checks `iss` and `aud` claims, ensures the staff account is active, and validates
 * `tokenVersion` against Redis/PostgreSQL so emergency session revocations take effect immediately.
 */
export function createAuthMiddleware(
  deps: {
    prisma: PrismaClient;
    cache: ICacheService;
    env: EnvConfig;
    logger: ILogger;
  } = {
    prisma: defaultPrisma,
    cache: defaultCache,
    env,
    logger: defaultLogger,
  }
) {
  return async function requireAuthMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return sendError(
        res,
        401,
        "UNAUTHORIZED",
        "Kredensial otentikasi tidak ditemukan. Header Authorization: Bearer <token> wajib disertakan."
      );
    }

    const token = authHeader.substring(7).trim();
    if (!token || token.length > 2048) {
      return sendError(res, 401, "INVALID_TOKEN", "Token otentikasi tidak sah.");
    }

    try {
      const decoded = jwt.verify(token, deps.env.JWT_SECRET, {
        algorithms: ["HS256"],
      }) as {
        userId: string;
        email: string;
        tokenVersion: number;
        role: string;
        iss?: string;
        aud?: string;
      };

      if (
        !decoded ||
        typeof decoded.userId !== "string" ||
        typeof decoded.tokenVersion !== "number"
      ) {
        return sendError(res, 401, "INVALID_TOKEN", "Token otentikasi tidak sah.");
      }

      if (decoded.iss && decoded.iss !== JWT_ISSUER) {
        return sendError(res, 401, "INVALID_TOKEN", "Penerbit token otentikasi tidak dikenal.");
      }

      if (decoded.aud && decoded.aud !== JWT_AUDIENCE) {
        return sendError(res, 401, "INVALID_TOKEN", "Audiens token otentikasi tidak sesuai.");
      }

      const cacheKey = `auth:token_ver:${decoded.userId}`;
      const cachedVersionStr = await deps.cache.get(cacheKey);

      const user = await deps.prisma.user.findUnique({
        where: { id: decoded.userId },
        select: {
          id: true,
          email: true,
          fullName: true,
          jobTitle: true,
          role: true,
          isActive: true,
          tokenVersion: true,
        },
      });

      if (!user) {
        return sendError(res, 401, "USER_NOT_FOUND", "Pengguna tidak ditemukan dalam sistem.");
      }

      if (!user.isActive) {
        deps.logger.security("DISABLED_ACCOUNT_ACCESS_ATTEMPT", {
          userId: user.id,
          email: user.email,
          requestId: req.requestId,
        });
        return sendError(
          res,
          403,
          "ACCOUNT_DISABLED",
          "Akun staf ini sedang dinonaktifkan."
        );
      }

      if (user.role !== "STAFF") {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "Peran pengguna tidak memiliki hak akses ke sumber daya ini."
        );
      }

      const activeVersion =
        cachedVersionStr !== null
          ? Math.max(parseInt(cachedVersionStr, 10), user.tokenVersion)
          : user.tokenVersion;

      if (cachedVersionStr === null || parseInt(cachedVersionStr, 10) !== user.tokenVersion) {
        await deps.cache.set(cacheKey, user.tokenVersion.toString(), 86400);
      }

      if (decoded.tokenVersion !== activeVersion) {
        deps.logger.security("REVOKED_SESSION_TOKEN_USED", {
          userId: user.id,
          tokenVersion: decoded.tokenVersion,
          activeVersion,
          requestId: req.requestId,
        });
        return sendError(
          res,
          403,
          "REVOKED_SESSION",
          "Sesi perangkat ini telah dicabut atau kedaluwarsa. Silakan lakukan login ulang."
        );
      }

      req.user = {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        role: user.role,
        tokenVersion: user.tokenVersion,
      };

      return next();
    } catch (err: any) {
      if (err?.name === "TokenExpiredError") {
        return sendError(
          res,
          401,
          "TOKEN_EXPIRED",
          "Masa berlaku token telah habis. Silakan login kembali."
        );
      }
      return sendError(res, 401, "INVALID_TOKEN", "Tanda tangan token otentikasi tidak sah.");
    }
  };
}

export const requireAuth = createAuthMiddleware();
