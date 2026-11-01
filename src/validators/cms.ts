import { z } from "zod";

const siteIdField = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Format site_id tidak valid")
  .default("nextkarya-main");

const slugField = z
  .string()
  .trim()
  .min(2, "Slug minimal 2 karakter")
  .max(255, "Slug maksimal 255 karakter")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug hanya boleh huruf kecil, angka, dan tanda hubung (-)");

const safeUrlOrPathField = z
  .union([
    z
      .string()
      .trim()
      .max(500)
      .refine(
        (val) =>
          val === "" ||
          /^\/[a-zA-Z0-9/_.-]+$/.test(val) ||
          /^https?:\/\/[^\s"'<>]+$/i.test(val),
        "URL atau path aset harus diawali / atau http(s):// yang aman"
      ),
    z.null(),
  ])
  .optional()
  .transform((val) => (val === "" ? null : val ?? null));

const safeHrefField = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .refine(
    (val) =>
      val.startsWith("#") ||
      (val.startsWith("/") && !val.startsWith("//")) ||
      /^https?:\/\/[^\s"'<>]+$/i.test(val),
    "Tautan CTA harus berupa anchor (#), path internal (/), atau URL http(s) yang aman"
  );

// Categories
export const createCategorySchema = z
  .object({
    site_id: siteIdField,
    name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(100),
    slug: slugField,
  })
  .strict();

export const updateCategorySchema = createCategorySchema.partial().strict();

// Posts (Articles)
export const createPostSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul minimal 3 karakter").max(255),
    slug: slugField,
    excerpt: z.string().trim().min(10, "Ringkasan minimal 10 karakter").max(1000),
    content: z.any().default([]),
    coverUrl: safeUrlOrPathField,
    coverAlt: z.string().trim().max(255).optional().nullable(),
    categoryId: z.string().trim().min(1, "Kategori wajib dipilih").max(64),
    tags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
    readingTimeMinutes: z.number().int().min(1).max(120).optional(),
    relatedPostIds: z.array(z.string().trim().max(64)).max(10).default([]),
    seoTitle: z.string().trim().max(255).optional().nullable(),
    seoDescription: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const updatePostSchema = createPostSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "updatedAt wajib disertakan untuk optimistic locking"),
  })
  .strict();

// Portfolios
export const createPortfolioSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul portofolio minimal 3 karakter").max(255),
    slug: slugField,
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255),
    serviceCategory: z.string().trim().min(2, "Kategori solusi wajib diisi").max(100),
    summary: z.string().trim().min(10, "Ringkasan minimal 10 karakter").max(1000),
    impactSummary: z.string().trim().max(1000).optional().nullable(),
    metricResult: z.string().trim().max(100).optional().nullable(),
    content: z.any().default({ description: "" }),
    technologies: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
    thumbnailUrl: safeUrlOrPathField,
    thumbnailAlt: z.string().trim().max(255).optional().nullable(),
    projectUrl: safeUrlOrPathField,
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updatePortfolioSchema = createPortfolioSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "updatedAt wajib disertakan untuk optimistic locking"),
  })
  .strict();

// Services & Pricing
export const createServiceSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul layanan minimal 3 karakter").max(255),
    slug: slugField,
    icon: z.string().trim().min(1, "Ikon layanan wajib diisi").max(100).default("Globe"),
    shortDesc: z.string().trim().min(10, "Deskripsi singkat minimal 10 karakter").max(1000),
    features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    priceLabel: z.string().trim().min(1, "Label harga wajib diisi").max(100),
    priceNote: z.string().trim().max(255).optional().nullable(),
    badge: z.string().trim().max(100).optional().nullable(),
    ctaLabel: z.string().trim().min(1).max(100).default("Konsultasi Sekarang"),
    ctaHref: safeHrefField.default("#konsultasi"),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "updatedAt wajib disertakan untuk optimistic locking"),
  })
  .strict();

// Static Pages
export const createPageSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul halaman minimal 3 karakter").max(255),
    slug: slugField,
    content: z.any().default([]),
    seoTitle: z.string().trim().max(255).optional().nullable(),
    seoDescription: z.string().trim().max(500).optional().nullable(),
  })
  .strict();

export const updatePageSchema = createPageSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "updatedAt wajib disertakan untuk optimistic locking"),
  })
  .strict();

// FAQs
export const createFaqSchema = z
  .object({
    site_id: siteIdField,
    question: z.string().trim().min(5, "Pertanyaan minimal 5 karakter").max(500),
    answer: z.string().trim().min(5, "Jawaban minimal 5 karakter").max(5000),
    category: z.string().trim().min(2).max(100).default("Umum"),
    sortOrder: z.number().int().min(0).max(9999).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateFaqSchema = createFaqSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "updatedAt wajib disertakan untuk optimistic locking"),
  })
  .strict();

// Testimonials
export const createTestimonialSchema = z
  .object({
    site_id: siteIdField,
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255),
    clientRole: z.string().trim().max(150).optional().nullable(),
    companyName: z.string().trim().max(255).optional().nullable(),
    content: z.string().trim().min(5, "Isi testimoni minimal 5 karakter").max(2000),
    rating: z.number().int().min(1).max(5).default(5),
    avatarUrl: safeUrlOrPathField,
    portfolioId: z.string().trim().max(64).optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).default("PUBLISHED"),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updateTestimonialSchema = createTestimonialSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "updatedAt wajib disertakan untuk optimistic locking"),
  })
  .strict();

// Redirects (Phase 1 manual 301 redirects)
export const createRedirectSchema = z
  .object({
    site_id: siteIdField,
    sourcePath: z
      .string()
      .trim()
      .min(2)
      .max(255)
      .regex(/^\/[a-zA-Z0-9/_-]+$/, "Path asal harus diawali dengan /"),
    targetPath: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine(
        (val) =>
          (val.startsWith("/") && !val.startsWith("//")) ||
          /^https?:\/\/[^\s"'<>]+$/i.test(val),
        "Path tujuan harus diawali / atau URL http(s) yang valid"
      ),
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
  })
  .refine((data) => data.sourcePath !== data.targetPath, {
    message: "Path asal dan path tujuan tidak boleh sama",
    path: ["targetPath"],
  });

export const mutationLockBodySchema = z
  .object({
    site_id: siteIdField.optional(),
    updatedAt: z.string().trim().min(1).optional(),
  })
  .passthrough();
