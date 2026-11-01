import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { env as defaultEnv, EnvConfig } from "../config/env";
import { cache as defaultCache } from "../config/redis";
import { ICacheService } from "../container/types";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import { JWT_ISSUER, JWT_AUDIENCE } from "../middlewares/auth";

// Precomputed valid bcrypt hash (cost=10) used when user is not found to prevent timing-attack enumeration
const DUMMY_BCRYPT_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SEC = 900; // 15 minutes

export interface AuthServiceDeps {
  prisma: PrismaClient;
  cache: ICacheService;
  env: EnvConfig;
  logger: ILogger;
}

export class AuthService {
  constructor(
    private readonly deps: AuthServiceDeps = {
      prisma: defaultPrisma,
      cache: defaultCache,
      env: defaultEnv,
      logger: defaultLogger,
    }
  ) {}

  async login(email: string, passwordPlain: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const lockoutKey = `auth:lockout:${normalizedEmail}`;
    const failCountKey = `auth:fail:${normalizedEmail}`;

    // 1. Check account-level lockout
    const isLocked = await this.deps.cache.get(lockoutKey);
    if (isLocked) {
      this.deps.logger.security("LOGIN_ATTEMPT_ON_LOCKED_ACCOUNT", {
        email: normalizedEmail,
      });
      throw AppError.tooManyRequests(
        "Akun ini dikunci sementara selama 15 menit karena terlalu banyak percobaan login yang gagal.",
        "ACCOUNT_LOCKED"
      );
    }

    const user = await this.deps.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // 2. Always execute bcrypt.compare to prevent User Enumeration via Timing Attack
    const targetHash = user ? user.passwordHash : DUMMY_BCRYPT_HASH;
    const isMatch = await bcrypt.compare(passwordPlain, targetHash);

    if (!user || !isMatch) {
      const fails = await this.deps.cache.incr(failCountKey, LOCKOUT_WINDOW_SEC);
      if (fails >= MAX_FAILED_LOGIN_ATTEMPTS) {
        await this.deps.cache.set(lockoutKey, "1", LOCKOUT_WINDOW_SEC);
        this.deps.logger.security("ACCOUNT_LOCKOUT_TRIGGERED", {
          email: normalizedEmail,
          failedAttempts: fails,
        });
      }
      throw AppError.unauthorized(
        "INVALID_CREDENTIALS",
        "Email atau kata sandi tidak sesuai."
      );
    }

    if (!user.isActive) {
      this.deps.logger.security("LOGIN_ATTEMPT_DISABLED_ACCOUNT", {
        userId: user.id,
        email: user.email,
      });
      throw AppError.forbidden(
        "ACCOUNT_DISABLED",
        "Akun staf ini sedang dinonaktifkan."
      );
    }

    // Clear failed login counter upon successful login
    await this.deps.cache.del(failCountKey);

    const payload = {
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.deps.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: 86400,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: crypto.randomUUID(),
    });

    await this.deps.cache.set(
      `auth:token_ver:${user.id}`,
      user.tokenVersion.toString(),
      86400
    );

    this.deps.logger.info("Staff login successful", {
      userId: user.id,
      email: user.email,
    });

    return {
      accessToken,
      expiresIn: 86400,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
    };
  }

  async getStaffUsers() {
    return this.deps.prisma.user.findMany({
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        email: true,
        fullName: true,
        jobTitle: true,
        role: true,
        avatarUrl: true,
        isActive: true,
        tokenVersion: true,
        updatedAt: true,
      },
    });
  }

  async revokeSessions(
    targetUserId: string,
    reason: string,
    executedById: string
  ) {
    const user = await this.deps.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      throw AppError.notFound("Pengguna tidak ditemukan.", "USER_NOT_FOUND");
    }

    const [updatedUser] = await this.deps.prisma.$transaction([
      this.deps.prisma.user.update({
        where: { id: targetUserId },
        data: {
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          tokenVersion: true,
        },
      }),
      this.deps.prisma.emergencyAuditLog.create({
        data: {
          site_id: this.deps.env.SITE_ID,
          actionType: "REVOKE_SESSION",
          targetEntity: "USER",
          targetId: targetUserId,
          reason,
          previousState: { tokenVersion: user.tokenVersion },
          actorId: executedById,
        },
      }),
    ]);

    await this.deps.cache.set(
      `auth:token_ver:${targetUserId}`,
      updatedUser.tokenVersion.toString(),
      86400
    );

    this.deps.logger.security("STAFF_SESSIONS_REVOKED", {
      targetUserId,
      executedById,
      newTokenVersion: updatedUser.tokenVersion,
      reason,
    });

    return {
      message: "Seluruh sesi perangkat untuk staf ini berhasil dicabut.",
      newTokenVersion: updatedUser.tokenVersion,
      auditLogged: true,
    };
  }
}
