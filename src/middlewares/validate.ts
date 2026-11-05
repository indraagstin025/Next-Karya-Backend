import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, z } from "zod";
import "../validators/locale";
import { sendError, ErrorDetail } from "../utils/response";

export const idParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "Data yang dipilih tidak valid")
      .max(64, "Data yang dipilih tidak valid")
      .regex(/^[a-zA-Z0-9_-]+$/, "Data yang dipilih tidak dikenal"),
  })
  .strict();

export const slugParamSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, "Alamat tautan wajib diisi")
      .max(255, "Alamat tautan maksimal 255 karakter")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Alamat tautan hanya boleh berisi huruf kecil, angka, dan tanda hubung (-)"
      ),
  })
  .strict();

/**
 * Validates and replaces `req.body` using the given Zod schema, returning HTTP 400
 * with field-level details when validation or `.strict()` unknown-key checks fail.
 */
export function validateBody(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: ErrorDetail[] = err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Ada isian yang belum sesuai. Periksa kembali kolom yang ditandai.",
          details
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Data yang dikirim belum sesuai.");
    }
  };
}

/**
 * Validates and coerces `req.query` parameters against the given Zod schema.
 */
export function validateQuery(schema: ZodSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.query = (await schema.parseAsync(req.query)) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: ErrorDetail[] = err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return sendError(
          res,
          400,
          "QUERY_VALIDATION_ERROR",
          "Pilihan filter belum sesuai. Periksa kembali.",
          details
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Pilihan filter belum sesuai.");
    }
  };
}

/**
 * Validates route parameters (`req.params`) against `idParamSchema` or a custom Zod schema
 * before reaching controller handlers.
 */
export function validateParams(schema: ZodSchema = idParamSchema) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.params = (await schema.parseAsync(req.params)) as any;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details: ErrorDetail[] = err.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        }));
        return sendError(
          res,
          400,
          "PARAM_VALIDATION_ERROR",
          "Alamat halaman belum benar.",
          details
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Alamat halaman belum benar.");
    }
  };
}
