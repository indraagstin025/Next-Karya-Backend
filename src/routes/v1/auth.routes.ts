import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import { loginSchema, revokeSessionsSchema } from "../../validators/auth";

export function createAuthRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { auth: authController } = container.controllers;
  const { requireAuth, rateLimiter } = container.middlewares;

  const loginRateLimiter = rateLimiter({
    windowSec: 900,
    maxRequests: 10,
    prefix: "rl_login",
  });

  router.post("/login", loginRateLimiter, validateBody(loginSchema), authController.login);
  router.get("/me", requireAuth, authController.me);
  router.get("/users", requireAuth, authController.getStaffUsers);
  router.post(
    "/users/:id/revoke-sessions",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(revokeSessionsSchema),
    authController.revokeSessions
  );

  return router;
}

export default createAuthRouter();
