import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { MediaService } from "../services/media.service";
import { env } from "../config/env";
import { MEDIA_MIME_EXTENSIONS, maxBytesForMime } from "../config/media";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

const uploadDirPath = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(uploadDirPath)) {
  fs.mkdirSync(uploadDirPath, { recursive: true });
}

const allowedMimeToExt: Record<string, string[]> = Object.fromEntries(
  Object.entries(MEDIA_MIME_EXTENSIONS).map(([mime, ext]) => [
    mime,
    mime === "image/jpeg" ? [ext, ".jpeg"] : [ext],
  ])
);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDirPath);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const rawExt = path.extname(file.originalname).toLowerCase();
    const validExts = allowedMimeToExt[file.mimetype] || [".bin"];
    const ext = validExts.includes(rawExt) ? rawExt : validExts[0];
    const cleanBaseName =
      path
        .basename(file.originalname, rawExt)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60) || "asset";
    cb(null, `${cleanBaseName}-${uniqueSuffix}${ext}`);
  },
});

const allowedMimeTypes = Object.keys(allowedMimeToExt);

interface FileValidationResult {
  valid: boolean;
  reason?: string;
  width?: number;
  height?: number;
}

/**
 * Parses JPEG SOF0-SOF3 markers to extract pixel dimensions without loading the full image into memory.
 */
function extractJpegDimensions(buf: Buffer): { width: number; height: number } | null {
  let offset = 2;
  while (offset < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 4 > buf.length) break;
    const length = buf.readUInt16BE(offset + 2);
    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker)) {
      if (offset + 9 > buf.length) break;
      const height = buf.readUInt16BE(offset + 5);
      const width = buf.readUInt16BE(offset + 7);
      return { width, height };
    }
    offset += 2 + length;
  }
  return null;
}

/**
 * Parses WebP VP8X, VP8, and VP8L chunk headers to extract canvas width and height.
 */
function extractWebpDimensions(buf: Buffer): { width: number; height: number } | null {
  if (buf.length < 30) return null;
  const chunkType = buf.toString("ascii", 12, 16);
  if (chunkType === "VP8X") {
    const width = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const height = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    return { width, height };
  }
  if (chunkType === "VP8 ") {
    if (buf[23] === 0x9d && buf[24] === 0x01 && buf[25] === 0x2a) {
      const width = buf.readUInt16LE(26) & 0x3fff;
      const height = buf.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
  }
  if (chunkType === "VP8L") {
    if (buf[20] === 0x2f) {
      const b1 = buf[21],
        b2 = buf[22],
        b3 = buf[23],
        b4 = buf[24];
      const width = 1 + (((b2 & 0x3f) << 8) | b1);
      const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
      return { width, height };
    }
  }
  return null;
}

/**
 * Inspects binary magic numbers, structural EOF markers, pixel bounds (max 8000x8000),
 * and SVG XSS payloads to reject spoofed, truncated, or malicious uploads.
 */
export function validateFileIntegrity(filePath: string, mimeType: string): FileValidationResult {
  try {
    const buf = fs.readFileSync(filePath);
    if (!buf || buf.length < 16) {
      return { valid: false, reason: "Berkas kosong atau ukurannya terlalu kecil." };
    }

    if (mimeType === "image/png") {
      const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      if (buf.length < 24 || !buf.subarray(0, 8).equals(pngMagic)) {
        return { valid: false, reason: "Berkas ini bukan gambar PNG yang benar." };
      }
      if (buf.toString("ascii", 12, 16) !== "IHDR") {
        return { valid: false, reason: "Struktur gambar PNG rusak dan tidak bisa dibuka." };
      }
      const width = buf.readUInt32BE(16);
      const height = buf.readUInt32BE(20);
      if (width === 0 || height === 0) {
        return { valid: false, reason: "Ukuran gambar PNG tidak terbaca dengan benar." };
      }
      if (width > 8000 || height > 8000) {
        return {
          valid: false,
          reason: `Gambar terlalu besar (${width} x ${height} piksel). Maksimal 8000 x 8000 piksel.`,
        };
      }
      const iendChunk = Buffer.from([0x49, 0x45, 0x4e, 0x44]);
      const iendIndex = buf.lastIndexOf(iendChunk);
      if (iendIndex === -1 || iendIndex < buf.length - 16) {
        return {
          valid: false,
          reason: "Gambar PNG rusak atau tidak lengkap.",
        };
      }
      return { valid: true, width, height };
    }

    if (mimeType === "image/jpeg") {
      if (buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
        return { valid: false, reason: "Berkas ini bukan gambar JPEG yang benar." };
      }
      const lastBytes = buf.subarray(Math.max(0, buf.length - 128));
      let hasEoi = false;
      for (let i = 0; i < lastBytes.length - 1; i++) {
        if (lastBytes[i] === 0xff && lastBytes[i + 1] === 0xd9) {
          hasEoi = true;
          break;
        }
      }
      if (!hasEoi) {
        return {
          valid: false,
          reason: "Gambar JPEG rusak atau tidak lengkap.",
        };
      }
      const dims = extractJpegDimensions(buf);
      if (dims) {
        if (dims.width > 8000 || dims.height > 8000) {
          return {
            valid: false,
            reason: `Gambar terlalu besar (${dims.width} x ${dims.height} piksel). Maksimal 8000 x 8000 piksel.`,
          };
        }
        return { valid: true, width: dims.width, height: dims.height };
      }
      return { valid: true };
    }

    if (mimeType === "image/webp") {
      if (
        buf.toString("ascii", 0, 4) !== "RIFF" ||
        buf.toString("ascii", 8, 12) !== "WEBP"
      ) {
        return { valid: false, reason: "Berkas ini bukan gambar WebP yang benar." };
      }
      const declaredSize = buf.readUInt32LE(4) + 8;
      if (buf.length < declaredSize) {
        return {
          valid: false,
          reason:
            "Gambar WebP rusak atau tidak lengkap.",
        };
      }
      const dims = extractWebpDimensions(buf);
      if (dims) {
        if (dims.width > 8000 || dims.height > 8000) {
          return {
            valid: false,
            reason: `Gambar terlalu besar (${dims.width} x ${dims.height} piksel). Maksimal 8000 x 8000 piksel.`,
          };
        }
        return { valid: true, width: dims.width, height: dims.height };
      }
      return { valid: true };
    }

    if (mimeType === "image/svg+xml") {
      const content = buf.toString("utf8");
      if (!content.includes("<svg") || !content.includes("</svg>")) {
        return {
          valid: false,
          reason:
            "Gambar SVG tidak lengkap atau rusak.",
        };
      }
      const lower = content.toLowerCase();
      const forbiddenPatterns = [
        "<script",
        "javascript:",
        "onload=",
        "onerror=",
        "onclick=",
        "<foreignobject",
        "<iframe",
        "data:text/html",
        'xlink:href="javascript:',
        "xlink:href='javascript:",
      ];
      for (const pat of forbiddenPatterns) {
        if (lower.includes(pat)) {
          return {
            valid: false,
            reason: "Berkas SVG ditolak karena berisi kode yang berbahaya.",
          };
        }
      }
      return { valid: true };
    }

    if (mimeType === "application/pdf") {
      if (buf.toString("ascii", 0, 5) !== "%PDF-") {
        return { valid: false, reason: "Berkas ini bukan PDF yang benar." };
      }
      const lastBytes = buf.subarray(Math.max(0, buf.length - 1024)).toString("ascii");
      if (!lastBytes.includes("%%EOF")) {
        return {
          valid: false,
          reason: "Berkas PDF rusak atau tidak lengkap.",
        };
      }
      return { valid: true };
    }

    return { valid: false, reason: "Jenis berkas ini tidak didukung." };
  } catch (err: any) {
    return {
      valid: false,
      reason: "Berkas tidak bisa diperiksa. Coba unggah ulang.",
    };
  }
}

/**
 * Multer middleware configured with sanitized disk filenames, a 10 MB ceiling, and strict MIME allowlisting.
 */
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("UNSUPPORTED_MEDIA_TYPE"));
    }
  },
});

/**
 * HTTP handlers for media library listing, binary-validated uploads with SHA-256 deduplication, and asset deletion.
 */
export class MediaController {
  constructor(
    private readonly mediaService: MediaService = new MediaService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  /**
   * Lists paginated media assets for the authorized tenant with optional filename and MIME filters.
   */
  getMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const search = req.query.search as string | undefined;
      const mimeType = req.query.mimeType as string | undefined;
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);

      const { items, meta } = await this.mediaService.getMedia({
        site_id,
        search,
        mimeType,
        page,
        limit,
      });

      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Validates uploaded file size and binary integrity, deduplicates via SHA-256 hash,
   * and removes temporary disk files if validation or persistence fails.
   */
  uploadMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        return sendError(res, 400, "MISSING_FILE", "Pilih berkas yang akan diunggah.");
      }

      const file = req.file;
      const isPdf = file.mimetype === "application/pdf";
      const maxAllowedSize = maxBytesForMime(file.mimetype) ?? 5 * 1024 * 1024;

      if (file.size > maxAllowedSize) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return sendError(
          res,
          400,
          "FILE_TOO_LARGE",
          `Berkas terlalu besar. ${isPdf ? "Maksimal 10 MB untuk PDF." : "Maksimal 5 MB untuk gambar."}`
        );
      }

      const validation = validateFileIntegrity(file.path, file.mimetype);
      if (!validation.valid) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return sendError(
          res,
          400,
          "CORRUPTED_OR_INVALID_FILE",
          validation.reason ||
            "Berkas rusak atau tidak bisa dibuka. Coba unggah berkas lain."
        );
      }

      const site_id = this.tenantGuard.resolveAuthorizedSiteId(
        req.body?.site_id ?? req.query.site_id
      );
      const altText = req.body.altText as string | undefined;

      const fileBuf = fs.readFileSync(file.path);
      const fileHash = crypto.createHash("sha256").update(fileBuf).digest("hex");
      const duplicateMedia = await this.mediaService.findDuplicateMedia(
        site_id,
        file.size,
        fileHash
      );

      if (duplicateMedia) {
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        return sendSuccess(
          res,
          {
            ...duplicateMedia,
            isDuplicate: true,
            message:
              "Berkas identik sudah ada di Pustaka Media. Menggunakan berkas yang telah tersimpan.",
          },
          200
        );
      }

      const media = await this.mediaService.saveUploadedFile(
        file,
        site_id,
        req.user!.id,
        altText,
        validation.width,
        validation.height
      );

      return sendSuccess(res, media, 201);
    } catch (err) {
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch {
          // ignore cleanup failure
        }
      }
      next(err);
    }
  };

  /**
   * Issues a short-lived Supabase signed upload URL. The client sends file bytes directly
   * to the bucket; this endpoint only receives metadata.
   */
  createUploadUrl = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const body = req.body as {
        originalName: string;
        mimeType: string;
        fileSize: number;
        altText?: string;
        width?: number;
        height?: number;
      };

      const result = await this.mediaService.createUploadTicket({
        siteId: site_id,
        uploaderId: req.user!.id,
        originalName: body.originalName,
        mimeType: body.mimeType,
        fileSize: body.fileSize,
        altText: body.altText,
        width: body.width,
        height: body.height,
      });

      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Confirms a direct upload by checking the stored object metadata before persisting
   * the media row. No file bytes are handled by the backend.
   */
  confirmUpload = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const body = req.body as {
        ticketId: string;
        altText?: string;
        width?: number;
        height?: number;
      };

      const media = await this.mediaService.confirmUpload({
        ticketId: body.ticketId,
        siteId: site_id,
        uploaderId: req.user!.id,
        altText: body.altText,
        width: body.width,
        height: body.height,
      });

      return sendSuccess(res, media, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates editable metadata for an existing media asset, currently the alt text.
   */
  updateMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const media = await this.mediaService.updateMedia(id, site_id, {
        altText: req.body.altText,
      });
      return sendSuccess(res, media);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Deletes a media asset after verifying tenant ownership and ensuring it is not referenced by CMS content.
   */
  deleteMedia = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(
        req.query.site_id ?? req.body?.site_id
      );
      const result = await this.mediaService.deleteMedia(id, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
