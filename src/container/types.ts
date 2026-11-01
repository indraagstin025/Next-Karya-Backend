import { PrismaClient } from "@prisma/client";
import { EnvConfig } from "../config/env";
import { ILogger } from "../core/logger";

export interface ICacheService {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  incr(key: string, ttlSeconds?: number): Promise<number>;
}

export interface IWebhookNotifier {
  triggerRevalidation(tag: string, retries?: number): Promise<void>;
}

export interface ITenantGuard {
  resolveAuthorizedSiteId(rawSiteId?: unknown): string;
}

export interface ServiceDependencies {
  prisma: PrismaClient;
  cache: ICacheService;
  env: EnvConfig;
  logger: ILogger;
  webhook: IWebhookNotifier;
  tenantGuard: ITenantGuard;
}
