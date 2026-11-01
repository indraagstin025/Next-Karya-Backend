import { Request, Response, NextFunction } from "express";
import { CrmService } from "../services/crm.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { checkOptimisticLock, defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

export class CrmController {
  constructor(
    private readonly crmService: CrmService = new CrmService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  createLeadInternal = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.crmService.createLeadInternal(req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  // --- SCHEDULES ---
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

  createSchedule = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.crmService.createSchedule(req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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
