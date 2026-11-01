import { z } from "zod";

export const createLeadPublicSchema = z.object({
  site_id: z.string().min(1).default("nextkarya-main"),
  clientName: z.string().trim().min(2, "Nama minimal 2 karakter").max(255),
  companyName: z.string().trim().max(255).optional().nullable(),
  whatsappNumber: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid"),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  serviceRequested: z.string().min(1, "Pilih salah satu layanan"),
  message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(2000, "Pesan maksimal 2.000 karakter"),
  website_url: z.string().max(0, "Honeypot trap").optional().or(z.literal("")),
});

export const analyticsEventSchema = z
  .object({
    site_id: z.string().min(1),
    sessionId: z.string().min(10).max(64),
    eventName: z.enum(["pageview", "whatsapp_click", "form_submit", "heartbeat"]),
    path: z.string().min(1).max(255),
    referrer: z.string().max(500).optional().nullable(),
    source: z.string().max(50).default("direct"),
    device: z.enum(["mobile", "desktop", "tablet", "unknown"]).default("unknown"),
    browser: z.string().max(50).optional().nullable(),
    os: z.string().max(50).optional().nullable(),
    durationSec: z.number().int().min(0).max(86400).default(0),
  })
  .refine(
    (data) => {
      if (data.eventName !== "heartbeat" && data.durationSec > 0) {
        return false;
      }
      return true;
    },
    {
      message: "durationSec hanya boleh bernilai > 0 pada event heartbeat",
      path: ["durationSec"],
    }
  );

export const publicQuerySchema = z.object({
  site_id: z.string().default("nextkarya-main"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category: z.string().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
  isFeatured: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
});
