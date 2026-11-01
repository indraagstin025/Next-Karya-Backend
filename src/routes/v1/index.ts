import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { createPublicRouter } from "./public.routes";
import { createAuthRouter } from "./auth.routes";
import { createCmsRouter } from "./cms.routes";
import { createCrmRouter } from "./crm.routes";
import { createMediaRouter } from "./media.routes";
import { createAnalyticsRouter } from "./analytics.routes";
import { createEmergencyRouter } from "./emergency.routes";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import { revokeSessionsSchema } from "../../validators/auth";

export function createV1Router(container: AppContainer = appContainer): Router {
  const router = Router();
  const { auth: authController } = container.controllers;
  const { requireAuth } = container.middlewares;

  // Health check
  router.get("/health", (_req, res) => {
    res.json({
      success: true,
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
        service: "Next Karya Digital Solutions API Core",
        version: "1.0.0",
      },
      meta: null,
      error: null,
    });
  });

  // Staff users & session revocation (Contract 8.5)
  router.get("/users", requireAuth, authController.getStaffUsers);
  router.post(
    "/users/:id/revoke-sessions",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(revokeSessionsSchema),
    authController.revokeSessions
  );

  const authRouter = createAuthRouter(container);
  const cmsRouter = createCmsRouter(container);
  const crmRouter = createCrmRouter(container);
  const mediaRouter = createMediaRouter(container);
  const analyticsRouter = createAnalyticsRouter(container);
  const emergencyRouter = createEmergencyRouter(container);
  const publicRouter = createPublicRouter(container);

  // Mount modular sub-routers
  router.use("/auth", authRouter);
  router.use("/cms", cmsRouter);
  router.use("/crm", crmRouter);
  router.use("/media", mediaRouter);
  router.use("/analytics", analyticsRouter);
  router.use("/emergency", emergencyRouter);
  router.use("/", publicRouter);
  router.use("/", cmsRouter);

  return router;
}

export default createV1Router();
