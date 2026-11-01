import { z } from "zod";

export const unpublishContentSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    targetEntity: z.enum(["POST", "PORTFOLIO", "SERVICE", "PAGE"]),
    targetId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, "Format ID entitas tidak valid"),
    reason: z.string().trim().min(5, "Alasan tindakan darurat minimal 5 karakter").max(500),
  })
  .strict();

export const lockFormSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    reason: z.string().trim().min(5, "Alasan tindakan darurat minimal 5 karakter").max(500),
  })
  .strict();

export const unlockFormSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    reason: z.string().trim().min(5, "Alasan tindakan darurat minimal 5 karakter").max(500),
  })
  .strict();

export const alertBannerSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    isActive: z.boolean(),
    alertBanner: z.string().trim().max(300, "Teks banner maksimal 300 karakter").optional().nullable(),
    reason: z.string().trim().min(5, "Alasan tindakan darurat minimal 5 karakter").max(500),
  })
  .strict()
  .refine((data) => !data.isActive || Boolean(data.alertBanner && data.alertBanner.trim().length >= 5), {
    message: "Teks pengumuman banner wajib diisi minimal 5 karakter saat banner diaktifkan.",
    path: ["alertBanner"],
  });

export const reassignLeadEmergencySchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    newAssignedToId: z
      .string()
      .trim()
      .min(1, "ID staf pengganti wajib ditentukan")
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/),
    reason: z.string().trim().min(5, "Alasan tindakan darurat minimal 5 karakter").max(500),
  })
  .strict();
