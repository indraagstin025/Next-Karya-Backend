import fs from "fs";
import path from "path";
import crypto from "crypto";
import { prisma } from "../config/prisma";
import { env } from "../config/env";
import { PaginationMeta } from "../utils/response";
import { resolveAuthorizedSiteId } from "../utils/optimistic";

export class MediaService {
  async getMedia(query: {
    site_id?: string;
    search?: string;
    mimeType?: string;
    page: number;
    limit: number;
  }) {
    const site_id = resolveAuthorizedSiteId(query.site_id);
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
      prisma.media.count({ where }),
      prisma.media.findMany({
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
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const candidates = await prisma.media.findMany({
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

    const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
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
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const safeFileName = path.basename(file.filename);
    const fileUrl = `/uploads/${safeFileName}`;
    const cleanAlt = altText ? altText.trim().slice(0, 255) : null;

    const media = await prisma.media.create({
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
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const media = await prisma.media.findFirst({ where: { id, site_id } });
    if (!media) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Berkas tidak ditemukan." };
    }

    const [usedInPost, usedInPortfolio] = await Promise.all([
      prisma.post.findFirst({
        where: { site_id, coverUrl: media.url },
        select: { id: true, title: true },
      }),
      prisma.portfolio.findFirst({
        where: { site_id, thumbnailUrl: media.url },
        select: { id: true, title: true },
      }),
    ]);

    if (usedInPost || usedInPortfolio) {
      throw {
        statusCode: 400,
        code: "MEDIA_IN_USE",
        message:
          "Berkas tidak dapat dihapus karena masih digunakan pada artikel atau portofolio.",
      };
    }

    const uploadRoot = path.resolve(process.cwd(), env.UPLOAD_DIR);
    const filePath = path.resolve(uploadRoot, path.basename(media.fileName));
    if (filePath.startsWith(uploadRoot) && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (err: any) {
        console.warn("[Media Unlink Warning]", err.message);
      }
    }

    await prisma.media.delete({ where: { id: media.id } });
    return { message: "Berkas media berhasil dihapus." };
  }
}
