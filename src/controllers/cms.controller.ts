import { Request, Response, NextFunction } from "express";
import { CmsService } from "../services/cms.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { checkOptimisticLock, defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

function extractUpdatedAt(req: Request): string | undefined {
  return (
    (typeof req.body?.updatedAt === "string" ? req.body.updatedAt : undefined) ||
    (typeof req.headers["x-updated-at"] === "string"
      ? req.headers["x-updated-at"]
      : undefined)
  );
}

export class CmsController {
  constructor(
    private readonly cmsService: CmsService = new CmsService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  // Categories
  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const items = await this.cmsService.getCategories(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createCategory(site_id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await this.cmsService.deleteCategory(req.params.id as string, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  // Posts (Articles)
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

  createPost = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createPost(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  // Portfolios
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

  createPortfolio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createPortfolio(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  // Services
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

  createService = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createService(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  // Pages
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

  createPage = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createPage(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  // FAQs
  getFaqs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const items = await this.cmsService.getFaqs(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

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

  createFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createFaq(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  deleteFaq = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await this.cmsService.deleteFaq(req.params.id as string, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  // Testimonials
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

  createTestimonial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createTestimonial(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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

  // Snapshots
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

  // Redirects
  getRedirects = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const items = await this.cmsService.getRedirects(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  };

  createRedirect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await this.cmsService.createRedirect(site_id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  };

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
