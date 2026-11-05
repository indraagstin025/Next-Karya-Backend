import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import {
  createLeadInternalSchema,
  updateLeadSchema,
  createLeadNoteSchema,
  createScheduleSchema,
  updateScheduleSchema,
} from "../../validators/crm";

/**
 * Creates the `/crm` router for authenticated lead management, follow-up queues, notes, and schedules.
 */
export function createCrmRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { crm: crmController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.use(requireAuth);

  router.get("/follow-up-today", crmController.getFollowUpToday);

  router.get("/leads", crmController.getLeads);
  router.get("/leads/:id", validateParams(idParamSchema), crmController.getLeadById);
  router.post("/leads", validateBody(createLeadInternalSchema), crmController.createLeadInternal);
  router.patch(
    "/leads/:id",
    validateParams(idParamSchema),
    validateBody(updateLeadSchema),
    crmController.updateLead
  );
  router.post(
    "/leads/:id/notes",
    validateParams(idParamSchema),
    validateBody(createLeadNoteSchema),
    crmController.addLeadNote
  );

  router.get("/schedules", crmController.getSchedules);
  router.post("/schedules", validateBody(createScheduleSchema), crmController.createSchedule);
  router.patch(
    "/schedules/:id",
    validateParams(idParamSchema),
    validateBody(updateScheduleSchema),
    crmController.updateSchedule
  );
  router.delete(
    "/schedules/:id",
    validateParams(idParamSchema),
    crmController.deleteSchedule
  );

  return router;
}

export default createCrmRouter();
