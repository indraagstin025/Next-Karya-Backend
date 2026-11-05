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

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("Alamat email belum benar. Contoh: nama@email.com")
  .max(255, "Alamat email maksimal 255 karakter");

const passwordField = z
  .string()
  .min(12, "Kata sandi minimal 12 karakter")
  .max(128, "Kata sandi maksimal 128 karakter");

export const createStaffUserSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Nama lengkap minimal 2 karakter")
      .max(120, "Nama lengkap maksimal 120 karakter"),
    email: emailField,
    jobTitle: z
      .string()
      .trim()
      .min(2, "Jabatan minimal 2 karakter")
      .max(120, "Jabatan maksimal 120 karakter"),
    password: passwordField,
  })
  .strict();

export const updateStaffUserSchema = z
  .object({
    fullName: z
      .string()
      .trim()
      .min(2, "Nama lengkap minimal 2 karakter")
      .max(120, "Nama lengkap maksimal 120 karakter")
      .optional(),
    jobTitle: z
      .string()
      .trim()
      .min(2, "Jabatan minimal 2 karakter")
      .max(120, "Jabatan maksimal 120 karakter")
      .optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Isi minimal satu data yang ingin diperbarui.",
  });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Kata sandi saat ini wajib diisi")
      .max(128, "Kata sandi maksimal 128 karakter"),
    newPassword: passwordField,
  })
  .strict()
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
    path: ["newPassword"],
  });
