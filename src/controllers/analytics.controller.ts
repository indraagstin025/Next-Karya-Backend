import { Request, Response, NextFunction } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { sendSuccess } from "../utils/response";
import { defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

/**
 * HTTP handlers for tenant-scoped traffic, conversion, and attribution analytics.
 */
export class AnalyticsController {
  constructor(
    private readonly analyticsService: AnalyticsService = new AnalyticsService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  /**
   * Returns KPI summary metrics and daily timeline series for the authorized tenant.
   */
  getOverview = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const result = await this.analyticsService.getOverview(site_id, from, to);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Returns top visited page paths ranked by view volume, clamped between 1 and 100 rows.
   */
  getPages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 10, 1), 100);

      const result = await this.analyticsService.getPages(site_id, from, to, limit);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Returns UTM source and medium breakdowns for traffic and lead acquisition.
   */
  getSources = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const from = req.query.from as string | undefined;
      const to = req.query.to as string | undefined;

      const result = await this.analyticsService.getSources(site_id, from, to);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
