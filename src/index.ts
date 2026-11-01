import express, { Express } from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { appContainer, AppContainer } from "./container";
import { createV1Router } from "./routes/v1";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { initCronJobs } from "./cron";

export function createApp(container: AppContainer = appContainer): Express {
  const app = express();
  const { env } = container;
  const { security, rateLimiter, errorHandler } = container.middlewares;

  app.disable("x-powered-by");

  // 1. Security Headers (Helmet hardened)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginResourcePolicy: { policy: "cross-origin" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    })
  );

  // 2. Strict CORS Origin Validation
  const allowedOrigins = new Set([
    env.FRONTEND_URL,
    "https://nextkarya.web.id",
    "http://localhost:3000",
  ]);
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          return callback(null, true);
        }
        return callback(new Error("CORS_ORIGIN_NOT_ALLOWED"));
      },
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Updated-At", "X-Request-Id"],
      exposedHeaders: ["X-Request-Id", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    })
  );

  // 3. Body Parsing (bounded to 1MB to prevent memory exhaustion)
  app.use(express.json({ limit: "1mb", strict: true }));
  app.use(express.urlencoded({ extended: false, limit: "256kb", parameterLimit: 100 }));

  // 4. Request Correlation, HPP Flattening, Prototype Pollution & Null-Byte Guard
  app.use(security);

  // 5. Static uploads directory with strict nosniff & script-blocking headers
  const uploadsDir = path.join(process.cwd(), env.UPLOAD_DIR);
  app.use(
    "/uploads",
    express.static(uploadsDir, {
      dotfiles: "deny",
      index: false,
      setHeaders: (res) => {
        res.setHeader("X-Content-Type-Options", "nosniff");
        res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    })
  );

  // 6. Global Fallback Rate Limiter (300 req/min per IP)
  const globalApiLimiter = rateLimiter({
    windowSec: 60,
    maxRequests: 300,
    prefix: "rl_global_api",
  });

  // Root info
  app.get("/", (_req, res) => {
    res.json({
      service: "Next Karya Digital Solutions REST API",
      version: "1.0.0",
      docs: "/api/v1/health",
    });
  });

  // 7. Mount V1 API Router injected with Container
  app.use("/api/v1", globalApiLimiter, createV1Router(container));

  // 8. 404 & Global Error Handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

const app = createApp(appContainer);

if (require.main === module) {
  const { env, prisma, logger } = appContainer;
  const server = app.listen(env.PORT, () => {
    logger.info(`[Next Karya API] Server running on port ${env.PORT} in ${env.NODE_ENV} mode.`);
    logger.info(`[Next Karya API] Base API route: http://localhost:${env.PORT}/api/v1`);
    initCronJobs({ prisma, logger });
  });

  async function gracefulShutdown(signal: string) {
    logger.info(`[Server] Received ${signal}. Starting graceful shutdown...`);
    server.close(async () => {
      logger.info("[Server] HTTP server closed.");
      try {
        await prisma.$disconnect();
        logger.info("[Prisma] Database connection closed.");
      } catch (err: any) {
        logger.error("[Prisma Error] Error disconnecting", { error: err?.message });
      }
      process.exit(0);
    });
  }

  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}

export default app;
