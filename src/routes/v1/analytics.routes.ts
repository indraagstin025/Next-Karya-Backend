import { Router } from "express";
import { appContainer, AppContainer } from "../../container";

export function createAnalyticsRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { analytics: analyticsController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.use(requireAuth);

  router.get("/overview", analyticsController.getOverview);
  router.get("/pages", analyticsController.getPages);
  router.get("/sources", analyticsController.getSources);

  return router;
}

export default createAnalyticsRouter();
