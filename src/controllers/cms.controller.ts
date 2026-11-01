import { Request, Response, NextFunction } from "express";
import { CmsService } from "../services/cms.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { checkOptimisticLock, defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

/**
 * Extracts the client's optimistic lock timestamp from either `req.body.updatedAt` or the `x-updated-at` header.
 */
function extractUpdatedAt(req: Request): string | undefined {
  return (
    (typeof req.body?.updatedAt === "string" ? req.body.updatedAt : undefined) ||
    (typeof req.headers["x-updated-at"] === "string"
      ? req.headers["x-updated-at"]
      : undefined)
  );
}

/**
 * HTTP handlers for CMS content management, enforcing tenant isolation and optimistic concurrency control.
 */
export class CmsController {
  constructor(
    private readonly cmsService: CmsService = new CmsService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  /**
   * Lists all article categories for the authorized tenant.
   */
  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const items = await this.cmsService.getCategories(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a new article category under the authorized tenant.
   */
  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createCategory(site_id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates category metadata or slug within the authorized tenant.
   */
  updateCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.updateCategory(
        req.params.id as string,
        site_id,
        req.body
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Deletes an empty category within the authorized tenant.
   */
  deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await this.cmsService.deleteCategory(req.params.id as string, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists paginated CMS articles with optional status, category, and keyword filters.
   */
  getPosts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const category = req.query.category as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100);
      const search = req.query.search as string | undefined;

      const { items, meta } = await this.cmsService.getPosts({
        site_id,
        status,
        category,
        page,
        limit,
        search,
      });
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single CMS article by ID within the authorized tenant.
   */
  getPostById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.cmsService.getPostById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a draft article attributed to the authenticated staff member.
   */
  createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createPost(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates an article after verifying the client's optimistic lock timestamp.
   */
  updatePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPostById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await this.cmsService.updatePost(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Publishes an article, enforcing optimistic locking when `updatedAt` is provided by the client.
   */
  publishPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPostById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.publishPost(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Archives an article and invalidates public caches, checking optimistic lock if supplied.
   */
  archivePost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPostById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.archivePost(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists paginated portfolio items for the authorized tenant.
   */
  getPortfolios = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100);
      const search = req.query.search as string | undefined;

      const { items, meta } = await this.cmsService.getPortfolios({
        site_id,
        status,
        page,
        limit,
        search,
      });
      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single portfolio item by ID within the authorized tenant.
   */
  getPortfolioById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.cmsService.getPortfolioById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a draft portfolio entry under the authorized tenant.
   */
  createPortfolio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createPortfolio(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates a portfolio entry after verifying the client's optimistic lock timestamp.
   */
  updatePortfolio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPortfolioById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await this.cmsService.updatePortfolio(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Publishes a portfolio entry after validating completeness and optional optimistic lock.
   */
  publishPortfolio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPortfolioById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.publishPortfolio(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Archives a portfolio entry and invalidates public portfolio caches.
   */
  archivePortfolio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPortfolioById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.archivePortfolio(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists service offerings for the authorized tenant, optionally filtered by publication status.
   */
  getServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const items = await this.cmsService.getServices(site_id, status);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single service offering by ID within the authorized tenant.
   */
  getServiceById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.cmsService.getServiceById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a draft service offering under the authorized tenant.
   */
  createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createService(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates a service offering after verifying the client's optimistic lock timestamp.
   */
  updateService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getServiceById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await this.cmsService.updateService(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Publishes a service offering after validating required fields and optional optimistic lock.
   */
  publishService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getServiceById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.publishService(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Archives a service offering and invalidates public service caches.
   */
  archiveService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getServiceById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.archiveService(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists static pages for the authorized tenant, optionally filtered by status.
   */
  getPages = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const items = await this.cmsService.getPages(site_id, status);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a static page and its ordered content blocks by ID.
   */
  getPageById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.cmsService.getPageById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a static page alongside its initial content blocks.
   */
  createPage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createPage(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates a static page and its blocks after verifying the client's optimistic lock timestamp.
   */
  updatePage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPageById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await this.cmsService.updatePage(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Publishes a static page and triggers frontend path revalidation.
   */
  publishPage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPageById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.publishPage(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Archives a static page and invalidates its public route cache.
   */
  archivePage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getPageById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.archivePage(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists FAQ entries for the authorized tenant ordered by display sequence.
   */
  getFaqs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const items = await this.cmsService.getFaqs(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single FAQ entry by ID within the authorized tenant.
   */
  getFaqById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.cmsService.getFaqById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "FAQ tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates an FAQ entry and invalidates the public FAQ cache.
   */
  createFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createFaq(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates an FAQ entry after verifying the client's optimistic lock timestamp.
   */
  updateFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getFaqById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "FAQ tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await this.cmsService.updateFaq(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Deletes an FAQ entry and records a pre-deletion snapshot for recovery.
   */
  deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await this.cmsService.deleteFaq(req.params.id as string, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists client testimonials for the authorized tenant, optionally filtered by status.
   */
  getTestimonials = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const items = await this.cmsService.getTestimonials(site_id, status);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single client testimonial by ID within the authorized tenant.
   */
  getTestimonialById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const item = await this.cmsService.getTestimonialById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Testimoni tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a client testimonial under the authorized tenant.
   */
  createTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createTestimonial(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Updates a client testimonial after verifying the client's optimistic lock timestamp.
   */
  updateTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getTestimonialById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Testimoni tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await this.cmsService.updateTestimonial(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Archives a client testimonial and invalidates public testimonial caches.
   */
  archiveTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await this.cmsService.getTestimonialById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Testimoni tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await this.cmsService.archiveTestimonial(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists recent revision snapshots for the authorized tenant, optionally filtered by entity type and ID.
   */
  getSnapshots = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const items = await this.cmsService.getSnapshots({ site_id, entityType, entityId });
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Restores a CMS entity from a historical snapshot and records a backup snapshot of the displaced state.
   */
  restoreSnapshot = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const result = await this.cmsService.restoreSnapshot(
        req.params.id as string,
        site_id,
        req.user!.id
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists all URL redirect rules for the authorized tenant.
   */
  getRedirects = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const items = await this.cmsService.getRedirects(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Creates a manual URL redirect rule after checking for self-loops and circular chains.
   */
  createRedirect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createRedirect(site_id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Deletes a URL redirect rule within the authorized tenant.
   */
  deleteRedirect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await this.cmsService.deleteRedirect(req.params.id as string, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
