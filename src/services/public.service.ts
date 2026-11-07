import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { env as defaultEnv, EnvConfig } from "../config/env";
import { ITenantGuard } from "../container/types";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import {
  buildVisitorIdHash,
  getJakartaDateKey,
  isAllowedAnalyticsOrigin,
} from "../utils/analytics";
import { defaultTenantGuard } from "../utils/optimistic";
import { PaginationMeta } from "../utils/response";

export interface PublicServiceDeps {
  prisma: PrismaClient;
  tenantGuard: ITenantGuard;
  logger: ILogger;
  env: EnvConfig;
}

/**
 * Serves public read-only website content (strictly filtered to `PUBLISHED` or `isActive: true`)
 * as well as public consultation form intake and anonymous analytics beacon ingestion.
 */
export class PublicService {
  constructor(
    private readonly deps: PublicServiceDeps = {
      prisma: defaultPrisma,
      tenantGuard: defaultTenantGuard,
      logger: defaultLogger,
      env: defaultEnv,
    }
  ) {}

  /**
   * Returns public site operational status (`isFormLocked`, `isAlertActive`, `alertBanner`),
   * supplying safe default values if the site record has not been seeded yet.
   */
  async getSiteStatus(rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const site = await this.deps.prisma.site.findUnique({
      where: { id: site_id },
      select: {
        id: true,
        name: true,
        domain: true,
        isActive: true,
        isFormLocked: true,
        alertBanner: true,
        isAlertActive: true,
        updatedAt: true,
      },
    });
    if (!site) {
      return {
        id: site_id,
        name: "Next Karya Digital Solutions",
        domain: "nextkarya.web.id",
        isActive: true,
        isFormLocked: false,
        alertBanner: null,
        isAlertActive: false,
      };
    }
    return site;
  }

  /**
   * Lists public blog categories ordered alphabetically for article filtering.
   */
  async getCategories(rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    return this.deps.prisma.category.findMany({
      where: { site_id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  /**
   * Resolves a custom 301/302 redirect rule when a visitor requests a legacy URL path.
   */
  async lookupRedirect(rawSiteId: string | undefined, fromPath: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const normalizedPath = fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
    return this.deps.prisma.redirect.findFirst({
      where: {
        site_id,
        sourcePath: normalizedPath,
      },
      select: {
        id: true,
        sourcePath: true,
        targetPath: true,
        statusCode: true,
      },
    });
  }

  /**
   * Queries published blog articles with pagination, category/tag filtering, and keyword search,
   * omitting full body `content` to keep list payloads lightweight.
   */
  async getArticles(query: {
    site_id?: string;
    page: number;
    limit: number;
    category?: string;
    tag?: string;
    search?: string;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(query.site_id);
    const { page, limit, category, tag, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      site_id,
      status: "PUBLISHED",
    };

    if (category) {
      where.category = { slug: category };
    }

    if (tag) {
      where.tags = { has: tag };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.deps.prisma.post.count({ where }),
      this.deps.prisma.post.findMany({
        where,
        skip,
        take: limit,
        orderBy: { publishedAt: "desc" },
        select: {
          id: true,
          site_id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverUrl: true,
          coverAlt: true,
          tags: true,
          readingTimeMinutes: true,
          publishedAt: true,
          category: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
          author: {
            select: {
              fullName: true,
              jobTitle: true,
              avatarUrl: true,
            },
          },
        },
      }),
    ]);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };

    return { items, meta };
  }

  /**
   * Fetches a single published article by slug and resolves its published `relatedPosts` summaries.
   */
  async getArticleBySlug(rawSiteId: string | undefined, slug: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const post = await this.deps.prisma.post.findFirst({
      where: {
        site_id,
        slug,
        status: "PUBLISHED",
      },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        author: {
          select: { fullName: true, jobTitle: true, avatarUrl: true },
        },
      },
    });

    if (!post) return null;

    let relatedPosts: {
      id: string;
      title: string;
      slug: string;
      excerpt: string;
      coverUrl: string | null;
      coverAlt: string | null;
      readingTimeMinutes: number;
      publishedAt: Date | null;
      category: { name: string; slug: string } | null;
    }[] = [];
    if (post.relatedPostIds && post.relatedPostIds.length > 0) {
      relatedPosts = await this.deps.prisma.post.findMany({
        where: {
          site_id,
          id: { in: post.relatedPostIds },
          status: "PUBLISHED",
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          coverUrl: true,
          coverAlt: true,
          readingTimeMinutes: true,
          publishedAt: true,
          category: { select: { name: true, slug: true } },
        },
      });
    }

    return {
      id: post.id,
      site_id: post.site_id,
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverUrl: post.coverUrl,
      coverAlt: post.coverAlt,
      tags: post.tags,
      readingTimeMinutes: post.readingTimeMinutes,
      seoTitle: post.seoTitle,
      seoDescription: post.seoDescription,
      category: post.category,
      author: post.author,
      publishedAt: post.publishedAt,
      relatedPosts,
    };
  }

  /**
   * Lists published portfolio case studies ordered by featured priority and manual `sortOrder`.
   */
  async getPortfolios(query: {
    site_id?: string;
    isFeatured?: boolean;
    page: number;
    limit: number;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(query.site_id);
    const { isFeatured, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      site_id,
      status: "PUBLISHED",
    };

    if (isFeatured !== undefined) {
      where.isFeatured = isFeatured;
    }

    const [total, items] = await Promise.all([
      this.deps.prisma.portfolio.count({ where }),
      this.deps.prisma.portfolio.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isFeatured: "desc" },
          { sortOrder: "asc" },
          { publishedAt: "desc" },
        ],
        select: {
          id: true,
          site_id: true,
          title: true,
          slug: true,
          clientName: true,
          serviceCategory: true,
          summary: true,
          impactSummary: true,
          metricResult: true,
          technologies: true,
          thumbnailUrl: true,
          thumbnailAlt: true,
          projectUrl: true,
          isFeatured: true,
          publishedAt: true,
        },
      }),
    ]);

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };

    return { items, meta };
  }

  /**
   * Fetches full details of a published portfolio case study by slug.
   */
  async getPortfolioBySlug(rawSiteId: string | undefined, slug: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    return this.deps.prisma.portfolio.findFirst({
      where: {
        site_id,
        slug,
        status: "PUBLISHED",
      },
    });
  }

  /**
   * Lists published service packages ordered by `sortOrder` ascending.
   */
  async getServices(rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    return this.deps.prisma.service.findMany({
      where: {
        site_id,
        status: "PUBLISHED",
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        site_id: true,
        title: true,
        slug: true,
        icon: true,
        shortDesc: true,
        features: true,
        badge: true,
        ctaLabel: true,
        ctaHref: true,
        sortOrder: true,
      },
    });
  }

  /**
   * Lists active FAQ entries (`isActive: true`), optionally filtered by category.
   */
  async getFaqs(rawSiteId?: string, category?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const where: any = {
      site_id,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    return this.deps.prisma.faq.findMany({
      where,
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        question: true,
        answer: true,
        category: true,
        sortOrder: true,
      },
    });
  }

  /**
   * Lists published client testimonials along with their linked portfolio title and slug.
   */
  async getTestimonials(rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    return this.deps.prisma.testimonial.findMany({
      where: {
        site_id,
        status: "PUBLISHED",
      },
      orderBy: { sortOrder: "asc" },
      select: {
        id: true,
        clientName: true,
        clientRole: true,
        companyName: true,
        content: true,
        rating: true,
        avatarUrl: true,
        portfolio: {
          select: {
            title: true,
            slug: true,
          },
        },
      },
    });
  }

  /**
   * Fetches a published static page by slug.
   */
  async getPageBySlug(rawSiteId: string | undefined, slug: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    return this.deps.prisma.page.findFirst({
      where: {
        site_id,
        slug,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        site_id: true,
        title: true,
        slug: true,
        content: true,
        seoTitle: true,
        seoDescription: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Processes a public consultation form submission: silently drops automated spam when the
   * honeypot field (`website_url`) is populated, rejects submissions with HTTP 403 when the
   * site's emergency form lock (`isFormLocked`) is active, and creates a `BARU` lead.
   */
  async submitLead(payload: {
    site_id?: string;
    clientName: string;
    companyName?: string | null;
    whatsappNumber: string;
    email?: string | null;
    serviceRequested: string;
    message: string;
    website_url?: string;
  }) {
    if (payload.website_url && payload.website_url.trim().length > 0) {
      return { trapped: true };
    }

    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);

    const site = await this.deps.prisma.site.findUnique({
      where: { id: site_id },
      select: { id: true, isFormLocked: true },
    });

    if (!site) {
      throw AppError.notFound("Situs tidak ditemukan.", "SITE_NOT_FOUND");
    }

    if (site.isFormLocked) {
      throw AppError.forbidden(
        "FORM_LOCKED",
        "Formulir konsultasi sedang dialihkan ke WhatsApp resmi."
      );
    }

    const lead = await this.deps.prisma.lead.create({
      data: {
        site_id,
        clientName: payload.clientName,
        companyName: payload.companyName || null,
        whatsappNumber: payload.whatsappNumber,
        email: payload.email || null,
        serviceRequested: payload.serviceRequested,
        message: payload.message,
        status: "BARU",
      },
    });

    const siteStaff = await this.deps.prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (siteStaff) {
      await this.deps.prisma.activityLog.create({
        data: {
          site_id,
          actorId: siteStaff.id,
          action: "LEAD_STATUS_CHANGED",
          entityType: "LEAD",
          entityId: lead.id,
          summary: `Prospek baru masuk via formulir website dari ${payload.clientName} (${payload.serviceRequested}).`,
        },
      });
    }

    return { trapped: false, leadId: lead.id };
  }

  /**
   * Asynchronously persists an anonymous visitor beacon event (`pageview`,
   * `whatsapp_click`, `form_submit`, `heartbeat`, `service_click`, or
   * `portfolio_click`) using a daily salted visitor hash without blocking the
   * HTTP response.
   */
  async recordAnalyticsEvent(
    payload: {
      site_id?: string;
      sessionId: string;
      eventName:
        | "pageview"
        | "whatsapp_click"
        | "form_submit"
        | "heartbeat"
        | "service_click"
        | "portfolio_click";
      path: string;
      targetPath?: string | null;
      referrer?: string | null;
      source: string;
      device: "mobile" | "desktop" | "tablet" | "unknown";
      browser?: string | null;
      os?: string | null;
      durationSec: number;
    },
    context: {
      clientIp?: string | null;
      origin?: string | null;
      referer?: string | null;
      host?: string | null;
    } = {}
  ) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);

    if (!this.isAllowedOrigin(context)) {
      throw AppError.forbidden(
        "ANALYTICS_ORIGIN_REJECTED",
        "Asal permintaan analitik tidak dikenali."
      );
    }

    const visitorIdHash = buildVisitorIdHash({
      secret: this.deps.env.ANALYTICS_SALT_SECRET || this.deps.env.JWT_SECRET,
      siteId: site_id,
      dateKey: getJakartaDateKey(),
      sessionId: payload.sessionId,
      clientIp: context.clientIp,
    });

    this.deps.prisma.analyticsEvent
      .create({
        data: {
          site_id,
          sessionId: payload.sessionId,
          eventName: payload.eventName,
          path: payload.path,
          targetPath: payload.targetPath ?? null,
          referrer: payload.referrer,
          source: payload.source,
          device: payload.device,
          browser: payload.browser,
          os: payload.os,
          durationSec: payload.durationSec,
          visitorIdHash,
        },
      })
      .catch((err) => {
        this.deps.logger.error("[Analytics Event Error]", {
          error: err?.message,
        });
      });

    return { status: "recorded" };
  }

  private isAllowedOrigin(context: {
    origin?: string | null;
    referer?: string | null;
    host?: string | null;
  }): boolean {
    const allowedOrigins = [
      this.deps.env.FRONTEND_URL,
      "https://nextkarya.web.id",
      "https://www.nextkarya.web.id",
    ];

    if (this.deps.env.NODE_ENV !== "production") {
      allowedOrigins.push("http://localhost:3000");
    }

    return isAllowedAnalyticsOrigin({
      origin: context.origin,
      referer: context.referer,
      host: context.host,
      allowedOrigins,
    });
  }
}
