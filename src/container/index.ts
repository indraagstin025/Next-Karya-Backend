import { PrismaClient } from "@prisma/client";
import { env as defaultEnv, EnvConfig } from "../config/env";
import { prisma as defaultPrisma } from "../config/prisma";
import { cache as defaultCache } from "../config/redis";
import { ILogger, SecurityLogger } from "../core/logger";
import { TenantGuard } from "../utils/optimistic";
import { WebhookNotifier } from "../utils/webhook";
import { ICacheService, ITenantGuard, IWebhookNotifier, ServiceDependencies } from "./types";
import { AuthService } from "../services/auth.service";
import { AnalyticsService } from "../services/analytics.service";
import { CmsService } from "../services/cms.service";
import { CrmService } from "../services/crm.service";
import { EmergencyService } from "../services/emergency.service";
import { MediaService } from "../services/media.service";
import { IStorageService, createStorageService } from "../services/storage.service";
import { PublicService } from "../services/public.service";
import { AuthController } from "../controllers/auth.controller";
import { AnalyticsController } from "../controllers/analytics.controller";
import { CmsController } from "../controllers/cms.controller";
import { CrmController } from "../controllers/crm.controller";
import { EmergencyController } from "../controllers/emergency.controller";
import { MediaController } from "../controllers/media.controller";
import { PublicController } from "../controllers/public.controller";
import { createAuthMiddleware } from "../middlewares/auth";
import { createRateLimiterFactory } from "../middlewares/rateLimiter";
import { createErrorHandler } from "../middlewares/errorHandler";
import { createSecurityMiddleware } from "../middlewares/security";

/**
 * Optional dependency overrides accepted by `createAppContainer` for isolated testing.
 */
export interface ContainerOverrides {
  env?: EnvConfig;
  prisma?: PrismaClient;
  cache?: ICacheService;
  logger?: ILogger;
  tenantGuard?: ITenantGuard;
  webhook?: IWebhookNotifier;
}

/**
 * Composition root container holding wired infrastructure, services, controllers, and middlewares.
 */
export interface AppContainer {
  env: EnvConfig;
  prisma: PrismaClient;
  cache: ICacheService;
  logger: ILogger;
  tenantGuard: ITenantGuard;
  webhook: IWebhookNotifier;
  storage: IStorageService;

  services: {
    auth: AuthService;
    analytics: AnalyticsService;
    cms: CmsService;
    crm: CrmService;
    emergency: EmergencyService;
    media: MediaService;
    public: PublicService;
  };

  controllers: {
    auth: AuthController;
    analytics: AnalyticsController;
    cms: CmsController;
    crm: CrmController;
    emergency: EmergencyController;
    media: MediaController;
    public: PublicController;
  };

  middlewares: {
    requireAuth: ReturnType<typeof createAuthMiddleware>;
    rateLimiter: ReturnType<typeof createRateLimiterFactory>;
    security: ReturnType<typeof createSecurityMiddleware>;
    errorHandler: ReturnType<typeof createErrorHandler>;
  };
}

/**
 * Builds the Dependency Injection composition root and wires all domain services,
 * HTTP controllers, and security middlewares with optional test overrides.
 */
export function createAppContainer(overrides: ContainerOverrides = {}): AppContainer {
  const env = overrides.env ?? defaultEnv;
  const prisma = overrides.prisma ?? defaultPrisma;
  const cache = overrides.cache ?? defaultCache;
  const logger = overrides.logger ?? new SecurityLogger(env.NODE_ENV);
  const tenantGuard = overrides.tenantGuard ?? new TenantGuard();
  const webhook =
    overrides.webhook ?? new WebhookNotifier(env.FRONTEND_URL, env.WEBHOOK_SECRET, logger);
  const storage = createStorageService(env);

  const sharedDeps: ServiceDependencies = {
    prisma,
    cache,
    env,
    logger,
    webhook,
    tenantGuard,
  };

  const authService = new AuthService(sharedDeps);
  const analyticsService = new AnalyticsService(sharedDeps);
  const cmsService = new CmsService(sharedDeps);
  const crmService = new CrmService(sharedDeps);
  const emergencyService = new EmergencyService(sharedDeps);
  const mediaService = new MediaService({ ...sharedDeps, storage });
  const publicService = new PublicService(sharedDeps);

  const authController = new AuthController(authService);
  const analyticsController = new AnalyticsController(analyticsService, tenantGuard);
  const cmsController = new CmsController(cmsService, tenantGuard);
  const crmController = new CrmController(crmService, tenantGuard);
  const emergencyController = new EmergencyController(emergencyService, tenantGuard);
  const mediaController = new MediaController(mediaService, tenantGuard);
  const publicController = new PublicController(publicService, tenantGuard);

  const requireAuth = createAuthMiddleware({ prisma, cache, env, logger });
  const rateLimiter = createRateLimiterFactory({ cache, env });
  const security = createSecurityMiddleware(logger);
  const errorHandler = createErrorHandler(logger);

  return {
    env,
    prisma,
    cache,
    logger,
    tenantGuard,
    webhook,
    storage,
    services: {
      auth: authService,
      analytics: analyticsService,
      cms: cmsService,
      crm: crmService,
      emergency: emergencyService,
      media: mediaService,
      public: publicService,
    },
    controllers: {
      auth: authController,
      analytics: analyticsController,
      cms: cmsController,
      crm: crmController,
      emergency: emergencyController,
      media: mediaController,
      public: publicController,
    },
    middlewares: {
      requireAuth,
      rateLimiter,
      security,
      errorHandler,
    },
  };
}

export const appContainer = createAppContainer();
