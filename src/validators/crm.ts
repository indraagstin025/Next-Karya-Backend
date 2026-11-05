import { z } from "zod";
import "./locale";

const siteIdField = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Kode situs tidak valid")
  .default("nextkarya-main");

export const createLeadInternalSchema = z
  .object({
    site_id: siteIdField,
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255, "Nama klien maksimal 255 karakter"),
    companyName: z.string().trim().max(255, "Nama perusahaan maksimal 255 karakter").optional().nullable(),
    whatsappNumber: z
      .string()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor WhatsApp belum benar. Contoh: 081234567890"),
    email: z.string().email("Alamat email belum benar. Contoh: nama@email.com").optional().nullable(),
    serviceRequested: z.string().trim().min(1, "Layanan belum dipilih").max(255, "Layanan maksimal 255 karakter"),
    message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(2000, "Pesan maksimal 2.000 karakter"),
    dealValue: z.number().int().min(0, "Nilai deal tidak boleh negatif").max(1_000_000_000_000, "Nilai deal terlalu besar").default(0),
    status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).default("BARU"),
    assignedToId: z.string().trim().max(64).optional().nullable(),
    nextFollowUpDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tindak lanjut belum benar")
      .optional()
      .nullable(),
  })
  .strict();

export const updateLeadSchema = z
  .object({
    site_id: siteIdField.optional(),
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255, "Nama klien maksimal 255 karakter").optional(),
    companyName: z.string().trim().max(255, "Nama perusahaan maksimal 255 karakter").optional().nullable(),
    whatsappNumber: z
      .string()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Nomor WhatsApp belum benar. Contoh: 081234567890")
      .optional(),
    email: z.string().email("Alamat email belum benar. Contoh: nama@email.com").optional().nullable(),
    serviceRequested: z.string().trim().min(1, "Layanan belum dipilih").max(255, "Layanan maksimal 255 karakter").optional(),
    message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(2000, "Pesan maksimal 2.000 karakter").optional(),
    dealValue: z.number().int().min(0, "Nilai deal tidak boleh negatif").max(1_000_000_000_000, "Nilai deal terlalu besar").optional(),
    status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).optional(),
    assignedToId: z.string().trim().max(64).optional().nullable(),
    nextFollowUpDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tindak lanjut belum benar")
      .optional()
      .nullable(),
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict();

export const createLeadNoteSchema = z
  .object({
    site_id: siteIdField.optional(),
    channel: z
      .enum(["WHATSAPP", "TELEPON", "EMAIL", "TATAP_MUKA", "INTERNAL_NOTE"])
      .default("WHATSAPP"),
    notes: z.string().trim().min(3, "Catatan minimal 3 karakter").max(2000, "Catatan maksimal 2.000 karakter"),
  })
  .strict();

export const createScheduleSchema = z
  .object({
    site_id: siteIdField,
    leadId: z.string().trim().max(64).optional().nullable(),
    portfolioId: z.string().trim().max(64).optional().nullable(),
    projectName: z.string().trim().min(2, "Nama proyek minimal 2 karakter").max(255, "Nama proyek maksimal 255 karakter").optional(),
    taskName: z.string().trim().min(2, "Nama tugas minimal 2 karakter").max(255, "Nama tugas maksimal 255 karakter"),
    assignedToId: z.string().trim().min(1, "Pilih staf penanggung jawab").max(64),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai belum benar"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal selesai belum benar"),
    status: z.enum(["PERSIAPAN", "AKTIF", "REVISI", "SELESAI"]).default("PERSIAPAN"),
    notes: z.string().trim().max(2000, "Catatan maksimal 2.000 karakter").optional().nullable(),
  })
  .strict()
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai",
    path: ["endDate"],
  });

export const updateScheduleSchema = z
  .object({
    site_id: siteIdField.optional(),
    projectName: z.string().trim().min(2, "Nama proyek minimal 2 karakter").max(255, "Nama proyek maksimal 255 karakter").optional(),
    taskName: z.string().trim().min(2, "Nama tugas minimal 2 karakter").max(255, "Nama tugas maksimal 255 karakter").optional(),
    assignedToId: z.string().trim().min(1, "Pilih staf penanggung jawab").max(64).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal mulai belum benar").optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal selesai belum benar").optional(),
    status: z.enum(["PERSIAPAN", "AKTIF", "REVISI", "SELESAI"]).optional(),
    notes: z.string().trim().max(2000, "Catatan maksimal 2.000 karakter").optional().nullable(),
    updatedAt: z.string().trim().min(1, "Muat ulang halaman sebelum menyimpan perubahan"),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "Tanggal selesai tidak boleh lebih awal dari tanggal mulai",
      path: ["endDate"],
    }
  );
