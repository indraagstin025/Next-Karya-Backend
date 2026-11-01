import { z } from "zod";

const siteIdField = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "Format site_id tidak valid")
  .default("nextkarya-main");

export const createLeadInternalSchema = z
  .object({
    site_id: siteIdField,
    clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255),
    companyName: z.string().trim().max(255).optional().nullable(),
    whatsappNumber: z
      .string()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid"),
    email: z.string().email("Format email tidak valid").optional().nullable(),
    serviceRequested: z.string().trim().min(1, "Layanan wajib ditentukan").max(255),
    message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(2000),
    dealValue: z.number().int().min(0).max(1_000_000_000_000).default(0),
    status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).default("BARU"),
    assignedToId: z.string().trim().max(64).optional().nullable(),
    nextFollowUpDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal follow up harus YYYY-MM-DD")
      .optional()
      .nullable(),
  })
  .strict();

export const updateLeadSchema = z
  .object({
    site_id: siteIdField.optional(),
    clientName: z.string().trim().min(2).max(255).optional(),
    companyName: z.string().trim().max(255).optional().nullable(),
    whatsappNumber: z
      .string()
      .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid")
      .optional(),
    email: z.string().email().optional().nullable(),
    serviceRequested: z.string().trim().min(1).max(255).optional(),
    message: z.string().trim().min(5).max(2000).optional(),
    dealValue: z.number().int().min(0).max(1_000_000_000_000).optional(),
    status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).optional(),
    assignedToId: z.string().trim().max(64).optional().nullable(),
    nextFollowUpDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal follow up harus YYYY-MM-DD")
      .optional()
      .nullable(),
    updatedAt: z.string().trim().min(1, "updatedAt wajib untuk optimistic locking"),
  })
  .strict();

export const createLeadNoteSchema = z
  .object({
    site_id: siteIdField.optional(),
    channel: z
      .enum(["WHATSAPP", "TELEPON", "EMAIL", "TATAP_MUKA", "INTERNAL_NOTE"])
      .default("WHATSAPP"),
    notes: z.string().trim().min(3, "Catatan minimal 3 karakter").max(2000),
  })
  .strict();

export const createScheduleSchema = z
  .object({
    site_id: siteIdField,
    leadId: z.string().trim().max(64).optional().nullable(),
    portfolioId: z.string().trim().max(64).optional().nullable(),
    projectName: z.string().trim().min(2).max(255).optional(),
    taskName: z.string().trim().min(2).max(255),
    assignedToId: z.string().trim().min(1).max(64),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format startDate harus YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format endDate harus YYYY-MM-DD"),
    status: z.enum(["PERSIAPAN", "AKTIF", "REVISI", "SELESAI"]).default("PERSIAPAN"),
    notes: z.string().trim().max(2000).optional().nullable(),
  })
  .strict()
  .refine((data) => data.endDate >= data.startDate, {
    message: "Tanggal selesai (endDate) tidak boleh lebih awal dari tanggal mulai (startDate)",
    path: ["endDate"],
  });

export const updateScheduleSchema = z
  .object({
    site_id: siteIdField.optional(),
    projectName: z.string().trim().min(2).max(255).optional(),
    taskName: z.string().trim().min(2).max(255).optional(),
    assignedToId: z.string().trim().min(1).max(64).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    status: z.enum(["PERSIAPAN", "AKTIF", "REVISI", "SELESAI"]).optional(),
    notes: z.string().trim().max(2000).optional().nullable(),
    updatedAt: z.string().trim().min(1, "updatedAt wajib untuk optimistic locking"),
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
      message: "Tanggal selesai (endDate) tidak boleh lebih awal dari tanggal mulai (startDate)",
      path: ["endDate"],
    }
  );
