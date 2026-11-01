import { Router } from "express";
import publicRoutes from "./public.routes";
import authRoutes from "./auth.routes";
import cmsRoutes from "./cms.routes";
import crmRoutes from "./crm.routes";
import mediaRoutes from "./media.routes";
import analyticsRoutes from "./analytics.routes";
import emergencyRoutes from "./emergency.routes";
import { AuthController } from "../../controllers/auth.controller";
import { requireAuth } from "../../middlewares/auth";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import { revokeSessionsSchema } from "../../validators/auth";

const router = Router();
const authController = new AuthController();

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

// Mount modular sub-routers
router.use("/auth", authRoutes);
router.use("/cms", cmsRoutes);
router.use("/crm", crmRoutes);
router.use("/media", mediaRoutes);
router.use("/analytics", analyticsRoutes);
router.use("/emergency", emergencyRoutes);
router.use("/", publicRoutes);
router.use("/", cmsRoutes);

export default router;
