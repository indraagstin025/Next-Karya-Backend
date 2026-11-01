import { Request, Response } from "express";
import { sendError } from "../utils/response";

export function notFoundHandler(req: Request, res: Response) {
  return sendError(
    res,
    404,
    "ROUTE_NOT_FOUND",
    `Endpoint ${req.method} ${req.path} tidak ditemukan pada layanan API.`
  );
}
