import { PrismaClient } from "@prisma/client";
import { EnvConfig } from "../config/env";
import { ILogger } from "../core/logger";

/**
 * Contract for key-value caching and atomic rate-limit counters backed by Redis or in-memory fallback.
 */
export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
}

/**
 * Contract for dispatching cache revalidation webhooks to the Next.js frontend.
 */
export interface IWebhookNotifier {
  triggerRevalidation(tag: string, retries?: number): Promise<void>;
}

/**
 * Contract for validating and resolving multi-tenant `site_id` boundaries.
 */
export interface ITenantGuard {
  resolveAuthorizedSiteId(rawSiteId?: unknown): string;
}

/**
 * Shared infrastructure dependencies injected into domain services via constructor injection.
 */
export interface ServiceDependencies {
  prisma: PrismaClient;
  cache: ICacheService;
  env: EnvConfig;
  logger: ILogger;
  webhook: IWebhookNotifier;
  tenantGuard: ITenantGuard;
}
