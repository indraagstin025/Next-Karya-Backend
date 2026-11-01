import { Router } from "express";
import { appContainer, AppContainer } from "../../container";
import { validateBody, validateParams, idParamSchema } from "../../middlewares/validate";
import {
  createCategorySchema,
  updateCategorySchema,
  createPostSchema,
  updatePostSchema,
  createPortfolioSchema,
  updatePortfolioSchema,
  createServiceSchema,
  updateServiceSchema,
  createPageSchema,
  updatePageSchema,
  createFaqSchema,
  updateFaqSchema,
  createTestimonialSchema,
  updateTestimonialSchema,
  createRedirectSchema,
  mutationLockBodySchema,
} from "../../validators/cms";

/**
 * Creates the authenticated CMS router for managing categories, posts, portfolios,
 * services, pages, FAQs, testimonials, redirects, and revision snapshots.
 */
export function createCmsRouter(container: AppContainer = appContainer): Router {
  const router = Router();
  const { cms: cmsController } = container.controllers;
  const { requireAuth } = container.middlewares;

  router.get("/categories", requireAuth, cmsController.getCategories);
  router.post(
    "/categories",
    requireAuth,
    validateBody(createCategorySchema),
    cmsController.createCategory
  );
  router.patch(
    "/categories/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updateCategorySchema),
    cmsController.updateCategory
  );
  router.delete(
    "/categories/:id",
    requireAuth,
    validateParams(idParamSchema),
    cmsController.deleteCategory
  );

  router.get("/posts", requireAuth, cmsController.getPosts);
  router.get("/posts/:id", requireAuth, validateParams(idParamSchema), cmsController.getPostById);
  router.post("/posts", requireAuth, validateBody(createPostSchema), cmsController.createPost);
  router.patch(
    "/posts/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updatePostSchema),
    cmsController.updatePost
  );
  router.post(
    "/posts/:id/publish",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.publishPost
  );
  router.post(
    "/posts/:id/archive",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.archivePost
  );

  router.get("/portfolios", requireAuth, cmsController.getPortfolios);
  router.get(
    "/portfolios/:id",
    requireAuth,
    validateParams(idParamSchema),
    cmsController.getPortfolioById
  );
  router.post(
    "/portfolios",
    requireAuth,
    validateBody(createPortfolioSchema),
    cmsController.createPortfolio
  );
  router.patch(
    "/portfolios/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updatePortfolioSchema),
    cmsController.updatePortfolio
  );
  router.post(
    "/portfolios/:id/publish",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.publishPortfolio
  );
  router.post(
    "/portfolios/:id/archive",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.archivePortfolio
  );

  router.get("/services", requireAuth, cmsController.getServices);
  router.get(
    "/services/:id",
    requireAuth,
    validateParams(idParamSchema),
    cmsController.getServiceById
  );
  router.post(
    "/services",
    requireAuth,
    validateBody(createServiceSchema),
    cmsController.createService
  );
  router.patch(
    "/services/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updateServiceSchema),
    cmsController.updateService
  );
  router.post(
    "/services/:id/publish",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.publishService
  );
  router.post(
    "/services/:id/archive",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.archiveService
  );

  router.get("/pages", requireAuth, cmsController.getPages);
  router.get("/pages/:id", requireAuth, validateParams(idParamSchema), cmsController.getPageById);
  router.post("/pages", requireAuth, validateBody(createPageSchema), cmsController.createPage);
  router.patch(
    "/pages/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updatePageSchema),
    cmsController.updatePage
  );
  router.post(
    "/pages/:id/publish",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.publishPage
  );
  router.post(
    "/pages/:id/archive",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.archivePage
  );

  router.get("/faqs", requireAuth, cmsController.getFaqs);
  router.get("/faqs/:id", requireAuth, validateParams(idParamSchema), cmsController.getFaqById);
  router.post("/faqs", requireAuth, validateBody(createFaqSchema), cmsController.createFaq);
  router.patch(
    "/faqs/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updateFaqSchema),
    cmsController.updateFaq
  );
  router.delete("/faqs/:id", requireAuth, validateParams(idParamSchema), cmsController.deleteFaq);

  router.get("/testimonials", requireAuth, cmsController.getTestimonials);
  router.get(
    "/testimonials/:id",
    requireAuth,
    validateParams(idParamSchema),
    cmsController.getTestimonialById
  );
  router.post(
    "/testimonials",
    requireAuth,
    validateBody(createTestimonialSchema),
    cmsController.createTestimonial
  );
  router.patch(
    "/testimonials/:id",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(updateTestimonialSchema),
    cmsController.updateTestimonial
  );
  router.post(
    "/testimonials/:id/archive",
    requireAuth,
    validateParams(idParamSchema),
    validateBody(mutationLockBodySchema),
    cmsController.archiveTestimonial
  );

  router.get("/redirects", requireAuth, cmsController.getRedirects);
  router.post(
    "/redirects",
    requireAuth,
    validateBody(createRedirectSchema),
    cmsController.createRedirect
  );
  router.delete(
    "/redirects/:id",
    requireAuth,
    validateParams(idParamSchema),
    cmsController.deleteRedirect
  );

  router.get("/content-snapshots", requireAuth, cmsController.getSnapshots);
  router.post(
    "/content-snapshots/:id/restore",
    requireAuth,
    validateParams(idParamSchema),
    cmsController.restoreSnapshot
  );

  return router;
}

export default createCmsRouter();
