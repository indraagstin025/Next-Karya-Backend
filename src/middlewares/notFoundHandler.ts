import { Request, Response } from "express";
import { sendError } from "../utils/response";

/**
 * Fallback middleware for unmatched HTTP routes, returning a standardized 404 JSON response.
 */
export function notFoundHandler(req: Request, res: Response) {
  return sendError(
    res,
    404,
    "ROUTE_NOT_FOUND",
    "Halaman atau data yang diminta tidak ditemukan."
  );
}
