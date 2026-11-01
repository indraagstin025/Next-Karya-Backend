import { Request, Response, NextFunction } from "express";
import { CrmService } from "../services/crm.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { checkOptimisticLock, defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

/**
 * HTTP handlers for CRM lead pipelines, follow-up queues, activity notes, and schedules.
 */
export class CrmController {
  constructor(
    private readonly crmService: CrmService = new CrmService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  /**
   * Creates a lead manually from the internal CRM dashboard and attributes the action to the authenticated staff member.
   */
  createLeadInternal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.crmService.createLeadInternal(req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists paginated leads for the authorized tenant with optional status, assignee, and keyword filters.
   */
  getLeads = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as any;
      const assignedToId = req.query.assignedToId as string | undefined;
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
      const search = req.query.search as string | undefined;

      const { items, meta } = await this.crmService.getLeads({
        site_id,
        status,
        assignedToId,
        page,
        limit,
        search,
      });

      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Returns active leads with follow-up dates due at or before the end of the current day.
   */
  getFollowUpToday = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const assignedToId = req.query.assignedToId as string | undefined;

      const items = await this.crmService.getFollowUpToday(site_id, assignedToId);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single lead alongside its notes and schedules, enforcing tenant isolation.
   */
  getLeadById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.crmService.getLeadById(id, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Prospek tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates lead pipeline fields after verifying the client's optimistic lock timestamp.
   */
  updateLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(
        req.body?.site_id ?? req.query.site_id
      );
      const current = await this.crmService.getLeadById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Prospek tidak ditemukan.");

      const isAllowed = checkOptimisticLock(res, req.body.updatedAt, current.updatedAt, current);
      if (!isAllowed) return;

      const result = await this.crmService.updateLead(id, req.body, req.user!.id, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Appends an internal note to a lead within the caller's authorized tenant.
   */
  addLeadNote = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(
        req.body?.site_id ?? req.query.site_id
      );
      const result = await this.crmService.addLeadNote(id, req.body, req.user!.id, site_id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists consultation schedules for the authorized tenant, optionally filtered by assigned PIC.
   */
  getSchedules = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const assignedToId = req.query.assignedToId as string | undefined;

      const items = await this.crmService.getSchedules(site_id, assignedToId);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a consultation schedule linked to a lead and records an activity log entry.
   */
  createSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.crmService.createSchedule(req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates schedule timing, PIC, or outcome after verifying the optimistic lock timestamp.
   */
  updateSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(
        req.body?.site_id ?? req.query.site_id
      );
      const target = await this.crmService.getScheduleById(id, site_id);
      if (!target) return sendError(res, 404, "NOT_FOUND", "Jadwal tidak ditemukan.");

      const isAllowed = checkOptimisticLock(res, req.body.updatedAt, target.updatedAt, target);
      if (!isAllowed) return;

      const result = await this.crmService.updateSchedule(id, req.body, req.user!.id, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
