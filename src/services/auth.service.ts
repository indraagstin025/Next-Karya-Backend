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
import { JWT_ISSUER, JWT_AUDIENCE, isAdminEmail } from "../middlewares/auth";

// Precomputed valid bcrypt hash (cost=10) used when user is not found to prevent timing-attack enumeration
const DUMMY_BCRYPT_HASH =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_WINDOW_SEC = 900;
const STAFF_SESSION_SECONDS = 7 * 24 * 60 * 60;
const PASSWORD_HASH_COST = 12;

export interface CreateStaffUserInput {
  email: string;
  password: string;
  fullName: string;
  jobTitle: string;
}

export interface UpdateStaffUserInput {
  fullName?: string;
  jobTitle?: string;
  isActive?: boolean;
}

const STAFF_USER_SELECT = {
  id: true,
  email: true,
  fullName: true,
  jobTitle: true,
  role: true,
  avatarUrl: true,
  isActive: true,
  tokenVersion: true,
  updatedAt: true,
} as const;

export interface AuthServiceDeps {
  prisma: PrismaClient;
  cache: ICacheService;
  env: EnvConfig;
  logger: ILogger;
}

/**
 * Handles staff authentication, brute-force account lockout, and emergency session revocation.
 */
export class AuthService {
  constructor(
    private readonly deps: AuthServiceDeps = {
      prisma: defaultPrisma,
      cache: defaultCache,
      env: defaultEnv,
      logger: defaultLogger,
    }
  ) {}

  /**
   * Authenticates a staff user with constant-time bcrypt comparison (even when the email does not exist)
   * and enforces a 15-minute account lockout after 5 consecutive failed attempts.
   * Issues an HS256 JWT containing `iss`, `aud`, `jti`, and `tokenVersion` claims.
   */
  async login(email: string, passwordPlain: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const lockoutKey = `auth:lockout:${normalizedEmail}`;
    const failCountKey = `auth:fail:${normalizedEmail}`;

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
        "Akun ini sedang dinonaktifkan. Hubungi admin."
      );
    }

    await this.deps.cache.del(failCountKey);

    const payload = {
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, this.deps.env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: STAFF_SESSION_SECONDS,
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      jwtid: crypto.randomUUID(),
    });

    await this.deps.cache.set(
      `auth:token_ver:${user.id}`,
      user.tokenVersion.toString(),
      STAFF_SESSION_SECONDS
    );

    this.deps.logger.info("Staff login successful", {
      userId: user.id,
      email: user.email,
    });

    return {
      accessToken,
      expiresIn: STAFF_SESSION_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        jobTitle: user.jobTitle,
        role: user.role,
        tokenVersion: user.tokenVersion,
        isAdmin: isAdminEmail(user.email, this.deps.env.STAFF_ADMIN_EMAILS),
      },
    };
  }

  /**
   * Lists all registered staff members ordered alphabetically, omitting `passwordHash`
   * so sensitive credentials are never serialized to the client.
   */
  async getStaffUsers() {
    const users = await this.deps.prisma.user.findMany({
      orderBy: { fullName: "asc" },
      select: STAFF_USER_SELECT,
    });

    return users.map((user) => ({
      ...user,
      isAdmin: isAdminEmail(user.email, this.deps.env.STAFF_ADMIN_EMAILS),
    }));
  }

  /**
   * Membuat akun staf baru. Hanya dipanggil dari route yang sudah dilindungi admin.
   * Kata sandi di-hash dengan bcrypt cost 12 dan tidak pernah dikembalikan ke klien.
   */
  async createStaffUser(input: CreateStaffUserInput) {
    const normalizedEmail = input.email.trim().toLowerCase();

    const existing = await this.deps.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      throw AppError.conflict(
        "EMAIL_ALREADY_REGISTERED",
        "Email ini sudah dipakai akun lain. Gunakan email yang berbeda."
      );
    }

    const passwordHash = await bcrypt.hash(input.password, PASSWORD_HASH_COST);

    const user = await this.deps.prisma.user.create({
      data: {
        email: normalizedEmail,
        fullName: input.fullName.trim(),
        jobTitle: input.jobTitle.trim(),
        passwordHash,
        role: "STAFF",
        isActive: true,
        tokenVersion: 1,
      },
      select: STAFF_USER_SELECT,
    });

    this.deps.logger.security("STAFF_ACCOUNT_CREATED", {
      userId: user.id,
      email: user.email,
    });

    return {
      ...user,
      isAdmin: isAdminEmail(user.email, this.deps.env.STAFF_ADMIN_EMAILS),
      message: `Akun ${user.fullName} berhasil dibuat. Sampaikan kata sandi awalnya secara langsung kepada yang bersangkutan.`,
    };
  }

  /**
   * Memperbarui identitas dan status aktif akun staf. Admin tidak bisa menonaktifkan
   * akunnya sendiri agar akses pengelolaan kata sandi tidak terkunci.
   */
  async updateStaffUser(
    targetUserId: string,
    input: UpdateStaffUserInput,
    actorId: string
  ) {
    const existing = await this.deps.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, fullName: true, isActive: true },
    });

    if (!existing) {
      throw AppError.notFound("Akun tidak ditemukan.", "USER_NOT_FOUND");
    }

    if (input.isActive === false && targetUserId === actorId) {
      throw AppError.badRequest(
        "CANNOT_DISABLE_SELF",
        "Anda tidak bisa menonaktifkan akun yang sedang Anda pakai."
      );
    }

    // Menonaktifkan akun juga mencabut sesi yang masih berjalan. Tanpa ini,
    // sesi lama akan aktif kembali begitu akun diaktifkan lagi.
    const isBeingDeactivated = input.isActive === false && existing.isActive;

    const user = await this.deps.prisma.user.update({
      where: { id: targetUserId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName.trim() } : {}),
        ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle.trim() } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(isBeingDeactivated ? { tokenVersion: { increment: 1 } } : {}),
      },
      select: STAFF_USER_SELECT,
    });

    if (isBeingDeactivated) {
      await this.deps.cache.set(
        `auth:token_ver:${targetUserId}`,
        user.tokenVersion.toString(),
        86400
      );
    }

    this.deps.logger.security("STAFF_ACCOUNT_UPDATED", {
      targetUserId,
      executedById: actorId,
      isActive: user.isActive,
      sessionsRevoked: isBeingDeactivated,
    });

    return {
      ...user,
      isAdmin: isAdminEmail(user.email, this.deps.env.STAFF_ADMIN_EMAILS),
      message: `Data akun ${user.fullName} berhasil diperbarui.`,
    };
  }

  /**
   * Mengatur ulang kata sandi staf lain tanpa meminta kata sandi lama.
   * `tokenVersion` dinaikkan agar semua sesi lama langsung ditolak.
   */
  async resetPassword(
    targetUserId: string,
    newPassword: string,
    actorId: string
  ) {
    if (targetUserId === actorId) {
      throw AppError.badRequest(
        "USE_CHANGE_PASSWORD",
        "Untuk akun sendiri, ganti kata sandi lewat menu Profil Saya agar kata sandi saat ini ikut diverifikasi."
      );
    }

    const existing = await this.deps.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, fullName: true },
    });

    if (!existing) {
      throw AppError.notFound("Akun tidak ditemukan.", "USER_NOT_FOUND");
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);

    const updatedUser = await this.deps.prisma.user.update({
      where: { id: targetUserId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
      select: { id: true, tokenVersion: true },
    });

    await this.deps.cache.set(
      `auth:token_ver:${targetUserId}`,
      updatedUser.tokenVersion.toString(),
      86400
    );

    this.deps.logger.security("STAFF_PASSWORD_RESET", {
      targetUserId,
      executedById: actorId,
      newTokenVersion: updatedUser.tokenVersion,
    });

    return {
      message: `Kata sandi ${existing.fullName} berhasil diatur ulang. Semua sesi lamanya sudah dikeluarkan.`,
      newTokenVersion: updatedUser.tokenVersion,
    };
  }

  /**
   * Mengubah kata sandi akun sendiri dengan verifikasi kata sandi saat ini.
   * Sesi aktif ikut berakhir karena `tokenVersion` naik, sehingga pengguna
   * harus masuk kembali memakai kata sandi baru.
   */
  async changeOwnPassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ) {
    const user = await this.deps.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true, fullName: true },
    });

    if (!user) {
      throw AppError.notFound("Akun tidak ditemukan.", "USER_NOT_FOUND");
    }

    const isCurrentMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isCurrentMatch) {
      throw AppError.badRequest(
        "CURRENT_PASSWORD_MISMATCH",
        "Kata sandi saat ini tidak sesuai. Periksa kembali lalu coba lagi."
      );
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw AppError.badRequest(
        "PASSWORD_UNCHANGED",
        "Kata sandi baru harus berbeda dari kata sandi saat ini."
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_HASH_COST);

    const updatedUser = await this.deps.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        tokenVersion: { increment: 1 },
      },
      select: { id: true, tokenVersion: true },
    });

    await this.deps.cache.set(
      `auth:token_ver:${userId}`,
      updatedUser.tokenVersion.toString(),
      86400
    );

    this.deps.logger.security("STAFF_PASSWORD_CHANGED", {
      userId,
      newTokenVersion: updatedUser.tokenVersion,
    });

    return {
      message:
        "Kata sandi berhasil diubah. Silakan masuk kembali memakai kata sandi baru.",
      newTokenVersion: updatedUser.tokenVersion,
    };
  }

  /**
   * Atomically increments `tokenVersion` in PostgreSQL, records an immutable `EmergencyAuditLog`,
   * and updates the Redis token-version key so all existing JWTs for that staff member are immediately rejected.
   */
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
      throw AppError.notFound("Akun tidak ditemukan.", "USER_NOT_FOUND");
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
      message: "Semua perangkat untuk akun ini sudah dikeluarkan. Yang bersangkutan perlu masuk kembali.",
      newTokenVersion: updatedUser.tokenVersion,
      auditLogged: true,
    };
  }
}
