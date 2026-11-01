import { z } from "zod";

export const createLeadInternalSchema = z.object({
  site_id: z.string().min(1).default("nextkarya-main"),
  clientName: z.string().trim().min(2, "Nama klien minimal 2 karakter").max(255),
  companyName: z.string().trim().max(255).optional().nullable(),
  whatsappNumber: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid"),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  serviceRequested: z.string().min(1, "Layanan wajib ditentukan"),
  message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(2000),
  dealValue: z.number().int().min(0).default(0),
  status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).default("BARU"),
  assignedToId: z.string().optional().nullable(),
  nextFollowUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal follow up harus YYYY-MM-DD")
    .optional()
    .nullable(),
});

export const updateLeadSchema = z.object({
  clientName: z.string().trim().min(2).max(255).optional(),
  companyName: z.string().trim().max(255).optional().nullable(),
  whatsappNumber: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid")
    .optional(),
  email: z.string().email().optional().nullable(),
  serviceRequested: z.string().min(1).optional(),
  message: z.string().trim().min(5).max(2000).optional(),
  dealValue: z.number().int().min(0).optional(),
  status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).optional(),
  assignedToId: z.string().optional().nullable(),
  nextFollowUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal follow up harus YYYY-MM-DD")
    .optional()
    .nullable(),
  updatedAt: z.string().min(1, "updatedAt wajib untuk optimistic locking"),
});

export const createLeadNoteSchema = z.object({
  channel: z
    .enum(["WHATSAPP", "TELEPON", "EMAIL", "TATAP_MUKA", "INTERNAL_NOTE"])
    .default("WHATSAPP"),
  notes: z.string().trim().min(3, "Catatan minimal 3 karakter").max(2000),
});

export const createScheduleSchema = z.object({
  site_id: z.string().min(1).default("nextkarya-main"),
  leadId: z.string().optional().nullable(),
  portfolioId: z.string().optional().nullable(),
  projectName: z.string().min(2).max(255),
  taskName: z.string().min(2).max(255),
  assignedToId: z.string().min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format startDate harus YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format endDate harus YYYY-MM-DD"),
  status: z.enum(["PERSIAPAN", "AKTIF", "REVISI", "SELESAI"]).default("PERSIAPAN"),
  notes: z.string().optional().nullable(),
});

export const updateScheduleSchema = z.object({
  projectName: z.string().min(2).max(255).optional(),
  taskName: z.string().min(2).max(255).optional(),
  assignedToId: z.string().min(1).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(["PERSIAPAN", "AKTIF", "REVISI", "SELESAI"]).optional(),
  notes: z.string().optional().nullable(),
  updatedAt: z.string().min(1, "updatedAt wajib untuk optimistic locking"),
});
