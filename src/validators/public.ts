import { z } from "zod";
import "./locale";

const siteIdField = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Kode situs tidak valid")
  .default("nextkarya-main");

export const createLeadPublicSchema = z
  .object({
    site_id: siteIdField,
    clientName: z.string().trim().min(2, "Nama minimal 2 karakter").max(255, "Nama maksimal 255 karakter"),
    companyName: z.string().trim().max(255, "Nama perusahaan maksimal 255 karakter").optional().nullable(),
    whatsappNumber: z
      .string()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor WhatsApp belum benar. Contoh: 081234567890"),
    email: z.string().email("Alamat email belum benar. Contoh: nama@email.com").optional().nullable(),
    serviceRequested: z.string().trim().min(1, "Pilih salah satu layanan").max(255, "Layanan maksimal 255 karakter"),
    message: z
      .string()
      .trim()
      .min(5, "Pesan minimal 5 karakter")
      .max(2000, "Pesan maksimal 2.000 karakter"),
    website_url: z.string().max(100, "Kolom ini tidak boleh diisi").optional().or(z.literal("")),
  })
  .strict();

export const analyticsEventSchema = z
  .object({
    site_id: siteIdField,
    sessionId: z
      .string()
      .trim()
      .min(10)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, "Data kunjungan tidak valid"),
    eventName: z.enum(["pageview", "whatsapp_click", "form_submit", "heartbeat"]),
    path: z
      .string()
      .trim()
      .min(1, "Alamat halaman wajib diisi")
      .max(255, "Alamat halaman maksimal 255 karakter")
      .refine((p) => p.startsWith("/") && !p.includes(".."), "Alamat halaman tidak valid"),
    referrer: z.string().trim().max(500).optional().nullable(),
    source: z.string().trim().max(50).default("direct"),
    device: z.enum(["mobile", "desktop", "tablet", "unknown"]).default("unknown"),
    browser: z.string().trim().max(50).optional().nullable(),
    os: z.string().trim().max(50).optional().nullable(),
    durationSec: z.number().int().min(0).max(86400).default(0),
  })
  .strict()
  .refine(
    (data) => {
      if (data.eventName !== "heartbeat" && data.durationSec > 0) {
        return false;
      }
      return true;
    },
    {
      message: "Durasi kunjungan hanya boleh diisi untuk pembaruan kunjungan",
      path: ["durationSec"],
    }
  );

export const publicQuerySchema = z.object({
  site_id: siteIdField,
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().trim().max(100).optional(),
  tag: z.string().trim().max(100).optional(),
  search: z.string().trim().max(200).optional(),
  sortBy: z.string().trim().max(50).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  isFeatured: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
});
