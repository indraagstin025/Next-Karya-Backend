import { Response } from "express";
import { env } from "../config/env";
import { AppError } from "../core/AppError";
import { ITenantGuard } from "../container/types";
import { sendError } from "./response";

export function checkOptimisticLock(
  res: Response,
  requestUpdatedAt: string | Date | undefined,
  dbUpdatedAt: Date,
  currentEntityData: unknown
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

export class TenantGuard implements ITenantGuard {
  constructor(private readonly allowedSiteId: string = env.SITE_ID) {}

  resolveAuthorizedSiteId(rawSiteId?: unknown): string {
    if (rawSiteId === undefined || rawSiteId === null || rawSiteId === "") {
      return this.allowedSiteId;
    }
    const candidate = Array.isArray(rawSiteId) ? rawSiteId[rawSiteId.length - 1] : rawSiteId;
    if (typeof candidate !== "string") {
      throw AppError.badRequest("INVALID_SITE_ID", "Parameter site_id tidak valid.");
    }
    const normalized = candidate.trim();
    if (!/^[a-z0-9-]{3,64}$/.test(normalized)) {
      throw AppError.badRequest("INVALID_SITE_ID", "Format site_id tidak valid.");
    }
    if (normalized !== this.allowedSiteId) {
      throw AppError.forbidden(
        "TENANT_ACCESS_DENIED",
        "Akses lintas site_id ditolak pada lingkup Fase 1."
      );
    }
    return normalized;
  }
}

export const defaultTenantGuard = new TenantGuard(env.SITE_ID);

// Phase 1 locks tenant operations to the configured SITE_ID ("nextkarya-main")
// and rejects cross-tenant IDOR attempts.
export function resolveAuthorizedSiteId(rawSiteId?: unknown): string {
  return defaultTenantGuard.resolveAuthorizedSiteId(rawSiteId);
}
