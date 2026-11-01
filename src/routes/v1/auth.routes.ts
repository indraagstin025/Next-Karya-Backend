import { Router } from "express";
import { AuthController } from "../../controllers/auth.controller";
import { requireAuth } from "../../middlewares/auth";
import { rateLimiter } from "../../middlewares/rateLimiter";
import { validateBody, validateParams } from "../../middlewares/validate";
import { loginSchema, revokeSessionsSchema } from "../../validators/auth";

const router = Router();
const authController = new AuthController();

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
  validateParams(),
  validateBody(revokeSessionsSchema),
  authController.revokeSessions
);

export default router;
