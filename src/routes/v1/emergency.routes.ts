import { Router } from "express";
import { EmergencyController } from "../../controllers/emergency.controller";
import { requireAuth } from "../../middlewares/auth";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import {
  unpublishContentSchema,
  lockFormSchema,
  unlockFormSchema,
  alertBannerSchema,
  reassignLeadEmergencySchema,
} from "../../validators/emergency";

const router = Router();
const emergencyController = new EmergencyController();

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

export default router;
