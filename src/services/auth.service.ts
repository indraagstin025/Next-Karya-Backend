import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { cache } from "../config/redis";

export class AuthService {
  async login(email: string, passwordPlain: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Email atau kata sandi tidak sesuai.",
      };
    }

    const isMatch = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!isMatch) {
      throw {
        statusCode: 401,
        code: "INVALID_CREDENTIALS",
        message: "Email atau kata sandi tidak sesuai.",
      };
    }

    if (!user.isActive) {
      throw {
        statusCode: 403,
        code: "ACCOUNT_DISABLED",
        message: "Akun staf ini sedang dinonaktifkan.",
      };
    }

    const payload = {
      userId: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: 86400,
    });

    await cache.set(`auth:token_ver:${user.id}`, user.tokenVersion.toString(), 86400);

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
    return prisma.user.findMany({
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
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        email: true,
        fullName: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      throw {
        statusCode: 404,
        code: "USER_NOT_FOUND",
        message: "Pengguna tidak ditemukan.",
      };
    }

    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: targetUserId },
        data: {
          tokenVersion: { increment: 1 },
        },
        select: {
          id: true,
          tokenVersion: true,
        },
      }),
      prisma.emergencyAuditLog.create({
        data: {
          site_id: env.SITE_ID,
          actionType: "REVOKE_SESSION",
          targetEntity: "USER",
          targetId: targetUserId,
          reason,
          previousState: { tokenVersion: user.tokenVersion },
          actorId: executedById,
        },
      }),
    ]);

    await cache.set(
      `auth:token_ver:${targetUserId}`,
      updatedUser.tokenVersion.toString(),
      86400
    );

    return {
      message: "Seluruh sesi perangkat untuk staf ini berhasil dicabut.",
      newTokenVersion: updatedUser.tokenVersion,
      auditLogged: true,
    };
  }
}
