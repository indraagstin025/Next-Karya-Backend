import crypto from "crypto";
import { prisma } from "../config/prisma";
import { PaginationMeta } from "../utils/response";
import { resolveAuthorizedSiteId } from "../utils/optimistic";

export class PublicService {
  async getSiteStatus(rawSiteId?: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const site = await prisma.site.findUnique({
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

  async getCategories(rawSiteId?: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    return prisma.category.findMany({
      where: { site_id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
      },
    });
  }

  async lookupRedirect(rawSiteId: string | undefined, fromPath: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const normalizedPath = fromPath.startsWith("/") ? fromPath : `/${fromPath}`;
    return prisma.redirect.findFirst({
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

  async getArticles(query: {
    site_id?: string;
    page: number;
    limit: number;
    category?: string;
    tag?: string;
    search?: string;
  }) {
    const site_id = resolveAuthorizedSiteId(query.site_id);
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
      prisma.post.count({ where }),
      prisma.post.findMany({
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

  async getArticleBySlug(rawSiteId: string | undefined, slug: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const post = await prisma.post.findFirst({
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

    let relatedPosts: { id: string; title: string; slug: string }[] = [];
    if (post.relatedPostIds && post.relatedPostIds.length > 0) {
      relatedPosts = await prisma.post.findMany({
        where: {
          site_id,
          id: { in: post.relatedPostIds },
          status: "PUBLISHED",
        },
        select: { id: true, title: true, slug: true },
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

  async getPortfolios(query: {
    site_id?: string;
    isFeatured?: boolean;
    page: number;
    limit: number;
  }) {
    const site_id = resolveAuthorizedSiteId(query.site_id);
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
      prisma.portfolio.count({ where }),
      prisma.portfolio.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ isFeatured: "desc" }, { sortOrder: "asc" }, { publishedAt: "desc" }],
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

  async getPortfolioBySlug(rawSiteId: string | undefined, slug: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    return prisma.portfolio.findFirst({
      where: {
        site_id,
        slug,
        status: "PUBLISHED",
      },
    });
  }

  async getServices(rawSiteId?: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    return prisma.service.findMany({
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
        priceLabel: true,
        priceNote: true,
        badge: true,
        ctaLabel: true,
        ctaHref: true,
        sortOrder: true,
      },
    });
  }

  async getFaqs(rawSiteId?: string, category?: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const where: any = {
      site_id,
      isActive: true,
    };

    if (category) {
      where.category = category;
    }

    return prisma.faq.findMany({
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

  async getTestimonials(rawSiteId?: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    return prisma.testimonial.findMany({
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

  async getPageBySlug(rawSiteId: string | undefined, slug: string) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    return prisma.page.findFirst({
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

    const site_id = resolveAuthorizedSiteId(payload.site_id);

    const site = await prisma.site.findUnique({
      where: { id: site_id },
      select: { id: true, isFormLocked: true },
    });

    if (!site) {
      throw { statusCode: 404, code: "SITE_NOT_FOUND", message: "Situs tidak ditemukan." };
    }

    if (site.isFormLocked) {
      throw {
        statusCode: 403,
        code: "FORM_LOCKED",
        message: "Formulir konsultasi sedang dialihkan ke WhatsApp resmi.",
      };
    }

    const lead = await prisma.lead.create({
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

    const siteStaff = await prisma.user.findFirst({
      where: { isActive: true },
      select: { id: true },
    });

    if (siteStaff) {
      await prisma.activityLog.create({
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

  async recordAnalyticsEvent(payload: {
    site_id?: string;
    sessionId: string;
    eventName: "pageview" | "whatsapp_click" | "form_submit" | "heartbeat";
    path: string;
    referrer?: string | null;
    source: string;
    device: "mobile" | "desktop" | "tablet" | "unknown";
    browser?: string | null;
    os?: string | null;
    durationSec: number;
  }) {
    const site_id = resolveAuthorizedSiteId(payload.site_id);
    const visitorIdHash = crypto
      .createHash("sha256")
      .update(payload.sessionId + (payload.browser || ""))
      .digest("hex")
      .slice(0, 32);

    prisma.analyticsEvent
      .create({
        data: {
          site_id,
          sessionId: payload.sessionId,
          eventName: payload.eventName,
          path: payload.path,
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
        console.error("[Analytics Event Error]", err.message);
      });

    return { status: "recorded" };
  }
}
