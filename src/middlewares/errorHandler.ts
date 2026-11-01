import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error("[Error] Request Exception:", {
    path: req.path,
    method: req.method,
    code: err?.code,
    message: err?.message || "Unknown error",
  });

  if (res.headersSent) {
    return next(err);
  }

  if (err?.message === "UNSUPPORTED_MEDIA_TYPE") {
    return sendError(
      res,
      400,
      "UNSUPPORTED_MEDIA_TYPE",
      "Format berkas tidak diizinkan. Gunakan WebP, PNG, JPG, SVG, atau PDF."
    );
  }

  if (err?.code === "LIMIT_FILE_SIZE") {
    return sendError(
      res,
      400,
      "FILE_TOO_LARGE",
      "Ukuran berkas melebihi batas maksimal (5 MB untuk gambar, 10 MB untuk PDF)."
    );
  }

  // Prisma unique constraint violation (e.g. duplicate [site_id, slug])
  if (err?.code === "P2002") {
    return sendError(
      res,
      409,
      "DUPLICATE_ENTRY",
      "Slug atau pengenal unik tersebut sudah digunakan. Silakan gunakan slug yang berbeda."
    );
  }

  // Prisma record not found
  if (err?.code === "P2025") {
    return sendError(res, 404, "NOT_FOUND", "Data yang diminta tidak ditemukan.");
  }

  // Prisma foreign key constraint failure
  if (err?.code === "P2003") {
    return sendError(
      res,
      400,
      "RELATION_CONSTRAINT_ERROR",
      "Referensi relasi data tidak sah atau data masih digunakan oleh entitas lain."
    );
  }

  const statusCode =
    typeof err?.statusCode === "number" && err.statusCode >= 400 && err.statusCode < 600
      ? err.statusCode
      : 500;
  const errorCode =
    statusCode === 500
      ? "INTERNAL_SERVER_ERROR"
      : typeof err?.code === "string"
      ? err.code
      : "REQUEST_FAILED";

  const errorMessage =
    statusCode === 500
      ? "Terjadi kesalahan sistem internal tak terduga."
      : err?.message || "Permintaan tidak dapat diproses.";

  return sendError(res, statusCode, errorCode, errorMessage, undefined, err?.currentData);
}
