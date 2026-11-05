import fs from "fs";
import path from "path";
import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { env as defaultEnv, EnvConfig } from "../config/env";
import { cache as defaultCache } from "../config/redis";
import { extensionForMime, maxBytesForMime } from "../config/media";
import { ICacheService, ITenantGuard } from "../container/types";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import { defaultTenantGuard } from "../utils/optimistic";
import { PaginationMeta } from "../utils/response";
import { IStorageService, createStorageService } from "./storage.service";

export interface MediaServiceDeps {
  prisma: PrismaClient;
  env: EnvConfig;
  cache: ICacheService;
  tenantGuard: ITenantGuard;
  logger: ILogger;
  storage: IStorageService;
}

interface PendingMediaUpload {
  siteId: string;
  uploaderId: string;
  path: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  altText: string | null;
  width: number | null;
  height: number | null;
}

export interface CreateMediaUploadInput {
  siteId?: string;
  uploaderId: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  altText?: string;
  width?: number;
  height?: number;
}

export interface ConfirmMediaUploadInput {
  ticketId: string;
  siteId?: string;
  uploaderId: string;
  altText?: string;
  width?: number;
  height?: number;
}

export interface UpdateMediaInput {
  altText: string | null;
}

const PENDING_UPLOAD_PREFIX = "media_upload:";

/**
 * Manages uploaded media metadata in PostgreSQL, local filesystem deduplication, and
 * Supabase Storage object lifecycle. File bytes for direct uploads never pass through here.
 */
export class MediaService {
  constructor(
    private readonly deps: MediaServiceDeps = {
      prisma: defaultPrisma,
      env: defaultEnv,
      cache: defaultCache,
      tenantGuard: defaultTenantGuard,
      logger: defaultLogger,
      storage: createStorageService(defaultEnv),
    }
  ) {}

  /**
   * Lists paginated media library records scoped to `site_id`, optionally filtered by MIME type or search keyword.
   */
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

  /**
   * Checks whether an identical file already exists in the tenant's media library by narrowing
   * candidates with matching `fileSize` and comparing their on-disk SHA-256 checksums.
   */
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
      if (cand.fileName.includes("/")) continue;
      const candPath = path.resolve(uploadRoot, path.basename(cand.fileName));
      if (candPath.startsWith(uploadRoot) && fs.existsSync(candPath)) {
        try {
          const candBuf = fs.readFileSync(candPath);
          const candHash = crypto.createHash("sha256").update(candBuf).digest("hex");
          if (candHash === fileHash) {
            return cand;
          }
        } catch {
          // Ignore unreadable candidate file and continue scanning.
        }
      }
    }
    return null;
  }

  /**
   * Persists metadata for a validated upload in PostgreSQL, stripping any directory components
   * from `fileName` via `path.basename` to guarantee safe static serving under `/uploads`.
   */
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

  /**
   * Creates a short-lived signed upload URL and remembers the pending object path in cache.
   * The browser uploads bytes directly to Supabase Storage; only metadata reaches this service.
   */
  async createUploadTicket(input: CreateMediaUploadInput) {
    if (!this.deps.storage.enabled) {
      throw AppError.badRequest(
        "DIRECT_UPLOAD_DISABLED",
        "Unggah langsung belum aktif. Berkas masih disimpan melalui server lokal."
      );
    }

    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(input.siteId);
    const maxBytes = maxBytesForMime(input.mimeType);
    if (!maxBytes) {
      throw AppError.badRequest(
        "UNSUPPORTED_MEDIA_TYPE",
        "Jenis berkas ini tidak didukung. Gunakan WebP, PNG, JPEG, SVG, atau PDF."
      );
    }

    if (!Number.isFinite(input.fileSize) || input.fileSize <= 0) {
      throw AppError.badRequest("EMPTY_FILE", "Berkas kosong tidak bisa diunggah.");
    }

    if (input.fileSize > maxBytes) {
      throw AppError.badRequest(
        "FILE_TOO_LARGE",
        input.mimeType === "application/pdf"
          ? "Berkas terlalu besar. Maksimal 10 MB untuk PDF."
          : "Berkas terlalu besar. Maksimal 5 MB untuk gambar."
      );
    }

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const objectPath = `${site_id}/${year}/${month}/${crypto.randomUUID()}${extensionForMime(input.mimeType)}`;
    const ticketId = crypto.randomUUID();
    const ttlSeconds = this.deps.env.SUPABASE_SIGNED_UPLOAD_TTL_SECONDS;

    let signed;
    try {
      signed = await this.deps.storage.createSignedUploadUrl(objectPath);
    } catch (err: any) {
      this.deps.logger.error("Failed to create Supabase signed upload URL", {
        bucket: this.deps.env.SUPABASE_STORAGE_BUCKET,
        error: err?.message,
      });
      throw new AppError(
        502,
        "STORAGE_UNAVAILABLE",
        "Layanan penyimpanan media belum siap. Periksa konfigurasi bucket Supabase lalu coba lagi."
      );
    }

    const pending: PendingMediaUpload = {
      siteId: site_id,
      uploaderId: input.uploaderId,
      path: objectPath,
      originalName: input.originalName.trim().slice(0, 255),
      mimeType: input.mimeType,
      fileSize: input.fileSize,
      altText: input.altText?.trim().slice(0, 255) || null,
      width: this.normalizeDimension(input.width),
      height: this.normalizeDimension(input.height),
    };

    await this.deps.cache.set(
      `${PENDING_UPLOAD_PREFIX}${ticketId}`,
      JSON.stringify(pending),
      ttlSeconds
    );

    return {
      ticketId,
      uploadUrl: signed.signedUrl,
      path: objectPath,
      expiresIn: ttlSeconds,
    };
  }

  /**
   * Verifies the uploaded object metadata against the signed ticket before writing the
   * `Media` row. Mismatched objects are removed so the bucket does not keep rejected files.
   */
  async confirmUpload(input: ConfirmMediaUploadInput) {
    if (!this.deps.storage.enabled) {
      throw AppError.badRequest(
        "DIRECT_UPLOAD_DISABLED",
        "Unggah langsung belum aktif. Berkas masih disimpan melalui server lokal."
      );
    }

    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(input.siteId);
    const cacheKey = `${PENDING_UPLOAD_PREFIX}${input.ticketId}`;
    const rawTicket = await this.deps.cache.get(cacheKey);

    if (!rawTicket) {
      throw AppError.badRequest(
        "UPLOAD_TICKET_EXPIRED",
        "Sesi unggah sudah kedaluwarsa. Silakan pilih dan unggah berkas kembali."
      );
    }

    let pending: PendingMediaUpload;
    try {
      pending = JSON.parse(rawTicket) as PendingMediaUpload;
    } catch {
      await this.deps.cache.del(cacheKey);
      throw AppError.badRequest(
        "UPLOAD_TICKET_INVALID",
        "Sesi unggah tidak bisa dibaca. Silakan unggah berkas kembali."
      );
    }

    if (pending.siteId !== site_id || pending.uploaderId !== input.uploaderId) {
      throw AppError.forbidden(
        "UPLOAD_TICKET_INVALID",
        "Sesi unggah ini bukan milik akun Anda. Silakan unggah berkas kembali."
      );
    }

    const maxBytes = maxBytesForMime(pending.mimeType);
    if (!maxBytes) {
      await this.deps.cache.del(cacheKey);
      throw AppError.badRequest(
        "UNSUPPORTED_MEDIA_TYPE",
        "Jenis berkas ini tidak didukung. Gunakan WebP, PNG, JPEG, SVG, atau PDF."
      );
    }

    let objectInfo;
    try {
      objectInfo = await this.deps.storage.getObjectInfo(pending.path);
    } catch (err: any) {
      this.deps.logger.error("Failed to verify Supabase object metadata", {
        path: pending.path,
        error: err?.message,
      });
      throw new AppError(
        502,
        "STORAGE_VERIFY_FAILED",
        "Berkas belum bisa diverifikasi di penyimpanan media. Coba lagi beberapa saat lagi."
      );
    }

    if (!objectInfo) {
      throw AppError.badRequest(
        "UPLOAD_NOT_FOUND",
        "Berkas belum diterima penyimpanan media. Silakan unggah ulang."
      );
    }

    if (objectInfo.size <= 0) {
      throw new AppError(
        502,
        "STORAGE_METADATA_INVALID",
        "Ukuran berkas belum bisa dibaca dari penyimpanan media. Coba lagi beberapa saat lagi."
      );
    }

    if (objectInfo.size > maxBytes) {
      await this.removeRejectedObject(pending.path, cacheKey);
      throw AppError.badRequest(
        "FILE_TOO_LARGE",
        pending.mimeType === "application/pdf"
          ? "Berkas terlalu besar. Maksimal 10 MB untuk PDF."
          : "Berkas terlalu besar. Maksimal 5 MB untuk gambar."
      );
    }

    const actualContentType = (objectInfo.contentType || "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    if (actualContentType && actualContentType !== pending.mimeType) {
      await this.removeRejectedObject(pending.path, cacheKey);
      throw AppError.badRequest(
        "FILE_TYPE_MISMATCH",
        "Jenis berkas yang diterima tidak sesuai dengan berkas yang dipilih. Silakan unggah ulang."
      );
    }

    const existing = await this.deps.prisma.media.findFirst({
      where: { site_id, fileName: pending.path },
      include: { uploadedBy: { select: { fullName: true } } },
    });
    if (existing) {
      await this.deps.cache.del(cacheKey);
      return existing;
    }

    const media = await this.deps.prisma.media.create({
      data: {
        site_id,
        fileName: pending.path,
        originalName: pending.originalName,
        mimeType: pending.mimeType,
        fileSize: objectInfo.size,
        width: this.normalizeDimension(input.width) ?? pending.width,
        height: this.normalizeDimension(input.height) ?? pending.height,
        url: this.deps.storage.getPublicUrl(pending.path),
        altText:
          input.altText !== undefined
            ? input.altText.trim().slice(0, 255) || null
            : pending.altText,
        uploadedById: input.uploaderId,
      },
      include: {
        uploadedBy: { select: { fullName: true } },
      },
    });

    await this.deps.cache.del(cacheKey);
    return media;
  }

  /**
   * Updates editable media metadata. Object paths and URLs stay immutable so content
   * references cannot silently point to a different file.
   */
  async updateMedia(id: string, rawSiteId: string | undefined, input: UpdateMediaInput) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const media = await this.deps.prisma.media.findFirst({
      where: { id, site_id },
      select: { id: true },
    });
    if (!media) {
      throw AppError.notFound("Berkas tidak ditemukan.");
    }

    return this.deps.prisma.media.update({
      where: { id: media.id },
      data: {
        altText: input.altText?.trim().slice(0, 255) || null,
      },
      include: {
        uploadedBy: { select: { fullName: true } },
      },
    });
  }

  /**
   * Deletes a media asset from PostgreSQL and removes the backing object only if no post,
   * portfolio, testimonial, or staff avatar currently references its URL.
   */
  async deleteMedia(id: string, rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const media = await this.deps.prisma.media.findFirst({
      where: { id, site_id },
    });
    if (!media) {
      throw AppError.notFound("Berkas tidak ditemukan.");
    }

    const [usedInPost, usedInPortfolio, usedInTestimonial, usedAsAvatar] =
      await Promise.all([
        this.deps.prisma.post.findFirst({
          where: { site_id, coverUrl: media.url },
          select: { id: true, title: true },
        }),
        this.deps.prisma.portfolio.findFirst({
          where: { site_id, thumbnailUrl: media.url },
          select: { id: true, title: true },
        }),
        this.deps.prisma.testimonial.findFirst({
          where: { site_id, avatarUrl: media.url },
          select: { id: true, clientName: true },
        }),
        this.deps.prisma.user.findFirst({
          where: { avatarUrl: media.url },
          select: { id: true, fullName: true },
        }),
      ]);

    if (usedInPost || usedInPortfolio || usedInTestimonial || usedAsAvatar) {
      throw AppError.badRequest(
        "MEDIA_IN_USE",
        "Berkas tidak dapat dihapus karena masih digunakan pada artikel, portofolio, testimoni, atau profil staf."
      );
    }

    if (media.fileName.includes("/")) {
      if (this.deps.storage.enabled) {
        try {
          await this.deps.storage.deleteObject(media.fileName);
        } catch (err: any) {
          this.deps.logger.warn("Failed to delete media object from Supabase Storage", {
            fileName: media.fileName,
            error: err?.message,
          });
        }
      } else {
        this.deps.logger.warn("Remote media object left behind because storage driver is local", {
          fileName: media.fileName,
        });
      }
    } else {
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
    }

    await this.deps.prisma.media.delete({ where: { id: media.id } });
    return { message: "Berkas media berhasil dihapus." };
  }

  private async removeRejectedObject(objectPath: string, cacheKey: string) {
    try {
      await this.deps.storage.deleteObject(objectPath);
    } catch (err: any) {
      this.deps.logger.warn("Failed to remove rejected media object", {
        path: objectPath,
        error: err?.message,
      });
    }
    await this.deps.cache.del(cacheKey);
  }

  private normalizeDimension(value?: number): number | null {
    if (typeof value !== "number" || !Number.isFinite(value)) return null;
    const rounded = Math.round(value);
    if (rounded < 1 || rounded > 8000) return null;
    return rounded;
  }
}
