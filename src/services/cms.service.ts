import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { cache as defaultCache } from "../config/redis";
import { defaultWebhookNotifier } from "../utils/webhook";
import { defaultTenantGuard } from "../utils/optimistic";
import { PaginationMeta } from "../utils/response";
import { AppError } from "../core/AppError";
import { ILogger, logger as defaultLogger } from "../core/logger";
import { ICacheService, ITenantGuard, IWebhookNotifier } from "../container/types";

export interface CmsServiceDeps {
  prisma: PrismaClient;
  cache: ICacheService;
  webhook: IWebhookNotifier;
  tenantGuard: ITenantGuard;
  logger: ILogger;
}

const defaultCmsDeps: CmsServiceDeps = {
  prisma: defaultPrisma,
  cache: defaultCache,
  webhook: defaultWebhookNotifier,
  tenantGuard: defaultTenantGuard,
  logger: defaultLogger,
};

/**
 * Estimates article reading time in minutes based on a 180-words-per-minute reading speed,
 * clamped between 1 and 60 minutes.
 */
function estimateReadingTimeMinutes(content: unknown): number {
  try {
    const rawText = typeof content === "string" ? content : JSON.stringify(content ?? "");
    const words = rawText
      .replace(/[{}\[\]":,]/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean).length;
    return Math.max(1, Math.min(60, Math.ceil(words / 180)));
  } catch {
    return 3;
  }
}

/**
 * Orchestrates CMS content lifecycles (`DRAFT` -> `PUBLISHED` -> `ARCHIVED`),
 * 5-version FIFO content snapshots, cache invalidation, and Next.js ISR webhook notifications.
 */
export class CmsService {
  private readonly deps: CmsServiceDeps;

  constructor(deps: Partial<CmsServiceDeps> = {}) {
    this.deps = { ...defaultCmsDeps, ...deps };
  }

  /**
   * Evicts Redis CMS cache keys for the given tag and triggers an asynchronous Next.js
   * ISR revalidation webhook without blocking the caller if the frontend is unreachable.
   */
  private async invalidateCmsCache(site_id: string, tag: string) {
    await Promise.allSettled([
      this.deps.cache.del(`cache:cms:${site_id}:${tag}`),
      this.deps.cache.del(`cache:cms:${site_id}:pricing`),
    ]);
    this.deps.webhook.triggerRevalidation(tag).catch((err) => {
      this.deps.logger.warn("Revalidation webhook call failed", {
        tag,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  /**
   * Calculates the next sequential snapshot version number (`latest + 1`) for an entity prior to publishing.
   */
  private async nextSnapshotVersion(site_id: string, entityType: string, entityId: string): Promise<number> {
    const latest = await this.deps.prisma.contentSnapshot.findFirst({
      where: { site_id, entityType, entityId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  /**
   * Lists all article categories for the given `site_id` along with their linked post counts.
   */
  async getCategories(site_id: string) {
    return this.deps.prisma.category.findMany({
      where: { site_id },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });
  }

  /**
   * Creates a new article category scoped to `site_id`.
   */
  async createCategory(site_id: string, payload: { name: string; slug: string }) {
    return this.deps.prisma.category.create({
      data: {
        site_id,
        name: payload.name,
        slug: payload.slug,
      },
    });
  }

  /**
   * Updates a category's name or slug after verifying it belongs to the active `site_id`.
   */
  async updateCategory(id: string, site_id: string, payload: { name?: string; slug?: string }) {
    const existing = await this.deps.prisma.category.findFirst({
      where: { id, site_id },
    });
    if (!existing) {
      throw AppError.notFound("Kategori tidak ditemukan.");
    }

    return this.deps.prisma.category.update({
      where: { id: existing.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
      },
    });
  }

  /**
   * Deletes an article category only when its post count is zero, throwing `CATEGORY_IN_USE` (HTTP 400)
   * if any articles still reference it.
   */
  async deleteCategory(id: string, site_id: string) {
    const existing = await this.deps.prisma.category.findFirst({
      where: { id, site_id },
      include: { _count: { select: { posts: true } } },
    });
    if (!existing) {
      throw AppError.notFound("Kategori tidak ditemukan.");
    }
    if (existing._count.posts > 0) {
      throw AppError.badRequest(
        "CATEGORY_IN_USE",
        `Kategori "${existing.name}" masih dipakai oleh ${existing._count.posts} artikel, jadi belum bisa dihapus.`
      );
    }

    await this.deps.prisma.category.delete({ where: { id: existing.id } });
    return { message: "Kategori berhasil dihapus." };
  }

  /**
   * Queries paginated blog posts for the CMS dashboard across all workflow states (`DRAFT`, `PUBLISHED`, `ARCHIVED`).
   */
  async getPosts(query: {
    site_id: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    category?: string;
    page: number;
    limit: number;
    search?: string;
  }) {
    const { site_id, status, category, page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    if (category) {
      where.category = { slug: category };
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { excerpt: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.deps.prisma.post.count({ where: where as any }),
      this.deps.prisma.post.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          author: { select: { id: true, fullName: true, email: true, jobTitle: true } },
          lastEditor: { select: { id: true, fullName: true, jobTitle: true } },
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
   * Fetches a single blog post by `{ id, site_id }` including category, author, and last editor details.
   */
  async getPostById(id: string, site_id: string) {
    return this.deps.prisma.post.findFirst({
      where: { id, site_id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, fullName: true, email: true, jobTitle: true } },
        lastEditor: { select: { id: true, fullName: true, jobTitle: true } },
      },
    });
  }

  /**
   * Creates a new blog post in `DRAFT` status after verifying that `categoryId` belongs to the same `site_id`
   * and auto-calculating `readingTimeMinutes` when omitted.
   */
  async createPost(site_id: string, payload: any, authorId: string) {
    const category = await this.deps.prisma.category.findFirst({
      where: { id: payload.categoryId, site_id },
      select: { id: true },
    });
    if (!category) {
      throw AppError.badRequest(
        "INVALID_CATEGORY",
        "Kategori yang dipilih tidak ditemukan."
      );
    }

    const readingTimeMinutes =
      payload.readingTimeMinutes ?? estimateReadingTimeMinutes(payload.content);

    return this.deps.prisma.post.create({
      data: {
        site_id,
        title: payload.title,
        slug: payload.slug,
        excerpt: payload.excerpt,
        content: payload.content ?? [],
        coverUrl: payload.coverUrl ?? null,
        coverAlt: payload.coverAlt ?? null,
        categoryId: category.id,
        tags: Array.isArray(payload.tags) ? payload.tags : [],
        readingTimeMinutes,
        relatedPostIds: Array.isArray(payload.relatedPostIds) ? payload.relatedPostIds : [],
        seoTitle: payload.seoTitle ?? null,
        seoDescription: payload.seoDescription ?? null,
        authorId,
        lastEditedById: authorId,
        status: "DRAFT",
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, fullName: true, email: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Updates an existing blog post's content or metadata and invalidates the `articles` cache
   * if the post is already in `PUBLISHED` state.
   */
  async updatePost(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await this.deps.prisma.post.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Artikel tidak ditemukan.");
    }

    if (payload.categoryId !== undefined) {
      const category = await this.deps.prisma.category.findFirst({
        where: { id: payload.categoryId, site_id },
        select: { id: true },
      });
      if (!category) {
        throw AppError.badRequest(
          "INVALID_CATEGORY",
          "Kategori yang dipilih tidak tersedia."
        );
      }
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.excerpt !== undefined) data.excerpt = payload.excerpt;
    if (payload.content !== undefined) {
      data.content = payload.content;
      if (payload.readingTimeMinutes === undefined) {
        data.readingTimeMinutes = estimateReadingTimeMinutes(payload.content);
      }
    }
    if (payload.readingTimeMinutes !== undefined) data.readingTimeMinutes = payload.readingTimeMinutes;
    if (payload.coverUrl !== undefined) data.coverUrl = payload.coverUrl;
    if (payload.coverAlt !== undefined) data.coverAlt = payload.coverAlt;
    if (payload.categoryId !== undefined) data.categoryId = payload.categoryId;
    if (payload.tags !== undefined) data.tags = payload.tags;
    if (payload.relatedPostIds !== undefined) data.relatedPostIds = payload.relatedPostIds;
    if (payload.seoTitle !== undefined) data.seoTitle = payload.seoTitle;
    if (payload.seoDescription !== undefined) data.seoDescription = payload.seoDescription;

    const updated = await this.deps.prisma.post.update({
      where: { id: existing.id },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, fullName: true, email: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    if (updated.status === "PUBLISHED") {
      await this.invalidateCmsCache(site_id, "articles");
    }

    return updated;
  }

  /**
   * Publishes a blog post inside a database transaction that records a versioned `ContentSnapshot`
   * and `ActivityLog`, then prunes snapshots beyond the 5-version FIFO cap and invalidates cache.
   */
  async publishPost(id: string, site_id: string, editorId: string) {
    const post = await this.deps.prisma.post.findFirst({ where: { id, site_id } });
    if (!post) {
      throw AppError.notFound("Artikel tidak ditemukan.");
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "POST", post.id);

    const [, updatedPost] = await this.deps.prisma.$transaction([
      this.deps.prisma.contentSnapshot.create({
        data: {
          site_id: post.site_id,
          entityType: "POST",
          entityId: post.id,
          version: nextVersion,
          title: post.title,
          snapshotPayload: post as any,
          savedById: editorId,
        },
      }),
      this.deps.prisma.post.update({
        where: { id: post.id },
        data: {
          status: "PUBLISHED",
          publishedAt: post.publishedAt ?? new Date(),
          lastEditedById: editorId,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id: post.site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "POST",
          entityId: post.id,
          summary: `Menerbitkan artikel "${post.title}" ke status PUBLISHED`,
        },
      }),
    ]);

    await this.pruneSnapshots(site_id, "POST", post.id);
    await this.invalidateCmsCache(site_id, "articles");

    return updatedPost;
  }

  /**
   * Transitions a blog post to `ARCHIVED` status transactionally with an `ActivityLog` entry
   * and invalidates public article caches.
   */
  async archivePost(id: string, site_id: string, editorId: string) {
    const existing = await this.deps.prisma.post.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Artikel tidak ditemukan.");
    }

    const [post] = await this.deps.prisma.$transaction([
      this.deps.prisma.post.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          category: { select: { id: true, name: true, slug: true } },
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "POST",
          entityId: existing.id,
          summary: `Mengarsipkan artikel "${existing.title}" ke status ARCHIVED`,
        },
      }),
    ]);

    await this.invalidateCmsCache(site_id, "articles");
    return post;
  }

  /**
   * Queries paginated portfolio items for the CMS dashboard ordered by `sortOrder` and `updatedAt`.
   */
  async getPortfolios(query: {
    site_id: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    page: number;
    limit: number;
    search?: string;
  }) {
    const { site_id, status, page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { clientName: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
      ];
    }

    const [total, items] = await Promise.all([
      this.deps.prisma.portfolio.count({ where: where as any }),
      this.deps.prisma.portfolio.findMany({
        where: where as any,
        skip,
        take: limit,
        orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
        include: {
          lastEditor: { select: { id: true, fullName: true } },
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
   * Fetches a single portfolio item by `{ id, site_id }`.
   */
  async getPortfolioById(id: string, site_id: string) {
    return this.deps.prisma.portfolio.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Creates a new portfolio case study initialized in `DRAFT` status.
   */
  async createPortfolio(site_id: string, payload: any, editorId: string) {
    return this.deps.prisma.portfolio.create({
      data: {
        site_id,
        title: payload.title,
        slug: payload.slug,
        clientName: payload.clientName,
        serviceCategory: payload.serviceCategory,
        summary: payload.summary,
        impactSummary: payload.impactSummary ?? null,
        metricResult: payload.metricResult ?? null,
        content: payload.content ?? { description: payload.summary },
        technologies: Array.isArray(payload.technologies) ? payload.technologies : [],
        thumbnailUrl: payload.thumbnailUrl ?? null,
        thumbnailAlt: payload.thumbnailAlt ?? payload.title,
        projectUrl: payload.projectUrl ?? null,
        isFeatured: Boolean(payload.isFeatured),
        sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : 0,
        lastEditedById: editorId,
        status: "DRAFT",
      },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Updates an existing portfolio case study and invalidates the `portfolios` cache if currently published.
   */
  async updatePortfolio(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await this.deps.prisma.portfolio.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Portofolio tidak ditemukan.");
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.clientName !== undefined) data.clientName = payload.clientName;
    if (payload.serviceCategory !== undefined) data.serviceCategory = payload.serviceCategory;
    if (payload.summary !== undefined) data.summary = payload.summary;
    if (payload.impactSummary !== undefined) data.impactSummary = payload.impactSummary;
    if (payload.metricResult !== undefined) data.metricResult = payload.metricResult;
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.technologies !== undefined) data.technologies = payload.technologies;
    if (payload.thumbnailUrl !== undefined) data.thumbnailUrl = payload.thumbnailUrl;
    if (payload.thumbnailAlt !== undefined) data.thumbnailAlt = payload.thumbnailAlt;
    if (payload.projectUrl !== undefined) data.projectUrl = payload.projectUrl;
    if (payload.isFeatured !== undefined) data.isFeatured = payload.isFeatured;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;

    const updated = await this.deps.prisma.portfolio.update({
      where: { id: existing.id },
      data,
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    if (updated.status === "PUBLISHED") {
      await this.invalidateCmsCache(site_id, "portfolios");
    }

    return updated;
  }

  /**
   * Publishes a portfolio case study transactionally with a `ContentSnapshot` and `ActivityLog`,
   * enforcing the 5-version snapshot retention window.
   */
  async publishPortfolio(id: string, site_id: string, editorId: string) {
    const portfolio = await this.deps.prisma.portfolio.findFirst({ where: { id, site_id } });
    if (!portfolio) {
      throw AppError.notFound("Portofolio tidak ditemukan.");
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "PORTFOLIO", portfolio.id);

    const [, updated] = await this.deps.prisma.$transaction([
      this.deps.prisma.contentSnapshot.create({
        data: {
          site_id: portfolio.site_id,
          entityType: "PORTFOLIO",
          entityId: portfolio.id,
          version: nextVersion,
          title: portfolio.title,
          snapshotPayload: portfolio as any,
          savedById: editorId,
        },
      }),
      this.deps.prisma.portfolio.update({
        where: { id: portfolio.id },
        data: {
          status: "PUBLISHED",
          publishedAt: portfolio.publishedAt ?? new Date(),
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id: portfolio.site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "PORTFOLIO",
          entityId: portfolio.id,
          summary: `Menerbitkan portofolio "${portfolio.title}" ke status PUBLISHED`,
        },
      }),
    ]);

    await this.pruneSnapshots(site_id, "PORTFOLIO", portfolio.id);
    await this.invalidateCmsCache(site_id, "portfolios");
    return updated;
  }

  /**
   * Archives a portfolio case study and invalidates public portfolio caches.
   */
  async archivePortfolio(id: string, site_id: string, editorId: string) {
    const existing = await this.deps.prisma.portfolio.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Portofolio tidak ditemukan.");
    }

    const [portfolio] = await this.deps.prisma.$transaction([
      this.deps.prisma.portfolio.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "PORTFOLIO",
          entityId: existing.id,
          summary: `Mengarsipkan portofolio "${existing.title}" ke status ARCHIVED`,
        },
      }),
    ]);

    await this.invalidateCmsCache(site_id, "portfolios");
    return portfolio;
  }

  /**
   * Lists service & pricing packages for the CMS dashboard across optional status filters.
   */
  async getServices(site_id: string, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const where: Record<string, unknown> = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    return this.deps.prisma.service.findMany({
      where: where as any,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Fetches a single service package by `{ id, site_id }`.
   */
  async getServiceById(id: string, site_id: string) {
    return this.deps.prisma.service.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Creates a new service & pricing package initialized in `DRAFT` status.
   */
  async createService(site_id: string, payload: any, editorId: string) {
    return this.deps.prisma.service.create({
      data: {
        site_id,
        title: payload.title,
        slug: payload.slug,
        icon: payload.icon || "Globe",
        shortDesc: payload.shortDesc,
        features: Array.isArray(payload.features) ? payload.features : [],
        priceLabel: payload.priceLabel,
        priceNote: payload.priceNote ?? null,
        badge: payload.badge ?? null,
        ctaLabel: payload.ctaLabel || "Konsultasi Sekarang",
        ctaHref: payload.ctaHref || "#konsultasi",
        sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : 0,
        lastEditedById: editorId,
        status: "DRAFT",
      },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Updates a service package and invalidates the `services` cache if currently published.
   */
  async updateService(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await this.deps.prisma.service.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Layanan tidak ditemukan.");
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.icon !== undefined) data.icon = payload.icon;
    if (payload.shortDesc !== undefined) data.shortDesc = payload.shortDesc;
    if (payload.features !== undefined) data.features = payload.features;
    if (payload.priceLabel !== undefined) data.priceLabel = payload.priceLabel;
    if (payload.priceNote !== undefined) data.priceNote = payload.priceNote;
    if (payload.badge !== undefined) data.badge = payload.badge;
    if (payload.ctaLabel !== undefined) data.ctaLabel = payload.ctaLabel;
    if (payload.ctaHref !== undefined) data.ctaHref = payload.ctaHref;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;

    const updated = await this.deps.prisma.service.update({
      where: { id: existing.id },
      data,
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    if (updated.status === "PUBLISHED") {
      await this.invalidateCmsCache(site_id, "services");
    }

    return updated;
  }

  /**
   * Publishes a service package transactionally with a `ContentSnapshot` and `ActivityLog`,
   * pruning older snapshots beyond 5 versions.
   */
  async publishService(id: string, site_id: string, editorId: string) {
    const service = await this.deps.prisma.service.findFirst({ where: { id, site_id } });
    if (!service) {
      throw AppError.notFound("Layanan tidak ditemukan.");
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "SERVICE", service.id);

    const [, updated] = await this.deps.prisma.$transaction([
      this.deps.prisma.contentSnapshot.create({
        data: {
          site_id: service.site_id,
          entityType: "SERVICE",
          entityId: service.id,
          version: nextVersion,
          title: service.title,
          snapshotPayload: service as any,
          savedById: editorId,
        },
      }),
      this.deps.prisma.service.update({
        where: { id: service.id },
        data: {
          status: "PUBLISHED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id: service.site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "SERVICE",
          entityId: service.id,
          summary: `Menerbitkan layanan "${service.title}" ke status PUBLISHED`,
        },
      }),
    ]);

    await this.pruneSnapshots(site_id, "SERVICE", service.id);
    await this.invalidateCmsCache(site_id, "services");
    return updated;
  }

  /**
   * Archives a service package and invalidates public service caches.
   */
  async archiveService(id: string, site_id: string, editorId: string) {
    const existing = await this.deps.prisma.service.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Layanan tidak ditemukan.");
    }

    const [service] = await this.deps.prisma.$transaction([
      this.deps.prisma.service.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "SERVICE",
          entityId: existing.id,
          summary: `Mengarsipkan layanan "${existing.title}" ke status ARCHIVED`,
        },
      }),
    ]);

    await this.invalidateCmsCache(site_id, "services");
    return service;
  }

  /**
   * Lists static CMS pages across optional status filters.
   */
  async getPages(site_id: string, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const where: Record<string, unknown> = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    return this.deps.prisma.page.findMany({
      where: where as any,
      orderBy: { updatedAt: "desc" },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Fetches a single static page by `{ id, site_id }`.
   */
  async getPageById(id: string, site_id: string) {
    return this.deps.prisma.page.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Creates a new static page initialized in `DRAFT` status.
   */
  async createPage(site_id: string, payload: any, editorId: string) {
    return this.deps.prisma.page.create({
      data: {
        site_id,
        title: payload.title,
        slug: payload.slug,
        content: payload.content ?? [],
        seoTitle: payload.seoTitle ?? null,
        seoDescription: payload.seoDescription ?? null,
        lastEditedById: editorId,
        status: "DRAFT",
      },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Updates a static page and invalidates the `pages` cache if currently published.
   */
  async updatePage(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await this.deps.prisma.page.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Halaman tidak ditemukan.");
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.seoTitle !== undefined) data.seoTitle = payload.seoTitle;
    if (payload.seoDescription !== undefined) data.seoDescription = payload.seoDescription;

    const updated = await this.deps.prisma.page.update({
      where: { id: existing.id },
      data,
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    if (updated.status === "PUBLISHED") {
      await this.invalidateCmsCache(site_id, "pages");
    }

    return updated;
  }

  /**
   * Publishes a static page transactionally with a `ContentSnapshot` and `ActivityLog`,
   * enforcing the 5-version FIFO snapshot limit.
   */
  async publishPage(id: string, site_id: string, editorId: string) {
    const page = await this.deps.prisma.page.findFirst({ where: { id, site_id } });
    if (!page) {
      throw AppError.notFound("Halaman tidak ditemukan.");
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "PAGE", page.id);

    const [, updated] = await this.deps.prisma.$transaction([
      this.deps.prisma.contentSnapshot.create({
        data: {
          site_id: page.site_id,
          entityType: "PAGE",
          entityId: page.id,
          version: nextVersion,
          title: page.title,
          snapshotPayload: page as any,
          savedById: editorId,
        },
      }),
      this.deps.prisma.page.update({
        where: { id: page.id },
        data: {
          status: "PUBLISHED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id: page.site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "PAGE",
          entityId: page.id,
          summary: `Menerbitkan halaman "${page.title}" ke status PUBLISHED`,
        },
      }),
    ]);

    await this.pruneSnapshots(site_id, "PAGE", page.id);
    await this.invalidateCmsCache(site_id, "pages");
    return updated;
  }

  /**
   * Archives a static page and invalidates public page caches.
   */
  async archivePage(id: string, site_id: string, editorId: string) {
    const existing = await this.deps.prisma.page.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Halaman tidak ditemukan.");
    }

    const [page] = await this.deps.prisma.$transaction([
      this.deps.prisma.page.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      this.deps.prisma.activityLog.create({
        data: {
          site_id,
          actorId: editorId,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "PAGE",
          entityId: existing.id,
          summary: `Mengarsipkan halaman "${existing.title}" ke status ARCHIVED`,
        },
      }),
    ]);

    await this.invalidateCmsCache(site_id, "pages");
    return page;
  }

  /**
   * Lists all FAQ entries (both active and inactive) for the CMS dashboard.
   */
  async getFaqs(site_id: string) {
    return this.deps.prisma.faq.findMany({
      where: { site_id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Fetches a single FAQ entry by `{ id, site_id }`.
   */
  async getFaqById(id: string, site_id: string) {
    return this.deps.prisma.faq.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Creates a new FAQ entry (`isActive` defaults to `true`) and invalidates the `faqs` cache.
   */
  async createFaq(site_id: string, payload: any, editorId: string) {
    const created = await this.deps.prisma.faq.create({
      data: {
        site_id,
        question: payload.question,
        answer: payload.answer,
        category: payload.category || "Umum",
        sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : 0,
        isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
        lastEditedById: editorId,
      },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "faqs");
    return created;
  }

  /**
   * Updates an FAQ entry or its `isActive` visibility flag and invalidates the `faqs` cache.
   */
  async updateFaq(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await this.deps.prisma.faq.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("FAQ tidak ditemukan.");
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.question !== undefined) data.question = payload.question;
    if (payload.answer !== undefined) data.answer = payload.answer;
    if (payload.category !== undefined) data.category = payload.category;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);

    const updated = await this.deps.prisma.faq.update({
      where: { id: existing.id },
      data,
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "faqs");
    return updated;
  }

  /**
   * Soft-deactivates an FAQ entry (`isActive = false`) and invalidates the `faqs` cache.
   */
  async deleteFaq(id: string, site_id: string, editorId: string) {
    const existing = await this.deps.prisma.faq.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("FAQ tidak ditemukan.");
    }

    const updated = await this.deps.prisma.faq.update({
      where: { id: existing.id },
      data: {
        isActive: false,
        lastEditedById: editorId,
      },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "faqs");
    return updated;
  }

  /**
   * Lists client testimonials across optional status filters for the CMS dashboard.
   */
  async getTestimonials(site_id: string, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const where: Record<string, unknown> = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    return this.deps.prisma.testimonial.findMany({
      where: where as any,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Fetches a single testimonial by `{ id, site_id }`.
   */
  async getTestimonialById(id: string, site_id: string) {
    return this.deps.prisma.testimonial.findFirst({
      where: { id, site_id },
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  /**
   * Creates a client testimonial after verifying that any referenced `portfolioId` belongs
   * to the same `site_id`, then invalidates the `testimonials` cache.
   */
  async createTestimonial(site_id: string, payload: any, editorId: string) {
    if (payload.portfolioId) {
      const portfolio = await this.deps.prisma.portfolio.findFirst({
        where: { id: payload.portfolioId, site_id },
        select: { id: true },
      });
      if (!portfolio) {
        throw AppError.badRequest(
          "INVALID_PORTFOLIO",
          "Portofolio yang dipilih tidak ditemukan."
        );
      }
    }

    const created = await this.deps.prisma.testimonial.create({
      data: {
        site_id,
        clientName: payload.clientName,
        clientRole: payload.clientRole ?? null,
        companyName: payload.companyName ?? null,
        content: payload.content,
        rating: typeof payload.rating === "number" ? payload.rating : 5,
        avatarUrl: payload.avatarUrl ?? null,
        portfolioId: payload.portfolioId ?? null,
        sortOrder: typeof payload.sortOrder === "number" ? payload.sortOrder : 0,
        status: payload.status || "PUBLISHED",
        lastEditedById: editorId,
      },
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "testimonials");
    return created;
  }

  /**
   * Updates a client testimonial and invalidates the `testimonials` cache.
   */
  async updateTestimonial(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await this.deps.prisma.testimonial.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Testimoni tidak ditemukan.");
    }

    if (payload.portfolioId) {
      const portfolio = await this.deps.prisma.portfolio.findFirst({
        where: { id: payload.portfolioId, site_id },
        select: { id: true },
      });
      if (!portfolio) {
        throw AppError.badRequest(
          "INVALID_PORTFOLIO",
          "Portofolio yang dipilih tidak ditemukan."
        );
      }
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.clientName !== undefined) data.clientName = payload.clientName;
    if (payload.clientRole !== undefined) data.clientRole = payload.clientRole;
    if (payload.companyName !== undefined) data.companyName = payload.companyName;
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.rating !== undefined) data.rating = payload.rating;
    if (payload.avatarUrl !== undefined) data.avatarUrl = payload.avatarUrl;
    if (payload.portfolioId !== undefined) data.portfolioId = payload.portfolioId;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    if (payload.status !== undefined) data.status = payload.status;

    const updated = await this.deps.prisma.testimonial.update({
      where: { id: existing.id },
      data,
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "testimonials");
    return updated;
  }

  /**
   * Archives a client testimonial (`status = 'ARCHIVED'`) and invalidates the `testimonials` cache.
   */
  async archiveTestimonial(id: string, site_id: string, editorId: string) {
    const existing = await this.deps.prisma.testimonial.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Testimoni tidak ditemukan.");
    }

    const updated = await this.deps.prisma.testimonial.update({
      where: { id: existing.id },
      data: {
        status: "ARCHIVED",
        lastEditedById: editorId,
      },
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "testimonials");
    return updated;
  }

  /**
   * Lists the 25 most recent content snapshots for `site_id`, optionally filtered by `entityType` and `entityId`.
   */
  async getSnapshots(query: {
    site_id: string;
    entityType?: string;
    entityId?: string;
  }) {
    const { site_id, entityType, entityId } = query;
    const where: Record<string, unknown> = { site_id };
    if (entityType) where.entityType = entityType.toUpperCase();
    if (entityId) where.entityId = entityId;

    return this.deps.prisma.contentSnapshot.findMany({
      where: where as any,
      take: 25,
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
      include: {
        author: { select: { id: true, fullName: true, jobTitle: true } },
      },
    });
  }

  /**
   * Restores a post, portfolio, service, or static page from a saved `ContentSnapshot`,
   * falling back to the post's current `categoryId` if the snapshot's category was deleted,
   * and logs a `CONTENT_STATUS_CHANGED` activity entry.
   */
  async restoreSnapshot(snapshotId: string, site_id: string, editorId: string) {
    const snapshot = await this.deps.prisma.contentSnapshot.findFirst({
      where: { id: snapshotId, site_id },
    });

    if (!snapshot) {
      throw AppError.notFound("Versi data tidak ditemukan.");
    }

    const data = snapshot.snapshotPayload as any;

    if (snapshot.entityType === "POST") {
      const target = await this.deps.prisma.post.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw AppError.notFound("Artikel asal tidak ditemukan.");
      }

      let resolvedCategoryId = target.categoryId;
      if (data.categoryId) {
        const validCategory = await this.deps.prisma.category.findFirst({
          where: { id: data.categoryId, site_id },
          select: { id: true },
        });
        if (validCategory) {
          resolvedCategoryId = validCategory.id;
        }
      }

      await this.deps.prisma.post.update({
        where: { id: target.id },
        data: {
          title: data.title ?? target.title,
          excerpt: data.excerpt ?? target.excerpt,
          content: data.content ?? target.content,
          coverUrl: data.coverUrl ?? target.coverUrl,
          coverAlt: data.coverAlt ?? target.coverAlt,
          categoryId: resolvedCategoryId,
          tags: Array.isArray(data.tags) ? data.tags : target.tags,
          seoTitle: data.seoTitle ?? target.seoTitle,
          seoDescription: data.seoDescription ?? target.seoDescription,
          lastEditedById: editorId,
        },
      });
      await this.invalidateCmsCache(site_id, "articles");
    } else if (snapshot.entityType === "PORTFOLIO") {
      const target = await this.deps.prisma.portfolio.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw AppError.notFound("Portofolio asal tidak ditemukan.");
      }
      await this.deps.prisma.portfolio.update({
        where: { id: target.id },
        data: {
          title: data.title ?? target.title,
          clientName: data.clientName ?? target.clientName,
          serviceCategory: data.serviceCategory ?? target.serviceCategory,
          summary: data.summary ?? target.summary,
          impactSummary: data.impactSummary ?? target.impactSummary,
          metricResult: data.metricResult ?? target.metricResult,
          content: data.content ?? target.content,
          technologies: Array.isArray(data.technologies) ? data.technologies : target.technologies,
          thumbnailUrl: data.thumbnailUrl ?? target.thumbnailUrl,
          thumbnailAlt: data.thumbnailAlt ?? target.thumbnailAlt,
          projectUrl: data.projectUrl ?? target.projectUrl,
          isFeatured: typeof data.isFeatured === "boolean" ? data.isFeatured : target.isFeatured,
          lastEditedById: editorId,
        },
      });
      await this.invalidateCmsCache(site_id, "portfolios");
    } else if (snapshot.entityType === "SERVICE") {
      const target = await this.deps.prisma.service.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw AppError.notFound("Layanan asal tidak ditemukan.");
      }
      await this.deps.prisma.service.update({
        where: { id: target.id },
        data: {
          title: data.title ?? target.title,
          icon: data.icon ?? target.icon,
          shortDesc: data.shortDesc ?? target.shortDesc,
          features: Array.isArray(data.features) ? data.features : target.features,
          priceLabel: data.priceLabel ?? target.priceLabel,
          priceNote: data.priceNote ?? target.priceNote,
          badge: data.badge ?? target.badge,
          ctaLabel: data.ctaLabel ?? target.ctaLabel,
          ctaHref: data.ctaHref ?? target.ctaHref,
          sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : target.sortOrder,
          lastEditedById: editorId,
        },
      });
      await this.invalidateCmsCache(site_id, "services");
    } else if (snapshot.entityType === "PAGE") {
      const target = await this.deps.prisma.page.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw AppError.notFound("Halaman asal tidak ditemukan.");
      }
      await this.deps.prisma.page.update({
        where: { id: target.id },
        data: {
          title: data.title ?? target.title,
          content: data.content ?? target.content,
          seoTitle: data.seoTitle ?? target.seoTitle,
          seoDescription: data.seoDescription ?? target.seoDescription,
          lastEditedById: editorId,
        },
      });
      await this.invalidateCmsCache(site_id, "pages");
    } else {
      throw AppError.badRequest(
        "UNSUPPORTED_SNAPSHOT_ENTITY",
        "Versi data ini belum bisa dipulihkan."
      );
    }

    await this.deps.prisma.activityLog.create({
      data: {
        site_id,
        actorId: editorId,
        action: "CONTENT_STATUS_CHANGED",
        entityType: snapshot.entityType,
        entityId: snapshot.entityId,
        summary: `Mengembalikan konten "${snapshot.title}" ke versi sebelumnya`,
      },
    });

    return {
      message: "Konten berhasil dikembalikan ke versi sebelumnya.",
      snapshotId: snapshot.id,
      entityType: snapshot.entityType,
      entityId: snapshot.entityId,
      restoredVersion: snapshot.version,
    };
  }

  /**
   * Lists all custom URL redirect rules configured for `site_id`.
   */
  async getRedirects(site_id: string) {
    return this.deps.prisma.redirect.findMany({
      where: { site_id },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Registers a new 301/302 redirect rule after verifying that `sourcePath` and `targetPath`
   * do not form a self-redirect loop.
   */
  async createRedirect(
    site_id: string,
    payload: { sourcePath: string; targetPath: string; statusCode?: number }
  ) {
    if (payload.sourcePath === payload.targetPath) {
      throw AppError.badRequest(
        "REDIRECT_LOOP",
        "Alamat lama dan alamat tujuan tidak boleh sama."
      );
    }

    return this.deps.prisma.redirect.create({
      data: {
        site_id,
        sourcePath: payload.sourcePath,
        targetPath: payload.targetPath,
        statusCode: payload.statusCode || 301,
      },
    });
  }

  /**
   * Deletes a custom redirect rule by `{ id, site_id }`.
   */
  async deleteRedirect(id: string, site_id: string) {
    const existing = await this.deps.prisma.redirect.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw AppError.notFound("Aturan pengalihan alamat tidak ditemukan.");
    }
    await this.deps.prisma.redirect.delete({ where: { id: existing.id } });
    return { message: "Aturan pengalihan alamat berhasil dihapus." };
  }

  /**
   * Retains only the 5 newest snapshots per `{ site_id, entityType, entityId }` (FIFO policy),
   * deleting older versions so the `content_snapshots` table stays bounded.
   */
  private async pruneSnapshots(site_id: string, entityType: string, entityId: string) {
    try {
      const snapshots = await this.deps.prisma.contentSnapshot.findMany({
        where: { site_id, entityType, entityId },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        select: { id: true },
      });

      if (snapshots.length > 5) {
        const toDelete = snapshots.slice(5).map((s) => s.id);
        await this.deps.prisma.contentSnapshot.deleteMany({
          where: { id: { in: toDelete }, site_id },
        });
      }
    } catch (err: any) {
      this.deps.logger.warn("[Snapshot Prune Warning]", {
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
