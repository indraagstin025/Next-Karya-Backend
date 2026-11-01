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

export function createCrmRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { crm: crmController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.use(requireAuth);

  // CRM Follow Up Agenda Today (Morning Operational)
  router.get("/follow-up-today", crmController.getFollowUpToday);

  // Leads
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

  // Project Schedules (Gantt timeline)
  router.get("/schedules", crmController.getSchedules);
  router.post("/schedules", validateBody(createScheduleSchema), crmController.createSchedule);
  router.patch(
    "/schedules/:id",
    validateParams(idParamSchema),
    validateBody(updateScheduleSchema),
    crmController.updateSchedule
  );

  return router;
}

export default createCrmRouter();
