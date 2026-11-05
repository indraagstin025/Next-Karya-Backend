import { z } from "zod";
import "./locale";

export const unpublishContentSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    targetEntity: z.enum(["POST", "PORTFOLIO", "SERVICE", "PAGE"]),
    targetId: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, "Data yang dipilih tidak dikenal"),
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
  })
  .strict();

export const lockFormSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
  })
  .strict();

export const unlockFormSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
  })
  .strict();

export const alertBannerSchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    isActive: z.boolean(),
    alertBanner: z.string().trim().max(300, "Teks pengumuman maksimal 300 karakter").optional().nullable(),
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
  })
  .strict()
  .refine((data) => !data.isActive || Boolean(data.alertBanner && data.alertBanner.trim().length >= 5), {
    message: "Isi teks pengumuman minimal 5 karakter saat pengumuman diaktifkan",
    path: ["alertBanner"],
  });

export const reassignLeadEmergencySchema = z
  .object({
    site_id: z.string().trim().min(1).max(64).default("nextkarya-main"),
    newAssignedToId: z
      .string()
      .trim()
      .min(1, "Pilih staf pengganti")
      .max(64)
      .regex(/^[a-zA-Z0-9_-]+$/, "Data staf yang dipilih tidak dikenal"),
    reason: z.string().trim().min(5, "Alasan minimal 5 karakter").max(500, "Alasan maksimal 500 karakter"),
  })
  .strict();
