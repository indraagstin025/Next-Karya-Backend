import { z } from "zod";
import "./locale";

const siteIdField = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Kode situs tidak valid")
  .default("nextkarya-main");

const slugField = z
  .string()
  .trim()
  .min(2, "Alamat tautan minimal 2 karakter")
  .max(255, "Alamat tautan maksimal 255 karakter")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Alamat tautan hanya boleh berisi huruf kecil, angka, dan tanda hubung (-)"
  );

const safeUrlOrPathField = z
  .union([
    z
      .string()
      .trim()
      .max(500)
      .refine(
        (val) =>
          val === "" ||
          (/^\/[a-zA-Z0-9/_.-]+$/.test(val) && !val.includes("..")) ||
          /^https?:\/\/[^\s"'<>]+$/i.test(val),
        "Alamat gambar atau berkas harus diawali / atau http:// atau https://"
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
      (val.startsWith("/") && !val.startsWith("//") && !val.includes("..")) ||
      /^https?:\/\/[^\s"'<>]+$/i.test(val),
    "Tautan tombol harus berupa #bagian, alamat internal (/...), atau alamat lengkap http(s)"
  );

const safeJsonContentField = z
  .unknown()
  .refine(
    (val) => {
      if (val === undefined || val === null) return true;
      try {
        const serialized = JSON.stringify(val);
        if (serialized.length > 500_000) return false;
        const lower = serialized.toLowerCase();
        return !lower.includes("<script") && !lower.includes("javascript:");
      } catch {
        return false;
      }
    },
    "Isi konten terlalu besar (maksimal 500 KB) atau memuat kode yang tidak diizinkan"
  );

// Categories
export const createCategorySchema = z
  .object({
    site_id: siteIdField,
    name: z.string().trim().min(2, "Nama kategori minimal 2 karakter").max(100, "Nama kategori maksimal 100 karakter"),
    slug: slugField,
  })
  .strict();

export const updateCategorySchema = createCategorySchema.partial().strict();

// Posts (Articles)
export const createPostSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul minimal 3 karakter").max(255, "Judul maksimal 255 karakter"),
    slug: slugField,
    excerpt: z.string().trim().min(10, "Ringkasan minimal 10 karakter").max(1000, "Ringkasan maksimal 1.000 karakter"),
    content: safeJsonContentField.default([]),
    coverUrl: safeUrlOrPathField,
    coverAlt: z.string().trim().max(255, "Teks keterangan gambar maksimal 255 karakter").optional().nullable(),
    categoryId: z.string().trim().min(1, "Pilih kategori artikel").max(64),
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
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

// Portfolios
export const createPortfolioSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul portofolio minimal 3 karakter").max(255, "Judul portofolio maksimal 255 karakter"),
    slug: slugField,
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255, "Nama klien maksimal 255 karakter"),
    serviceCategory: z.string().trim().min(2, "Kategori solusi wajib diisi").max(100, "Kategori solusi maksimal 100 karakter"),
    summary: z.string().trim().min(10, "Ringkasan minimal 10 karakter").max(1000, "Ringkasan maksimal 1.000 karakter"),
    impactSummary: z.string().trim().max(1000, "Ringkasan dampak maksimal 1.000 karakter").optional().nullable(),
    metricResult: z.string().trim().max(100, "Hasil pengukuran maksimal 100 karakter").optional().nullable(),
    content: safeJsonContentField.default({ description: "" }),
    technologies: z.array(z.string().trim().min(1).max(60)).max(25).default([]),
    thumbnailUrl: safeUrlOrPathField,
    thumbnailAlt: z.string().trim().max(255, "Teks keterangan gambar maksimal 255 karakter").optional().nullable(),
    projectUrl: safeUrlOrPathField,
    isFeatured: z.boolean().default(false),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updatePortfolioSchema = createPortfolioSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

// Services & Pricing
export const createServiceSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul layanan minimal 3 karakter").max(255, "Judul layanan maksimal 255 karakter"),
    slug: slugField,
    icon: z.string().trim().min(1, "Ikon layanan wajib diisi").max(100, "Nama ikon maksimal 100 karakter").default("Globe"),
    shortDesc: z.string().trim().min(10, "Deskripsi singkat minimal 10 karakter").max(1000, "Deskripsi singkat maksimal 1.000 karakter"),
    features: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    badge: z.string().trim().max(100, "Label badge maksimal 100 karakter").optional().nullable(),
    ctaLabel: z.string().trim().min(1, "Teks tombol wajib diisi").max(100, "Teks tombol maksimal 100 karakter").default("Konsultasi Sekarang"),
    ctaHref: safeHrefField.default("#konsultasi"),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updateServiceSchema = createServiceSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

// Static Pages
export const createPageSchema = z
  .object({
    site_id: siteIdField,
    title: z.string().trim().min(3, "Judul halaman minimal 3 karakter").max(255, "Judul halaman maksimal 255 karakter"),
    slug: slugField,
    content: safeJsonContentField.default([]),
    seoTitle: z.string().trim().max(255, "Judul SEO maksimal 255 karakter").optional().nullable(),
    seoDescription: z.string().trim().max(500, "Deskripsi SEO maksimal 500 karakter").optional().nullable(),
  })
  .strict();

export const updatePageSchema = createPageSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

// FAQs
export const createFaqSchema = z
  .object({
    site_id: siteIdField,
    question: z.string().trim().min(5, "Pertanyaan minimal 5 karakter").max(500, "Pertanyaan maksimal 500 karakter"),
    answer: z.string().trim().min(5, "Jawaban minimal 5 karakter").max(5000, "Jawaban maksimal 5.000 karakter"),
    category: z.string().trim().min(2, "Kategori minimal 2 karakter").max(100, "Kategori maksimal 100 karakter").default("Umum"),
    sortOrder: z.number().int().min(0).max(9999).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const updateFaqSchema = createFaqSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

// Testimonials
export const createTestimonialSchema = z
  .object({
    site_id: siteIdField,
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255, "Nama klien maksimal 255 karakter"),
    clientRole: z.string().trim().max(150, "Jabatan klien maksimal 150 karakter").optional().nullable(),
    companyName: z.string().trim().max(255, "Nama perusahaan maksimal 255 karakter").optional().nullable(),
    content: z.string().trim().min(5, "Isi testimoni minimal 5 karakter").max(2000, "Isi testimoni maksimal 2.000 karakter"),
    rating: z.number().int().min(1, "Penilaian minimal 1 bintang").max(5, "Penilaian maksimal 5 bintang").default(5),
    avatarUrl: safeUrlOrPathField,
    portfolioId: z.string().trim().max(64).optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"], {
      errorMap: () => ({ message: "Status testimoni tidak tersedia. Pilih Draf, Terbit, atau Arsip." }),
    }).default("PUBLISHED"),
    sortOrder: z.number().int().min(0).max(9999).default(0),
  })
  .strict();

export const updateTestimonialSchema = createTestimonialSchema
  .partial()
  .extend({
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

// Redirects (Phase 1 manual 301 redirects)
export const createRedirectSchema = z
  .object({
    site_id: siteIdField,
    sourcePath: z
      .string()
      .trim()
      .min(2, "Alamat lama minimal 2 karakter")
      .max(255, "Alamat lama maksimal 255 karakter")
      .regex(/^\/[a-zA-Z0-9/_-]+$/, "Alamat lama harus diawali dengan /"),
    targetPath: z
      .string()
      .trim()
      .min(1, "Alamat tujuan wajib diisi")
      .max(255, "Alamat tujuan maksimal 255 karakter")
      .refine(
        (val) =>
          (val.startsWith("/") && !val.startsWith("//") && !val.includes("..")) ||
          /^https?:\/\/[^\s"'<>]+$/i.test(val),
        "Alamat tujuan harus diawali / atau berupa alamat http(s) lengkap"
      ),
    statusCode: z.union([z.literal(301), z.literal(302), z.literal(307), z.literal(308)]).default(301),
  })
  .strict()
  .refine((data) => data.sourcePath !== data.targetPath, {
    message: "Alamat lama dan alamat tujuan tidak boleh sama",
    path: ["targetPath"],
  });

export const mutationLockBodySchema = z
  .object({
    site_id: siteIdField.optional(),
    updatedAt: z.string().trim().min(1).optional(),
  })
  .strict();
