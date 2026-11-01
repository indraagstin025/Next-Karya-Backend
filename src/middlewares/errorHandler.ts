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

    // Prisma unique constraint violation (for example duplicate [site_id, slug])
    if (err?.code === "P2002") {
      return sendError(
        res,
        409,
        "DUPLICATE_ENTRY",
        "Slug atau pengenal unik tersebut sudah digunakan. Silakan gunakan nilai yang berbeda."
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
  };
}

export const errorHandler = createErrorHandler();
