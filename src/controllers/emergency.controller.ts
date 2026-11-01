import { Request, Response, NextFunction } from "express";
import { EmergencyService } from "../services/emergency.service";
import { sendSuccess } from "../utils/response";

const emergencyService = new EmergencyService();

export class EmergencyController {
  async getEmergencyOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const limit = parseInt(req.query.limit as string, 10) || 30;
      const result = await emergencyService.getEmergencyOverview(site_id, limit);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async unpublishContent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await emergencyService.unpublishContent({
        site_id: req.body.site_id,
        targetEntity: req.body.targetEntity,
        targetId: req.body.targetId,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async lockContactForm(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await emergencyService.lockContactForm({
        site_id: req.body.site_id,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async unlockContactForm(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await emergencyService.unlockContactForm({
        site_id: req.body.site_id,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async setAlertBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await emergencyService.setAlertBanner({
        site_id: req.body.site_id,
        isActive: req.body.isActive,
        alertBanner: req.body.alertBanner,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async reassignLead(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const result = await emergencyService.reassignLead(id, {
        site_id: req.body.site_id,
        newAssignedToId: req.body.newAssignedToId,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
