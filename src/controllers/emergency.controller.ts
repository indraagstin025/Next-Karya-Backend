import { Request, Response, NextFunction } from "express";
import { EmergencyService } from "../services/emergency.service";
import { sendSuccess } from "../utils/response";
import { defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

export class EmergencyController {
  constructor(
    private readonly emergencyService: EmergencyService = new EmergencyService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  getEmergencyOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 30, 1), 100);
      const result = await this.emergencyService.getEmergencyOverview(site_id, limit);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  unpublishContent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.emergencyService.unpublishContent({
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
  };

  lockContactForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.emergencyService.lockContactForm({
        site_id: req.body.site_id,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  unlockContactForm = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.emergencyService.unlockContactForm({
        site_id: req.body.site_id,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  setAlertBanner = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.emergencyService.setAlertBanner({
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
  };

  reassignLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const id = req.params.id as string;
      const result = await this.emergencyService.reassignLead(id, {
        site_id: req.body.site_id,
        newAssignedToId: req.body.newAssignedToId,
        reason: req.body.reason,
        executedById: req.user!.id,
      });
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
