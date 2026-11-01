import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { prisma } from "../config/prisma";
import { cache } from "../config/redis";
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

export function hasBearerAuth(req: Request): boolean {
  const authHeader = req.headers.authorization;
  return Boolean(authHeader && authHeader.startsWith("Bearer ") && authHeader.length > 15);
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      algorithms: ["HS256"],
    }) as {
      userId: string;
      email: string;
      tokenVersion: number;
      role: string;
    };

    if (
      !decoded ||
      typeof decoded.userId !== "string" ||
      typeof decoded.tokenVersion !== "number"
    ) {
      return sendError(res, 401, "INVALID_TOKEN", "Token otentikasi tidak sah.");
    }

    const cacheKey = `auth:token_ver:${decoded.userId}`;
    const cachedVersionStr = await cache.get(cacheKey);

    const user = await prisma.user.findUnique({
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
      await cache.set(cacheKey, user.tokenVersion.toString(), 86400);
    }

    if (decoded.tokenVersion !== activeVersion) {
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
}
