import { Request, Response, NextFunction } from "express";
import { PublicService } from "../services/public.service";
import { sendSuccess, sendPaginated, sendError } from "../utils/response";

const publicService = new PublicService();

export class PublicController {
  async getSiteStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const status = await publicService.getSiteStatus(site_id);
      return sendSuccess(res, status);
    } catch (err) {
      next(err);
    }
  }

  async getCategories(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const categories = await publicService.getCategories(site_id);
      return sendSuccess(res, categories);
    } catch (err) {
      next(err);
    }
  }

  async lookupRedirect(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const fromPath = (req.query.fromPath as string) || "";
      if (!fromPath) {
        return sendSuccess(res, null);
      }
      const redirect = await publicService.lookupRedirect(site_id, fromPath);
      return sendSuccess(res, redirect);
    } catch (err) {
      next(err);
    }
  }

  async getArticles(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
      const category = req.query.category as string | undefined;
      const tag = req.query.tag as string | undefined;
      const search = req.query.search as string | undefined;

      const { items, meta } = await publicService.getArticles({
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
  }

  async getArticleBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const slug = req.params.slug as string;

      const article = await publicService.getArticleBySlug(site_id, slug);
      if (!article) {
        return sendError(res, 404, "NOT_FOUND", "Artikel tidak ditemukan.");
      }

      return sendSuccess(res, article);
    } catch (err) {
      next(err);
    }
  }

  async getPortfolios(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const page = Math.max(parseInt(req.query.page as string, 10) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 20, 1), 100);
      const isFeatured =
        req.query.isFeatured === "true"
          ? true
          : req.query.isFeatured === "false"
          ? false
          : undefined;

      const { items, meta } = await publicService.getPortfolios({
        site_id,
        isFeatured,
        page,
        limit,
      });

      return sendPaginated(res, items, meta);
    } catch (err) {
      next(err);
    }
  }

  async getPortfolioBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const slug = req.params.slug as string;

      const portfolio = await publicService.getPortfolioBySlug(site_id, slug);
      if (!portfolio) {
        return sendError(res, 404, "NOT_FOUND", "Portofolio tidak ditemukan.");
      }

      return sendSuccess(res, portfolio);
    } catch (err) {
      next(err);
    }
  }

  async getServices(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const services = await publicService.getServices(site_id);
      return sendSuccess(res, services);
    } catch (err) {
      next(err);
    }
  }

  async getFaqs(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const category = req.query.category as string | undefined;
      const faqs = await publicService.getFaqs(site_id, category);
      return sendSuccess(res, faqs);
    } catch (err) {
      next(err);
    }
  }

  async getTestimonials(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const testimonials = await publicService.getTestimonials(site_id);
      return sendSuccess(res, testimonials);
    } catch (err) {
      next(err);
    }
  }

  async getPageBySlug(req: Request, res: Response, next: NextFunction) {
    try {
      const site_id = (req.query.site_id as string) || "nextkarya-main";
      const slug = req.params.slug as string;

      const page = await publicService.getPageBySlug(site_id, slug);
      if (!page) {
        return sendError(res, 404, "NOT_FOUND", "Halaman tidak ditemukan.");
      }

      return sendSuccess(res, page);
    } catch (err) {
      next(err);
    }
  }

  async submitLead(req: Request, res: Response, next: NextFunction) {
    try {
      await publicService.submitLead(req.body);
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
  }

  async recordAnalyticsEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await publicService.recordAnalyticsEvent(req.body);
      return sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }
}
