import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Format email tidak valid").max(255),
    password: z.string().min(6, "Password minimal 6 karakter").max(128),
  })
  .strict();

export const revokeSessionsSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, "Alasan pencabutan sesi minimal 5 karakter")
      .max(500, "Alasan maksimal 500 karakter")
      .default("Pencabutan darurat sesi HP hilang/tertinggal"),
  })
  .strict();
