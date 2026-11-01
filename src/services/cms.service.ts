import { prisma } from "../config/prisma";
import { cache } from "../config/redis";
import { triggerRevalidationWebhook } from "../utils/webhook";
import { PaginationMeta } from "../utils/response";

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

export class CmsService {
  private async invalidateCmsCache(site_id: string, tag: string) {
    await Promise.allSettled([
      cache.del(`cache:cms:${site_id}:${tag}`),
      cache.del(`cache:cms:${site_id}:pricing`),
    ]);
    triggerRevalidationWebhook(tag).catch(console.error);
  }

  private async nextSnapshotVersion(site_id: string, entityType: string, entityId: string): Promise<number> {
    const latest = await prisma.contentSnapshot.findFirst({
      where: { site_id, entityType, entityId },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  // Categories
  async getCategories(site_id: string) {
    return prisma.category.findMany({
      where: { site_id },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { posts: true },
        },
      },
    });
  }

  async createCategory(site_id: string, payload: { name: string; slug: string }) {
    return prisma.category.create({
      data: {
        site_id,
        name: payload.name,
        slug: payload.slug,
      },
    });
  }

  async updateCategory(id: string, site_id: string, payload: { name?: string; slug?: string }) {
    const existing = await prisma.category.findFirst({
      where: { id, site_id },
    });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Kategori tidak ditemukan." };
    }

    return prisma.category.update({
      where: { id: existing.id },
      data: {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.slug !== undefined ? { slug: payload.slug } : {}),
      },
    });
  }

  async deleteCategory(id: string, site_id: string) {
    const existing = await prisma.category.findFirst({
      where: { id, site_id },
      include: { _count: { select: { posts: true } } },
    });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Kategori tidak ditemukan." };
    }
    if (existing._count.posts > 0) {
      throw {
        statusCode: 400,
        code: "CATEGORY_IN_USE",
        message: `Kategori "${existing.name}" masih digunakan oleh ${existing._count.posts} artikel dan tidak dapat dihapus.`,
      };
    }

    await prisma.category.delete({ where: { id: existing.id } });
    return { message: "Kategori berhasil dihapus." };
  }

  // Posts (Articles)
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

    const where: any = { site_id };
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
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
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

  async getPostById(id: string, site_id: string) {
    return prisma.post.findFirst({
      where: { id, site_id },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        author: { select: { id: true, fullName: true, email: true, jobTitle: true } },
        lastEditor: { select: { id: true, fullName: true, jobTitle: true } },
      },
    });
  }

  async createPost(site_id: string, payload: any, authorId: string) {
    const category = await prisma.category.findFirst({
      where: { id: payload.categoryId, site_id },
      select: { id: true },
    });
    if (!category) {
      throw {
        statusCode: 400,
        code: "INVALID_CATEGORY",
        message: "Kategori yang dipilih tidak ditemukan pada situs ini.",
      };
    }

    const readingTimeMinutes =
      payload.readingTimeMinutes ?? estimateReadingTimeMinutes(payload.content);

    return prisma.post.create({
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

  async updatePost(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await prisma.post.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Artikel tidak ditemukan." };
    }

    if (payload.categoryId !== undefined) {
      const category = await prisma.category.findFirst({
        where: { id: payload.categoryId, site_id },
        select: { id: true },
      });
      if (!category) {
        throw {
          statusCode: 400,
          code: "INVALID_CATEGORY",
          message: "Kategori yang dipilih tidak valid untuk situs ini.",
        };
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

    const updated = await prisma.post.update({
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

  async publishPost(id: string, site_id: string, editorId: string) {
    const post = await prisma.post.findFirst({ where: { id, site_id } });
    if (!post) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Artikel tidak ditemukan." };
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "POST", post.id);

    const [, updatedPost] = await prisma.$transaction([
      prisma.contentSnapshot.create({
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
      prisma.post.update({
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
      prisma.activityLog.create({
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

  async archivePost(id: string, site_id: string, editorId: string) {
    const existing = await prisma.post.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Artikel tidak ditemukan." };
    }

    const [post] = await prisma.$transaction([
      prisma.post.update({
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
      prisma.activityLog.create({
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

  // Portfolios
  async getPortfolios(query: {
    site_id: string;
    status?: "DRAFT" | "PUBLISHED" | "ARCHIVED";
    page: number;
    limit: number;
    search?: string;
  }) {
    const { site_id, status, page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { site_id };
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
      prisma.portfolio.count({ where }),
      prisma.portfolio.findMany({
        where,
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

  async getPortfolioById(id: string, site_id: string) {
    return prisma.portfolio.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async createPortfolio(site_id: string, payload: any, editorId: string) {
    return prisma.portfolio.create({
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

  async updatePortfolio(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await prisma.portfolio.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Portofolio tidak ditemukan." };
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

    const updated = await prisma.portfolio.update({
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

  async publishPortfolio(id: string, site_id: string, editorId: string) {
    const portfolio = await prisma.portfolio.findFirst({ where: { id, site_id } });
    if (!portfolio) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Portofolio tidak ditemukan." };
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "PORTFOLIO", portfolio.id);

    const [, updated] = await prisma.$transaction([
      prisma.contentSnapshot.create({
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
      prisma.portfolio.update({
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
      prisma.activityLog.create({
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

  async archivePortfolio(id: string, site_id: string, editorId: string) {
    const existing = await prisma.portfolio.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Portofolio tidak ditemukan." };
    }

    const [portfolio] = await prisma.$transaction([
      prisma.portfolio.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      prisma.activityLog.create({
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

  // Services & Pricing
  async getServices(site_id: string, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const where: any = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    return prisma.service.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { updatedAt: "desc" }],
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async getServiceById(id: string, site_id: string) {
    return prisma.service.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async createService(site_id: string, payload: any, editorId: string) {
    return prisma.service.create({
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

  async updateService(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await prisma.service.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Layanan tidak ditemukan." };
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

    const updated = await prisma.service.update({
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

  async publishService(id: string, site_id: string, editorId: string) {
    const service = await prisma.service.findFirst({ where: { id, site_id } });
    if (!service) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Layanan tidak ditemukan." };
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "SERVICE", service.id);

    const [, updated] = await prisma.$transaction([
      prisma.contentSnapshot.create({
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
      prisma.service.update({
        where: { id: service.id },
        data: {
          status: "PUBLISHED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      prisma.activityLog.create({
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

  async archiveService(id: string, site_id: string, editorId: string) {
    const existing = await prisma.service.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Layanan tidak ditemukan." };
    }

    const [service] = await prisma.$transaction([
      prisma.service.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      prisma.activityLog.create({
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

  // Pages
  async getPages(site_id: string, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const where: any = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    return prisma.page.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async getPageById(id: string, site_id: string) {
    return prisma.page.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async createPage(site_id: string, payload: any, editorId: string) {
    return prisma.page.create({
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

  async updatePage(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await prisma.page.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Halaman tidak ditemukan." };
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.title !== undefined) data.title = payload.title;
    if (payload.slug !== undefined) data.slug = payload.slug;
    if (payload.content !== undefined) data.content = payload.content;
    if (payload.seoTitle !== undefined) data.seoTitle = payload.seoTitle;
    if (payload.seoDescription !== undefined) data.seoDescription = payload.seoDescription;

    const updated = await prisma.page.update({
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

  async publishPage(id: string, site_id: string, editorId: string) {
    const page = await prisma.page.findFirst({ where: { id, site_id } });
    if (!page) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Halaman tidak ditemukan." };
    }

    const nextVersion = await this.nextSnapshotVersion(site_id, "PAGE", page.id);

    const [, updated] = await prisma.$transaction([
      prisma.contentSnapshot.create({
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
      prisma.page.update({
        where: { id: page.id },
        data: {
          status: "PUBLISHED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      prisma.activityLog.create({
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

  async archivePage(id: string, site_id: string, editorId: string) {
    const existing = await prisma.page.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Halaman tidak ditemukan." };
    }

    const [page] = await prisma.$transaction([
      prisma.page.update({
        where: { id: existing.id },
        data: {
          status: "ARCHIVED",
          lastEditedById: editorId,
        },
        include: {
          lastEditor: { select: { id: true, fullName: true } },
        },
      }),
      prisma.activityLog.create({
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

  // FAQs (Boolean isActive toggle without publish/archive)
  async getFaqs(site_id: string) {
    return prisma.faq.findMany({
      where: { site_id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async getFaqById(id: string, site_id: string) {
    return prisma.faq.findFirst({
      where: { id, site_id },
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async createFaq(site_id: string, payload: any, editorId: string) {
    const created = await prisma.faq.create({
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

  async updateFaq(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await prisma.faq.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "FAQ tidak ditemukan." };
    }

    const data: Record<string, any> = {
      lastEditedById: editorId,
    };

    if (payload.question !== undefined) data.question = payload.question;
    if (payload.answer !== undefined) data.answer = payload.answer;
    if (payload.category !== undefined) data.category = payload.category;
    if (payload.sortOrder !== undefined) data.sortOrder = payload.sortOrder;
    if (payload.isActive !== undefined) data.isActive = Boolean(payload.isActive);

    const updated = await prisma.faq.update({
      where: { id: existing.id },
      data,
      include: {
        lastEditor: { select: { id: true, fullName: true } },
      },
    });

    await this.invalidateCmsCache(site_id, "faqs");
    return updated;
  }

  async deleteFaq(id: string, site_id: string, editorId: string) {
    const existing = await prisma.faq.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "FAQ tidak ditemukan." };
    }

    const updated = await prisma.faq.update({
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

  // Testimonials
  async getTestimonials(site_id: string, status?: "DRAFT" | "PUBLISHED" | "ARCHIVED") {
    const where: any = { site_id };
    if (status && ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(status)) {
      where.status = status;
    }
    return prisma.testimonial.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async getTestimonialById(id: string, site_id: string) {
    return prisma.testimonial.findFirst({
      where: { id, site_id },
      include: {
        portfolio: { select: { id: true, title: true, slug: true } },
        lastEditor: { select: { id: true, fullName: true } },
      },
    });
  }

  async createTestimonial(site_id: string, payload: any, editorId: string) {
    if (payload.portfolioId) {
      const portfolio = await prisma.portfolio.findFirst({
        where: { id: payload.portfolioId, site_id },
        select: { id: true },
      });
      if (!portfolio) {
        throw {
          statusCode: 400,
          code: "INVALID_PORTFOLIO",
          message: "Portofolio referensi tidak ditemukan pada situs ini.",
        };
      }
    }

    const created = await prisma.testimonial.create({
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

  async updateTestimonial(id: string, site_id: string, payload: any, editorId: string) {
    const existing = await prisma.testimonial.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Testimoni tidak ditemukan." };
    }

    if (payload.portfolioId) {
      const portfolio = await prisma.portfolio.findFirst({
        where: { id: payload.portfolioId, site_id },
        select: { id: true },
      });
      if (!portfolio) {
        throw {
          statusCode: 400,
          code: "INVALID_PORTFOLIO",
          message: "Portofolio referensi tidak ditemukan pada situs ini.",
        };
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

    const updated = await prisma.testimonial.update({
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

  async archiveTestimonial(id: string, site_id: string, editorId: string) {
    const existing = await prisma.testimonial.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Testimoni tidak ditemukan." };
    }

    const updated = await prisma.testimonial.update({
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

  // Content Snapshots (FIFO 5 Versions)
  async getSnapshots(query: {
    site_id: string;
    entityType?: string;
    entityId?: string;
  }) {
    const { site_id, entityType, entityId } = query;
    const where: any = { site_id };
    if (entityType) where.entityType = entityType.toUpperCase();
    if (entityId) where.entityId = entityId;

    return prisma.contentSnapshot.findMany({
      where,
      take: 25,
      orderBy: [{ createdAt: "desc" }, { version: "desc" }],
      include: {
        author: { select: { id: true, fullName: true, jobTitle: true } },
      },
    });
  }

  async restoreSnapshot(snapshotId: string, site_id: string, editorId: string) {
    const snapshot = await prisma.contentSnapshot.findFirst({
      where: { id: snapshotId, site_id },
    });

    if (!snapshot) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Snapshot tidak ditemukan." };
    }

    const data = snapshot.snapshotPayload as any;

    if (snapshot.entityType === "POST") {
      const target = await prisma.post.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "Artikel induk tidak ditemukan." };
      }
      await prisma.post.update({
        where: { id: target.id },
        data: {
          title: data.title ?? target.title,
          excerpt: data.excerpt ?? target.excerpt,
          content: data.content ?? target.content,
          coverUrl: data.coverUrl ?? target.coverUrl,
          coverAlt: data.coverAlt ?? target.coverAlt,
          categoryId: data.categoryId ?? target.categoryId,
          tags: Array.isArray(data.tags) ? data.tags : target.tags,
          seoTitle: data.seoTitle ?? target.seoTitle,
          seoDescription: data.seoDescription ?? target.seoDescription,
          lastEditedById: editorId,
        },
      });
      await this.invalidateCmsCache(site_id, "articles");
    } else if (snapshot.entityType === "PORTFOLIO") {
      const target = await prisma.portfolio.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "Portofolio induk tidak ditemukan." };
      }
      await prisma.portfolio.update({
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
      const target = await prisma.service.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "Layanan induk tidak ditemukan." };
      }
      await prisma.service.update({
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
      const target = await prisma.page.findFirst({
        where: { id: snapshot.entityId, site_id },
      });
      if (!target) {
        throw { statusCode: 404, code: "NOT_FOUND", message: "Halaman induk tidak ditemukan." };
      }
      await prisma.page.update({
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
      throw {
        statusCode: 400,
        code: "UNSUPPORTED_SNAPSHOT_ENTITY",
        message: "Tipe entitas snapshot tidak didukung.",
      };
    }

    await prisma.activityLog.create({
      data: {
        site_id,
        actorId: editorId,
        action: "CONTENT_STATUS_CHANGED",
        entityType: snapshot.entityType,
        entityId: snapshot.entityId,
        summary: `Memulihkan konten "${snapshot.title}" dari snapshot versi #${snapshot.version}`,
      },
    });

    return {
      message: "Konten berhasil dipulihkan dari snapshot.",
      snapshotId: snapshot.id,
      entityType: snapshot.entityType,
      entityId: snapshot.entityId,
      restoredVersion: snapshot.version,
    };
  }

  // Redirects
  async getRedirects(site_id: string) {
    return prisma.redirect.findMany({
      where: { site_id },
      orderBy: { createdAt: "desc" },
    });
  }

  async createRedirect(
    site_id: string,
    payload: { sourcePath: string; targetPath: string; statusCode?: number }
  ) {
    return prisma.redirect.create({
      data: {
        site_id,
        sourcePath: payload.sourcePath,
        targetPath: payload.targetPath,
        statusCode: payload.statusCode || 301,
      },
    });
  }

  async deleteRedirect(id: string, site_id: string) {
    const existing = await prisma.redirect.findFirst({ where: { id, site_id } });
    if (!existing) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Aturan redirect tidak ditemukan." };
    }
    await prisma.redirect.delete({ where: { id: existing.id } });
    return { message: "Aturan redirect berhasil dihapus." };
  }

  private async pruneSnapshots(site_id: string, entityType: string, entityId: string) {
    try {
      const snapshots = await prisma.contentSnapshot.findMany({
        where: { site_id, entityType, entityId },
        orderBy: [{ createdAt: "desc" }, { version: "desc" }],
        select: { id: true },
      });

      if (snapshots.length > 5) {
        const toDelete = snapshots.slice(5).map((s) => s.id);
        await prisma.contentSnapshot.deleteMany({
          where: { id: { in: toDelete }, site_id },
        });
      }
    } catch (err: any) {
      console.warn("[Snapshot Prune Warning]", err.message);
    }
  }
}
