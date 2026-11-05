import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { EnvConfig } from "../config/env";

export interface SignedUploadUrl {
  signedUrl: string;
  token: string;
  path: string;
}

export interface StoredObjectInfo {
  size: number;
  contentType: string | null;
}

export interface IStorageService {
  readonly enabled: boolean;
  createSignedUploadUrl(path: string): Promise<SignedUploadUrl>;
  getObjectInfo(path: string): Promise<StoredObjectInfo | null>;
  getPublicUrl(path: string): string;
  deleteObject(path: string): Promise<void>;
}

/**
 * Stand-in used when media stays on the application disk. Direct upload endpoints are
 * disabled, and media metadata continues to flow through the legacy multipart handler.
 */
export class LocalStorageService implements IStorageService {
  readonly enabled = false;

  async createSignedUploadUrl(): Promise<SignedUploadUrl> {
    throw new Error("Direct upload is not enabled for local storage.");
  }

  async getObjectInfo(): Promise<StoredObjectInfo | null> {
    return null;
  }

  getPublicUrl(): string {
    return "";
  }

  async deleteObject(): Promise<void> {
    // Local files are removed by MediaService through UPLOAD_DIR.
  }
}

/**
 * Accepts a project URL or a copied REST/Storage endpoint and reduces it to the project
 * origin that `createClient` expects. Dashboard copy buttons often include `/rest/v1/`.
 */
export function normalizeSupabaseProjectUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/i, "")
    .replace(/\/storage\/v1$/i, "")
    .replace(/\/+$/, "");
}

/**
 * Builds the canonical public object URL for a bucket on a Supabase-hosted project.
 */
export function buildSupabasePublicBaseUrl(projectUrl: string, bucket: string): string {
  return `${normalizeSupabaseProjectUrl(projectUrl)}/storage/v1/object/public/${encodeURIComponent(bucket)}`;
}

/**
 * Supabase Storage adapter. The backend only signs short-lived upload URLs and inspects
 * object metadata after the browser uploads; file bytes never pass through this process.
 */
export class SupabaseStorageService implements IStorageService {
  readonly enabled = true;
  private readonly client: SupabaseClient;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(env: EnvConfig) {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase storage configuration is incomplete.");
    }

    this.bucket = env.SUPABASE_STORAGE_BUCKET;
    this.client = createClient(
      normalizeSupabaseProjectUrl(env.SUPABASE_URL),
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const derivedBaseUrl = buildSupabasePublicBaseUrl(env.SUPABASE_URL, this.bucket);
    this.publicBaseUrl = (env.SUPABASE_STORAGE_PUBLIC_URL || derivedBaseUrl).replace(/\/+$/, "");
  }

  async createSignedUploadUrl(path: string): Promise<SignedUploadUrl> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new Error(error?.message || "Supabase menolak permintaan tautan unggah.");
    }

    return {
      signedUrl: data.signedUrl,
      token: data.token,
      path: data.path,
    };
  }

  async getObjectInfo(path: string): Promise<StoredObjectInfo | null> {
    const { data, error } = await this.client.storage.from(this.bucket).info(path);

    if (error) {
      const storageError = error as typeof error & { code?: string };
      const isMissing =
        storageError.status === 404 ||
        storageError.statusCode === "404" ||
        storageError.code === "NoSuchKey";
      if (isMissing) return null;
      throw new Error(storageError.message || "Supabase gagal membaca metadata objek.");
    }

    return {
      size: data.size ?? 0,
      contentType: data.contentType ?? data.metadata?.mimetype ?? null,
    };
  }

  getPublicUrl(path: string): string {
    const encodedPath = path
      .split("/")
      .filter(Boolean)
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    return `${this.publicBaseUrl}/${encodedPath}`;
  }

  async deleteObject(path: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([path]);
    if (error) {
      throw new Error(error.message || "Supabase gagal menghapus objek media.");
    }
  }
}

/**
 * Selects the storage adapter from `STORAGE_DRIVER`, keeping local development and
 * production object storage on the same service contract.
 */
export function createStorageService(env: EnvConfig): IStorageService {
  return env.STORAGE_DRIVER === "supabase"
    ? new SupabaseStorageService(env)
    : new LocalStorageService();
}
