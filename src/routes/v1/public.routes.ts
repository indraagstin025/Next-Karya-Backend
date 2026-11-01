import { Router, Request, Response, NextFunction } from "express";
import { appContainer, AppContainer } from "../../container";
import { validateBody, validateParams, slugParamSchema } from "../../middlewares/validate";
import { hasBearerAuth } from "../../middlewares/auth";
import { createLeadPublicSchema, analyticsEventSchema } from "../../validators/public";

/**
 * Delegates shared root paths (such as `/portfolios` or `/categories`) to the authenticated
 * CMS router whenever a request carries a Bearer token or `?scope=cms`.
 */
function skipIfAuthenticatedCms(req: Request, _res: Response, next: NextFunction) {
  if (hasBearerAuth(req) || req.query.scope === "cms") {
    return next("route");
  }
  return next();
}

/**
 * Creates the public content and intake router with tiered rate limiting for reads,
 * lead submissions, and analytics beacons.
 */
export function createPublicRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { public: publicController } = container.controllers;
  const { rateLimiter } = container.middlewares;

  const readRateLimiter = rateLimiter({ windowSec: 60, maxRequests: 120, prefix: "rl_read" });

  router.get("/site-status", readRateLimiter, publicController.getSiteStatus);
  router.get("/redirects/lookup", readRateLimiter, publicController.lookupRedirect);
  router.get("/categories", skipIfAuthenticatedCms, readRateLimiter, publicController.getCategories);

  router.get("/articles", readRateLimiter, publicController.getArticles);
  router.get(
    "/articles/:slug",
    readRateLimiter,
    validateParams(slugParamSchema),
    publicController.getArticleBySlug
  );

  router.get("/portfolios", skipIfAuthenticatedCms, readRateLimiter, publicController.getPortfolios);
  router.get(
    "/portfolios/:slug",
    skipIfAuthenticatedCms,
    readRateLimiter,
    validateParams(slugParamSchema),
    publicController.getPortfolioBySlug
  );

  router.get("/services", skipIfAuthenticatedCms, readRateLimiter, publicController.getServices);
  router.get("/faqs", skipIfAuthenticatedCms, readRateLimiter, publicController.getFaqs);
  router.get(
    "/testimonials",
    skipIfAuthenticatedCms,
    readRateLimiter,
    publicController.getTestimonials
  );

  router.get(
    "/pages/:slug",
    skipIfAuthenticatedCms,
    readRateLimiter,
    validateParams(slugParamSchema),
    publicController.getPageBySlug
  );

  router.post(
    "/leads",
    rateLimiter({ windowSec: 900, maxRequests: 5, prefix: "rl_lead" }),
    validateBody(createLeadPublicSchema),
    publicController.submitLead
  );

  router.post(
    "/analytics/event",
    rateLimiter({ windowSec: 60, maxRequests: 60, prefix: "rl_analytics" }),
    validateBody(analyticsEventSchema),
    publicController.recordAnalyticsEvent
  );

  return router;
}

export default createPublicRouter();
