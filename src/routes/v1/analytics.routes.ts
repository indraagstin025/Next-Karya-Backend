import { Router } from "express";
import { appContainer, AppContainer } from "../../container";

/**
 * Creates the `/analytics` router with mandatory JWT authentication for traffic and conversion reporting.
 */
export function createAnalyticsRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { analytics: analyticsController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.use(requireAuth);

  router.get("/overview", analyticsController.getOverview);
  router.get("/pages", analyticsController.getPages);
  router.get("/sources", analyticsController.getSources);
  router.get("/devices", analyticsController.getDevices);

  return router;
}

export default createAnalyticsRouter();
