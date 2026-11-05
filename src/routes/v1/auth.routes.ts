import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import { loginSchema, revokeSessionsSchema, changePasswordSchema } from "../../validators/auth";

/**
 * Creates the `/auth` router with IP-based brute-force rate limiting on `/login`
 * and JWT authentication on profile and session revocation endpoints.
 */
export function createAuthRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { auth: authController } = container.controllers;
  const { requireAuth, requireAdmin, rateLimiter } = container.middlewares;

  const loginRateLimiter = rateLimiter({
    windowSec: 900,
    maxRequests: 10,
    prefix: "rl_login",
  });

  router.post("/login", loginRateLimiter, validateBody(loginSchema), authController.login);
  router.get("/me", requireAuth, authController.me);
  router.post(
    "/change-password",
    requireAuth,
    requireAdmin,
    validateBody(changePasswordSchema),
    authController.changeOwnPassword
  );
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
