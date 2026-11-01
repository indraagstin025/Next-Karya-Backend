import { Request, Response, NextFunction } from "express";
import { PublicService } from "../services/public.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";
import { defaultTenantGuard } from "../utils/optimistic";
import { ITenantGuard } from "../container/types";

/**
 * HTTP handlers for unauthenticated public website content delivery, lead intake, and analytics ingestion.
 */
export class PublicController {
  constructor(
    private readonly publicService: PublicService = new PublicService(),
    private readonly tenantGuard: ITenantGuard = defaultTenantGuard
  ) {}

  /**
   * Returns emergency alert banner state and contact form lock status for the public frontend.
   */
  getSiteStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const status = await this.publicService.getSiteStatus(site_id);
      return sendSuccess(res, status);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists article categories alongside their published post counts.
   */
  getCategories = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const categories = await this.publicService.getCategories(site_id);
      return sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Resolves active 301/302 redirect rules for legacy slugs on the public website.
   */
  lookupRedirect = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const fromPath = (req.query.fromPath as string) || "";
      if (!fromPath) {
        return sendSuccess(res, null);
      }
      const redirect = await this.publicService.lookupRedirect(site_id, fromPath);
      return sendSuccess(res, redirect);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists paginated published articles filtered by category, tag, or search keyword.
   */
  getArticles = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
      const category = req.query.category as string | undefined;
      const tag = req.query.tag as string | undefined;
      const search = req.query.search as string | undefined;

      const { items, meta } = await this.publicService.getArticles({
        site_id,
        page,
        limit,
        category,
        tag,
        search,
      });

      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single published article by slug, returning 404 if unpublished or absent.
   */
  getArticleBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const slug = req.params.slug as string;

      const article = await this.publicService.getArticleBySlug(site_id, slug);
      if (!article) {
        return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");
      }

      return sendSuccess(res, article);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists paginated published portfolios with optional featured filtering.
   */
  getPortfolios = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
      const isFeatured =
        req.query.isFeatured === "true"
          ? true
          : req.query.isFeatured === "false"
          ? false
          : undefined;

      const { items, meta } = await this.publicService.getPortfolios({
        site_id,
        isFeatured,
        page,
        limit,
      });

      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a single published portfolio case study by slug.
   */
  getPortfolioBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const slug = req.params.slug as string;

      const portfolio = await this.publicService.getPortfolioBySlug(site_id, slug);
      if (!portfolio) {
        return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");
      }

      return sendSuccess(res, portfolio);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists published service offerings ordered by display sequence.
   */
  getServices = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const services = await this.publicService.getServices(site_id);
      return sendSuccess(res, services);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists active FAQs for the public website, optionally filtered by category.
   */
  getFaqs = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const category = req.query.category as string | undefined;
      const faqs = await this.publicService.getFaqs(site_id, category);
      return sendSuccess(res, faqs);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Lists published client testimonials ordered by display sequence.
   */
  getTestimonials = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const testimonials = await this.publicService.getTestimonials(site_id);
      return sendSuccess(res, testimonials);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Retrieves a published static page and its structured content blocks by slug.
   */
  getPageBySlug = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const site_id = this.tenantGuard.resolveAuthorizedSiteId(req.query.site_id);
      const slug = req.params.slug as string;

      const page = await this.publicService.getPageBySlug(site_id, slug);
      if (!page) {
        return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");
      }

      return sendSuccess(res, page);
    } catch (err) {
      next(err);
    }
  };

  /**
   * Processes public consultation form submissions and returns a confirmation message without leaking internal lead IDs.
   */
  submitLead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      await this.publicService.submitLead(req.body);
      return sendSuccess(
        res,
        {
          message:
            "Pesan konsultasi Anda berhasil kami terima. Tim kami akan segera menghubungi Anda.",
        },
        201
      );
    } catch (err) {
      next(err);
    }
  };

  /**
   * Ingests a client-side analytics event from the public website.
   */
  recordAnalyticsEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.publicService.recordAnalyticsEvent(req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}
