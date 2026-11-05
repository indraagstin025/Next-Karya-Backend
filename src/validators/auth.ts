import { z } from "zod";
import "./locale";

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Alamat email belum benar. Contoh: nama@email.com").max(255, "Alamat email maksimal 255 karakter"),
    password: z.string().min(6, "Kata sandi minimal 6 karakter").max(128, "Kata sandi maksimal 128 karakter"),
  })
  .strict();

export const revokeSessionsSchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(5, "Alasan minimal 5 karakter")
      .max(500, "Alasan maksimal 500 karakter")
      .default("Pencabutan darurat sesi HP hilang/tertinggal"),
  })
  .strict();
