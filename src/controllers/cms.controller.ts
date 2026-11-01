import { Request, Response, NextFunction } from "express";
import { CmsService } from "../services/cms.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { checkOptimisticLock, resolveAuthorizedSiteId } from "../utils/optimistic";

const cmsService = new CmsService();

function extractUpdatedAt(req: Request): string | undefined {
  return (
    (typeof req.body?.updatedAt === "string" ? req.body.updatedAt : undefined) ||
    (typeof req.headers["x-updated-at"] === "string"
      ? req.headers["x-updated-at"]
      : undefined)
  );
}

export class CmsController {
  // Categories
  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const items = await cmsService.getCategories(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createCategory(site_id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.updateCategory(
        req.params.id as string,
        site_id,
        req.body
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteCategory(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await cmsService.deleteCategory(req.params.id as string, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Posts (Articles)
  async getPosts(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const category = req.query.category as string | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100);
      const search = req.query.search as string | undefined;

      const { items, meta } = await cmsService.getPosts({
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
  }

  async getPostById(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const item = await cmsService.getPostById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async createPost(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createPost(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updatePost(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPostById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await cmsService.updatePost(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async publishPost(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPostById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.publishPost(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async archivePost(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPostById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.archivePost(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Portfolios
  async getPortfolios(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = Math.min(Math.max(1, parseInt(req.query.limit as string, 10) || 20), 100);
      const search = req.query.search as string | undefined;

      const { items, meta } = await cmsService.getPortfolios({
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
  }

  async getPortfolioById(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const item = await cmsService.getPortfolioById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async createPortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createPortfolio(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updatePortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPortfolioById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await cmsService.updatePortfolio(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async publishPortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPortfolioById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.publishPortfolio(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async archivePortfolio(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPortfolioById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.archivePortfolio(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Services
  async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const items = await cmsService.getServices(site_id, status);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async getServiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const item = await cmsService.getServiceById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async createService(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createService(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateService(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getServiceById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await cmsService.updateService(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async publishService(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getServiceById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.publishService(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async archiveService(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getServiceById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Layanan tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.archiveService(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Pages
  async getPages(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const items = await cmsService.getPages(site_id, status);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async getPageById(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const item = await cmsService.getPageById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async createPage(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createPage(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updatePage(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPageById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await cmsService.updatePage(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async publishPage(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPageById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.publishPage(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async archivePage(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getPageById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.archivePage(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // FAQs
  async getFaqs(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const items = await cmsService.getFaqs(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async getFaqById(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const item = await cmsService.getFaqById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "FAQ tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async createFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createFaq(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getFaqById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "FAQ tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await cmsService.updateFaq(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async deleteFaq(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await cmsService.deleteFaq(req.params.id as string, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Testimonials
  async getTestimonials(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const status = req.query.status as "DRAFT" | "PUBLISHED" | "ARCHIVED" | undefined;
      const items = await cmsService.getTestimonials(site_id, status);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async getTestimonialById(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const item = await cmsService.getTestimonialById(req.params.id as string, site_id);
      if (!item) return sendError(res, 404, "NOT_FOUND", "Testimoni tidak ditemukan.");
      return sendSuccess(res, item);
    } catch (err) {
      next(err);
    }
  }

  async createTestimonial(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createTestimonial(site_id, req.body, req.user!.id);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async updateTestimonial(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getTestimonialById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Testimoni tidak ditemukan.");

      const isAllowed = checkOptimisticLock(
        res,
        extractUpdatedAt(req),
        current.updatedAt,
        current
      );
      if (!isAllowed) return;

      const result = await cmsService.updateTestimonial(id, site_id, req.body, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  async archiveTestimonial(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const id = req.params.id as string;
      const current = await cmsService.getTestimonialById(id, site_id);
      if (!current) return sendError(res, 404, "NOT_FOUND", "Testimoni tidak ditemukan.");

      const reqUpdatedAt = extractUpdatedAt(req);
      if (reqUpdatedAt) {
        const isAllowed = checkOptimisticLock(res, reqUpdatedAt, current.updatedAt, current);
        if (!isAllowed) return;
      }

      const result = await cmsService.archiveTestimonial(id, site_id, req.user!.id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Snapshots
  async getSnapshots(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const entityType = req.query.entityType as string | undefined;
      const entityId = req.query.entityId as string | undefined;
      const items = await cmsService.getSnapshots({ site_id, entityType, entityId });
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async restoreSnapshot(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body?.site_id ?? req.query.site_id);
      const result = await cmsService.restoreSnapshot(
        req.params.id as string,
        site_id,
        req.user!.id
      );
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  // Redirects
  async getRedirects(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id);
      const items = await cmsService.getRedirects(site_id);
      return sendSuccess(res, items);
    } catch (err) {
      next(err);
    }
  }

  async createRedirect(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.body.site_id ?? req.query.site_id);
      const result = await cmsService.createRedirect(site_id, req.body);
      return sendSuccess(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async deleteRedirect(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = resolveAuthorizedSiteId(req.query.site_id ?? req.body?.site_id);
      const result = await cmsService.deleteRedirect(req.params.id as string, site_id);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
