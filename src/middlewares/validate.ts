import { Request, Response, NextFunction } from "express";
import { ZodSchema, ZodError, z } from "zod";
import { sendError, ErrorDetail } from "../utils/response";

export const idParamSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1, "ID wajib diisi")
      .max(64, "ID maksimal 64 karakter")
      .regex(/^[a-zA-Z0-9_-]+$/, "Format ID tidak valid"),
  })
  .strict();

export const slugParamSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1, "Slug wajib diisi")
      .max(255, "Slug maksimal 255 karakter")
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Format slug tidak valid"),
  })
  .strict();

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
          "Validasi data input gagal diproses.",
          details
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Format data tidak valid.");
    }
  };
}

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
          "Validasi parameter query gagal diproses.",
          details
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Parameter query tidak valid.");
    }
  };
}

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
          "Parameter rute tidak valid.",
          details
        );
      }
      return sendError(res, 400, "BAD_REQUEST", "Parameter rute tidak valid.");
    }
  };
}
