import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import v1Router from "./routes/v1";
import { errorHandler } from "./middlewares/errorHandler";
import { notFoundHandler } from "./middlewares/notFoundHandler";
import { initCronJobs } from "./cron";

const app = express();

// Security & Headers
app.use(helmet());
app.use(
  cors({
    origin: [env.FRONTEND_URL, "https://nextkarya.web.id", "http://localhost:3000"],
    credentials: true,
  })
);

// Body Parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Static uploads directory with strict nosniff & script-blocking headers
const uploadsDir = path.join(process.cwd(), env.UPLOAD_DIR);
app.use(
  "/uploads",
  express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  })
);

// Root info
app.get("/", (_req, res) => {
  res.json({
    service: "Next Karya Digital Solutions REST API",
    version: "1.0.0",
    docs: "/api/v1/health",
  });
});

// API Routes
app.use("/api/v1", v1Router);

// 404 & Global Error Handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(env.PORT, () => {
  console.log(`[Next Karya API] Server running on port ${env.PORT} in ${env.NODE_ENV} mode.`);
  console.log(`[Next Karya API] Base API route: http://localhost:${env.PORT}/api/v1`);
  initCronJobs();
});

// Graceful shutdown
async function gracefulShutdown(signal: string) {
  console.log(`[Server] Received ${signal}. Starting graceful shutdown...`);
  server.close(async () => {
    console.log("[Server] HTTP server closed.");
    try {
      await prisma.$disconnect();
      console.log("[Prisma] Database connection closed.");
    } catch (err: any) {
      console.error("[Prisma Error] Error disconnecting:", err.message);
    }
    process.exit(0);
  });
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

export default app;
