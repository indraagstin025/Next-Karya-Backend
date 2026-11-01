import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import {
  unpublishContentSchema,
  lockFormSchema,
  unlockFormSchema,
  alertBannerSchema,
  reassignLeadEmergencySchema,
} from "../../validators/emergency";

/**
 * Creates the `/emergency` router for authenticated incident response, content takedown, and form locking.
 */
export function createEmergencyRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { emergency: emergencyController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.use(requireAuth);

  router.get("/overview", emergencyController.getEmergencyOverview);
  router.post("/unpublish", validateBody(unpublishContentSchema), emergencyController.unpublishContent);
  router.post("/lock-form", validateBody(lockFormSchema), emergencyController.lockContactForm);
  router.post("/unlock-form", validateBody(unlockFormSchema), emergencyController.unlockContactForm);
  router.post("/banner", validateBody(alertBannerSchema), emergencyController.setAlertBanner);
  router.post(
    "/leads/:id/reassign",
    validateParams(idParamSchema),
    validateBody(reassignLeadEmergencySchema),
    emergencyController.reassignLead
  );

  return router;
}

export default createEmergencyRouter();
