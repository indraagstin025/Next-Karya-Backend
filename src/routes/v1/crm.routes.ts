import { Router } from "express";
import { CrmController } from "../../controllers/crm.controller";
import { requireAuth } from "../../middlewares/auth";
import { validateBody } from "../../middlewares/validate";
import {
  createLeadInternalSchema,
  updateLeadSchema,
  createLeadNoteSchema,
  createScheduleSchema,
  updateScheduleSchema,
} from "../../validators/crm";

const router = Router();
const crmController = new CrmController();

router.use(requireAuth);

// CRM Follow Up Agenda Today (Morning Operational)
router.get("/follow-up-today", crmController.getFollowUpToday);

// Leads
router.get("/leads", crmController.getLeads);
router.get("/leads/:id", crmController.getLeadById);
router.post("/leads", validateBody(createLeadInternalSchema), crmController.createLeadInternal);
router.patch("/leads/:id", validateBody(updateLeadSchema), crmController.updateLead);
router.post("/leads/:id/notes", validateBody(createLeadNoteSchema), crmController.addLeadNote);

// Project Schedules (Gantt timeline)
router.get("/schedules", crmController.getSchedules);
router.post("/schedules", validateBody(createScheduleSchema), crmController.createSchedule);
router.patch("/schedules/:id", validateBody(updateScheduleSchema), crmController.updateSchedule);

export default router;
