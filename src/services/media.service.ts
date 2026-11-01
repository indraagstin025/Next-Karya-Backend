import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { env as defaultEnv, EnvConfig } from "../config/env";
import { ITenantGuard } from "../container/types";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import { defaultTenantGuard } from "../utils/optimistic";
import { PaginationMeta } from "../utils/response";

export interface MediaServiceDeps {
  prisma: PrismaClient;
  env: EnvConfig;
  tenantGuard: ITenantGuard;
  logger: ILogger;
}

export class MediaService {
  constructor(
    private readonly deps: MediaServiceDeps = {
      prisma: defaultPrisma,
      env: defaultEnv,
      tenantGuard: defaultTenantGuard,
      logger: defaultLogger,
    }
  ) {}

  async getMedia(query: {
    site_id?: string;
    search?: string;
    mimeType?: string;
    page: number;
    limit: number;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(query.site_id);
    const { search, mimeType, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { site_id };
    if (mimeType) where.mimeType = mimeType;
    if (search) {
      where.OR = [
        { originalName: { contains: search, mode: "insensitive" } },
        { altText: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.deps.prisma.media.count({ where }),
      this.deps.prisma.media.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          uploadedBy: { select: { fullName: true } },
        },
      }),
    ]);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };

    return { items, meta };
  }

  async findDuplicateMedia(
    rawSiteId: string | undefined,
    fileSize: number,
    fileHash: string
  ) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const candidates = await this.deps.prisma.media.findMany({
      where: { site_id, fileSize },
      select: {
        id: true,
        site_id: true,
        fileName: true,
        originalName: true,
        mimeType: true,
        fileSize: true,
        width: true,
        height: true,
        url: true,
        altText: true,
        createdAt: true,
        uploadedBy: { select: { fullName: true } },
      },
    });

    const uploadRoot = path.resolve(process.cwd(), this.deps.env.UPLOAD_DIR);
    for (const cand of candidates) {
      const candPath = path.resolve(uploadRoot, path.basename(cand.fileName));
      if (candPath.startsWith(uploadRoot) && fs.existsSync(candPath)) {
        try {
          const candBuf = fs.readFileSync(candPath);
          const candHash = crypto.createHash("sha256").update(candBuf).digest("hex");
          if (candHash === fileHash) {
            return cand;
          }
        } catch {
          // continue checking other candidates
        }
      }
    }
    return null;
  }

  async saveUploadedFile(
    file: Express.Multer.File,
    rawSiteId: string | undefined,
    uploaderId: string,
    altText?: string,
    width?: number,
    height?: number
  ) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const safeFileName = path.basename(file.filename);
    const fileUrl = `/uploads/${safeFileName}`;
    const cleanAlt = altText ? altText.trim().slice(0, 255) : null;

    const media = await this.deps.prisma.media.create({
      data: {
        site_id,
        fileName: safeFileName,
        originalName: file.originalname.slice(0, 255),
        mimeType: file.mimetype,
        fileSize: file.size,
        width: width ?? null,
        height: height ?? null,
        url: fileUrl,
        altText: cleanAlt,
        uploadedById: uploaderId,
      },
      include: {
        uploadedBy: { select: { fullName: true } },
      },
    });

    return media;
  }

  async deleteMedia(id: string, rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const media = await this.deps.prisma.media.findFirst({
      where: { id, site_id },
    });
    if (!media) {
      throw AppError.notFound("Berkas tidak ditemukan.");
    }

    const [usedInPost, usedInPortfolio] = await Promise.all([
      this.deps.prisma.post.findFirst({
        where: { site_id, coverUrl: media.url },
        select: { id: true, title: true },
      }),
      this.deps.prisma.portfolio.findFirst({
        where: { site_id, thumbnailUrl: media.url },
        select: { id: true, title: true },
      }),
    ]);

    if (usedInPost || usedInPortfolio) {
      throw AppError.badRequest(
        "MEDIA_IN_USE",
        "Berkas tidak dapat dihapus karena masih digunakan pada artikel atau portofolio."
      );
    }

    const uploadRoot = path.resolve(process.cwd(), this.deps.env.UPLOAD_DIR);
    const filePath = path.resolve(uploadRoot, path.basename(media.fileName));
    if (filePath.startsWith(uploadRoot) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err: any) {
        this.deps.logger.warn("Failed to unlink media file from disk", {
          fileName: media.fileName,
          error: err?.message,
        });
      }
    }

    await this.deps.prisma.media.delete({ where: { id: media.id } });
    return { message: "Berkas media berhasil dihapus." };
  }
}
