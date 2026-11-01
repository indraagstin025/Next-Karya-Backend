import { Response } from "express";
import { env } from "../config/env";
import { AppError } from "../core/AppError";
import { ITenantGuard } from "../container/types";
import { sendError } from "./response";

/**
 * Verifies that the client's `updatedAt` timestamp is within 1000ms of the database record's
 * current `updatedAt` value to prevent silent lost updates when two staff members edit the same record.
 * Sends an HTTP 400 or 409 response directly and returns `false` when the lock check fails.
 */
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

/**
 * Enforces single-tenant isolation in Phase 1 by validating that any incoming `site_id`
 * matches the configured `SITE_ID` and rejecting cross-tenant IDOR attempts with HTTP 403.
 */
export class TenantGuard implements ITenantGuard {
  constructor(private readonly allowedSiteId: string = env.SITE_ID) {}

  /**
   * Normalizes and validates an incoming `site_id` parameter, defaulting to the configured
   * primary site when omitted and throwing `AppError` (400 or 403) on malformed or unauthorized IDs.
   */
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

/**
 * Resolves and authorizes the `site_id` against the default `TenantGuard` instance.
 */
export function resolveAuthorizedSiteId(rawSiteId?: unknown): string {
  return defaultTenantGuard.resolveAuthorizedSiteId(rawSiteId);
}
