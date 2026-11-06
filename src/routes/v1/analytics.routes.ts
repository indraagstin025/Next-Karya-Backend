import { Router } from "express";
import { appContainer, AppContainer } from "../../container";

/**
 * Creates the `/analytics` router. Report endpoints require a staff JWT per route:
 * the router must not blanket-401 unknown or non-GET requests, because the public
 * anonymous beacon (`POST /analytics/event`) is handled by one of the following
 * sibling mount points.
 */
export function createAnalyticsRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { analytics: analyticsController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.get("/overview", requireAuth, analyticsController.getOverview);
  router.get("/pages", requireAuth, analyticsController.getPages);
  router.get("/sources", requireAuth, analyticsController.getSources);
  router.get("/devices", requireAuth, analyticsController.getDevices);

  return router;
}

export default createAnalyticsRouter();
