import { Request, Response, NextFunction } from "express";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import { sendError } from "../utils/response";

/**
 * Creates the terminal Express error-handling middleware that logs exceptions with
 * `requestId` correlation and maps operational `AppError`, Multer, and Prisma error codes
 * (`P2002`, `P2025`, `P2003`) to safe HTTP responses without leaking internal stack traces.
 */
export function createErrorHandler(logger: ILogger = defaultLogger) {
  return function errorHandlerMiddleware(
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    logger.error("Request Exception", {
      requestId: req.requestId,
      path: req.path,
      method: req.method,
      code: err?.code,
      statusCode: err?.statusCode,
      message: err?.message || "Unknown error",
    });

    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof AppError) {
      return sendError(
        res,
        err.statusCode,
        err.code,
        err.message,
        undefined,
        err.currentData
      );
    }

    if (err?.type === "entity.parse.failed") {
      return sendError(
        res,
        400,
        "INVALID_JSON",
        "Data yang dikirim tidak terbaca. Muat ulang halaman lalu coba lagi."
      );
    }

    if (err?.type === "entity.too.large") {
      return sendError(
        res,
        413,
        "PAYLOAD_TOO_LARGE",
        "Data yang dikirim terlalu besar. Kurangi isinya lalu coba lagi."
      );
    }

    if (err?.message === "UNSUPPORTED_MEDIA_TYPE") {
      return sendError(
        res,
        400,
        "UNSUPPORTED_MEDIA_TYPE",
        "Berkas ini tidak bisa dipakai. Gunakan WebP, PNG, JPG, SVG, atau PDF."
      );
    }

    if (err?.code === "LIMIT_FILE_SIZE") {
      return sendError(
        res,
        400,
        "FILE_TOO_LARGE",
        "Berkas terlalu besar. Maksimal 5 MB untuk gambar dan 10 MB untuk PDF."
      );
    }

    // Prisma unique constraint violation (for example duplicate [site_id, slug])
    if (err?.code === "P2002") {
      return sendError(
        res,
        409,
        "DUPLICATE_ENTRY",
        "Alamat tautan atau nama ini sudah dipakai. Silakan gunakan yang lain."
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
        "Data ini masih dipakai di bagian lain, jadi belum bisa dihapus."
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
        ? "Ada gangguan di layanan kami. Coba lagi beberapa saat lagi."
        : err?.message || "Permintaan belum bisa diproses.";

    return sendError(res, statusCode, errorCode, errorMessage, undefined, err?.currentData);
  };
}

export const errorHandler = createErrorHandler();
