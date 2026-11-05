import { z } from "zod";
import { MEDIA_MIME_EXTENSIONS, PDF_MAX_BYTES } from "../config/media";
import "./locale";

const mimeTypeField = z
  .string()
  .trim()
  .refine((value) => Object.prototype.hasOwnProperty.call(MEDIA_MIME_EXTENSIONS, value), {
    message: "Jenis berkas ini tidak didukung. Gunakan WebP, PNG, JPEG, SVG, atau PDF.",
  });

const dimensionField = z
  .number()
  .int("Ukuran gambar harus berupa angka bulat")
  .min(1, "Ukuran gambar tidak valid")
  .max(8000, "Ukuran gambar maksimal 8000 piksel")
  .optional();

const altTextField = z
  .string()
  .trim()
  .max(255, "Teks alternatif maksimal 255 karakter")
  .optional();

export const createMediaUploadUrlSchema = z
  .object({
    originalName: z
      .string()
      .trim()
      .min(1, "Nama berkas wajib diisi")
      .max(255, "Nama berkas maksimal 255 karakter"),
    mimeType: mimeTypeField,
    fileSize: z
      .number()
      .int("Ukuran berkas harus berupa angka bulat")
      .positive("Ukuran berkas tidak valid")
      .max(PDF_MAX_BYTES, "Berkas terlalu besar. Maksimal 10 MB."),
    altText: altTextField,
    width: dimensionField,
    height: dimensionField,
  })
  .strict();

export const confirmMediaUploadSchema = z
  .object({
    ticketId: z.string().uuid("Sesi unggah tidak valid"),
    altText: altTextField,
    width: dimensionField,
    height: dimensionField,
  })
  .strict();

export const updateMediaSchema = z
  .object({
    altText: z
      .string()
      .trim()
      .max(255, "Teks alternatif maksimal 255 karakter")
      .nullable()
      .transform((value) => (value === "" ? null : value)),
  })
  .strict();
