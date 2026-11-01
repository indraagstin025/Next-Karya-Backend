import { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { sendSuccess } from "../utils/response";

const analyticsService = new AnalyticsService();

export class AnalyticsController {
  async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const result = await analyticsService.getOverview(site_id, from, to);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getPages(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const limit = parseInt(req.query.limit as string, 10) || 10;

      const result = await analyticsService.getPages(site_id, from, to, limit);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async getSources(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const result = await analyticsService.getSources(site_id, from, to);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
