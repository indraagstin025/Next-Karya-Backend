import { Request, Response, NextFunction } from "express";
import { CrmService } from "../services/crm.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { checkOptimisticLock } from "../utils/optimistic";

const crmService = new CrmService();

export class CrmController {
  async createLeadInternal(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await crmService.createLeadInternal(req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async getLeads(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const status = req.query.status as any;
      const assignedToId = req.query.assignedToId as string | undefined;
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
      const search = req.query.search as string | undefined;

      const { items, meta } = await crmService.getLeads({
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
  }

  async getFollowUpToday(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const assignedToId = req.query.assignedToId as string | undefined;

      const items = await crmService.getFollowUpToday(site_id, assignedToId);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async getLeadById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const item = await crmService.getLeadById(id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Prospek tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async updateLead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const current = await crmService.getLeadById(id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Prospek tidak ditemukan.");

      const isAllowed = checkOptimisticLock(res, req.body.updatedAt, current.updatedAt, current);
      if (!isAllowed) return;

      const result = await crmService.updateLead(id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async addLeadNote(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await crmService.addLeadNote(id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  // --- SCHEDULES ---
  async getSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const assignedToId = req.query.assignedToId as string | undefined;

      const items = await crmService.getSchedules(site_id, assignedToId);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async createSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await crmService.createSchedule(req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateSchedule(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const current = await crmService.getSchedules(req.body.site_id || "nextkarya-main");
      const target = current.find((s) => s.id === id);
      if (!target) return sendError(res, 404, "NOT_FOUND", "Jadwal tidak ditemukan.");

      const isAllowed = checkOptimisticLock(res, req.body.updatedAt, target.updatedAt, target);
      if (!isAllowed) return;

      const result = await crmService.updateSchedule(id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
