import { Response } from "express";
import { env } from "../config/env";
import { sendError } from "./response";

export function checkOptimisticLock(
  res: Response,
  requestUpdatedAt: string | Date | undefined,
  dbUpdatedAt: Date,
  currentEntityData: any
): boolean {
  if (!requestUpdatedAt) {
    sendError(
      res,
      400,
      "MISSING_UPDATED_AT",
      "Field updatedAt wajib disertakan untuk validasi konkurensi (optimistic locking)."
    );
    return false;
  }

  const reqTime = new Date(requestUpdatedAt).getTime();
  const dbTime = new Date(dbUpdatedAt).getTime();

  if (Number.isNaN(reqTime)) {
    sendError(
      res,
      400,
      "INVALID_UPDATED_AT",
      "Format stempel waktu updatedAt tidak valid (wajib ISO 8601)."
    );
    return false;
  }

  // Reject when client timestamp differs from database timestamp by more than 1000ms.
  if (Math.abs(reqTime - dbTime) > 1000) {
    sendError(
      res,
      409,
      "CONCURRENT_MODIFICATION_CONFLICT",
      "Data ini baru saja diperbarui oleh rekan kerja Anda. Silakan tinjau perubahan terkini.",
      undefined,
      currentEntityData
    );
    return false;
  }

  return true;
}

// Phase 1 locks tenant operations to the configured SITE_ID ("nextkarya-main")
// and rejects cross-tenant IDOR attempts.
export function resolveAuthorizedSiteId(rawSiteId?: unknown): string {
  if (rawSiteId === undefined || rawSiteId === null || rawSiteId === "") {
    return env.SITE_ID;
  }
  if (typeof rawSiteId !== "string") {
    throw {
      statusCode: 400,
      code: "INVALID_SITE_ID",
      message: "Parameter site_id tidak valid.",
    };
  }
  const normalized = rawSiteId.trim();
  if (!/^[a-z0-9-]{3,64}$/.test(normalized)) {
    throw {
      statusCode: 400,
      code: "INVALID_SITE_ID",
      message: "Format site_id tidak valid.",
    };
  }
  if (normalized !== env.SITE_ID) {
    throw {
      statusCode: 403,
      code: "TENANT_ACCESS_DENIED",
      message: "Akses lintas site_id ditolak pada lingkup Fase 1.",
    };
  }
  return normalized;
}
