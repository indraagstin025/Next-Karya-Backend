import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { ITenantGuard } from "../container/types";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import { defaultTenantGuard } from "../utils/optimistic";
import { PaginationMeta } from "../utils/response";

export interface CrmServiceDeps {
  prisma: PrismaClient;
  tenantGuard: ITenantGuard;
  logger: ILogger;
}

export class CrmService {
  constructor(
    private readonly deps: CrmServiceDeps = {
      prisma: defaultPrisma,
      tenantGuard: defaultTenantGuard,
      logger: defaultLogger,
    }
  ) {}

  async createLeadInternal(payload: any, recordedById: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);

    const lead = await this.deps.prisma.lead.create({
      data: {
        site_id,
        clientName: payload.clientName,
        companyName: payload.companyName ?? null,
        whatsappNumber: payload.whatsappNumber,
        email: payload.email ?? null,
        serviceRequested: payload.serviceRequested,
        message: payload.message,
        dealValue: BigInt(payload.dealValue || 0),
        status: payload.status || "BARU",
        assignedToId: payload.assignedToId || null,
        nextFollowUpDate: payload.nextFollowUpDate
          ? new Date(payload.nextFollowUpDate)
          : null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    await this.deps.prisma.activityLog.create({
      data: {
        site_id,
        actorId: recordedById,
        action: "LEAD_STATUS_CHANGED",
        entityType: "LEAD",
        entityId: lead.id,
        summary: `Prospek dibuat secara manual oleh staf (Status: ${lead.status}, Nilai: Rp ${Number(lead.dealValue).toLocaleString("id-ID")}).`,
      },
    });

    return {
      ...lead,
      dealValue: Number(lead.dealValue),
    };
  }

  async getLeads(query: {
    site_id?: string;
    status?: "BARU" | "DIHUBUNGI" | "PROPOSAL" | "DEAL" | "BATAL";
    assignedToId?: string;
    page: number;
    limit: number;
    search?: string;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(query.site_id);
    const { status, assignedToId, page, limit, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { site_id };
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;
    if (search) {
      where.OR = [
        { clientName: { contains: search, mode: "insensitive" } },
        { companyName: { contains: search, mode: "insensitive" } },
        { whatsappNumber: { contains: search } },
      ];
    }

    const [total, rawItems] = await Promise.all([
      this.deps.prisma.lead.count({ where }),
      this.deps.prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ nextFollowUpDate: "asc" }, { createdAt: "desc" }],
        include: {
          assignedTo: { select: { id: true, fullName: true, email: true } },
        },
      }),
    ]);

    const items = rawItems.map((lead) => ({
      ...lead,
      dealValue: Number(lead.dealValue),
    }));

    const meta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    };

    return { items, meta };
  }

  async getLeadById(id: string, rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);

    const lead = await this.deps.prisma.lead.findFirst({
      where: { id, site_id },
      include: {
        assignedTo: { select: { id: true, fullName: true, email: true } },
        interactionLogs: {
          orderBy: { createdAt: "desc" },
          include: {
            author: { select: { id: true, fullName: true } },
          },
        },
        schedules: {
          orderBy: { startDate: "asc" },
        },
      },
    });

    if (!lead) return null;

    const activityLogs = await this.deps.prisma.activityLog.findMany({
      where: { site_id, entityType: "LEAD", entityId: id },
      orderBy: { createdAt: "desc" },
      include: {
        actor: { select: { id: true, fullName: true } },
      },
    });

    return {
      ...lead,
      dealValue: Number(lead.dealValue),
      activityLogs,
    };
  }

  async updateLead(id: string, payload: any, editorId: string, rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(
      payload?.site_id ?? rawSiteId
    );
    const current = await this.deps.prisma.lead.findFirst({
      where: { id, site_id },
    });
    if (!current) {
      throw AppError.notFound("Data prospek tidak ditemukan.");
    }

    // Explicit allowlist field mapping to prevent Mass Assignment
    const dataToUpdate: Record<string, unknown> = {
      lastEditedById: editorId,
    };

    if (payload.clientName !== undefined) dataToUpdate.clientName = payload.clientName;
    if (payload.companyName !== undefined) dataToUpdate.companyName = payload.companyName;
    if (payload.whatsappNumber !== undefined) {
      dataToUpdate.whatsappNumber = payload.whatsappNumber;
    }
    if (payload.email !== undefined) dataToUpdate.email = payload.email;
    if (payload.serviceRequested !== undefined) {
      dataToUpdate.serviceRequested = payload.serviceRequested;
    }
    if (payload.message !== undefined) dataToUpdate.message = payload.message;
    if (payload.status !== undefined) dataToUpdate.status = payload.status;
    if (payload.assignedToId !== undefined) {
      dataToUpdate.assignedToId = payload.assignedToId;
    }
    if (payload.dealValue !== undefined) {
      dataToUpdate.dealValue = BigInt(payload.dealValue);
    }
    if (payload.nextFollowUpDate !== undefined) {
      dataToUpdate.nextFollowUpDate = payload.nextFollowUpDate
        ? new Date(payload.nextFollowUpDate)
        : null;
    }

    const updated = await this.deps.prisma.lead.update({
      where: { id: current.id },
      data: dataToUpdate,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    if (payload.status && payload.status !== current.status) {
      await this.deps.prisma.activityLog.create({
        data: {
          site_id: current.site_id,
          actorId: editorId,
          action: "LEAD_STATUS_CHANGED",
          entityType: "LEAD",
          entityId: id,
          summary: `Status prospek diubah dari ${current.status} menjadi ${payload.status}.`,
        },
      });
    }

    if (payload.assignedToId && payload.assignedToId !== current.assignedToId) {
      await this.deps.prisma.activityLog.create({
        data: {
          site_id: current.site_id,
          actorId: editorId,
          action: "LEAD_REASSIGNED",
          entityType: "LEAD",
          entityId: id,
          summary: `Penanggung jawab prospek dialihkan ke staf ID: ${payload.assignedToId}.`,
        },
      });
    }

    return {
      ...updated,
      dealValue: Number(updated.dealValue),
    };
  }

  async addLeadNote(
    leadId: string,
    payload: { site_id?: string; channel?: string; notes: string },
    userId: string,
    rawSiteId?: string
  ) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(
      payload.site_id ?? rawSiteId
    );
    const lead = await this.deps.prisma.lead.findFirst({
      where: { id: leadId, site_id },
    });
    if (!lead) {
      throw AppError.notFound("Prospek tidak ditemukan.");
    }

    const note = await this.deps.prisma.interactionLog.create({
      data: {
        site_id: lead.site_id,
        leadId,
        authorId: userId,
        note: payload.notes,
      },
      include: {
        author: { select: { id: true, fullName: true } },
      },
    });

    return note;
  }

  async getFollowUpToday(rawSiteId?: string, assignedToId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    // Current date in WIB (UTC+7)
    const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
    const currentDateStr = nowWib.toISOString().slice(0, 10);
    const endOfToday = new Date(`${currentDateStr}T23:59:59.999Z`);

    const where: any = {
      site_id,
      status: { in: ["BARU", "DIHUBUNGI", "PROPOSAL"] as any },
      nextFollowUpDate: { lte: endOfToday },
    };

    if (assignedToId) {
      where.assignedToId = assignedToId;
    }

    const leads = await this.deps.prisma.lead.findMany({
      where,
      orderBy: { nextFollowUpDate: "asc" },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        interactionLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { note: true, createdAt: true },
        },
      },
    });

    return leads.map((lead) => {
      const followUpDateStr = lead.nextFollowUpDate
        ? lead.nextFollowUpDate.toISOString().slice(0, 10)
        : null;

      const priority =
        followUpDateStr === currentDateStr ? "DUE_TODAY" : "OVERDUE";

      const lastInteractionNote =
        lead.interactionLogs.length > 0 ? lead.interactionLogs[0].note : null;

      return {
        id: lead.id,
        clientName: lead.clientName,
        companyName: lead.companyName,
        whatsappNumber: lead.whatsappNumber,
        serviceRequested: lead.serviceRequested,
        dealValue: Number(lead.dealValue),
        status: lead.status,
        priority,
        nextFollowUpDate: followUpDateStr,
        assignedTo: lead.assignedTo,
        lastInteractionNote,
      };
    });
  }

  // --- SCHEDULES ---
  async getScheduleById(id: string, rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    return this.deps.prisma.projectSchedule.findFirst({
      where: { id, site_id },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        lead: { select: { id: true, clientName: true, companyName: true } },
      },
    });
  }

  async getSchedules(rawSiteId?: string, assignedToId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const where: any = { site_id };
    if (assignedToId) where.assignedToId = assignedToId;

    return this.deps.prisma.projectSchedule.findMany({
      where,
      orderBy: { startDate: "asc" },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        lead: { select: { id: true, clientName: true, companyName: true } },
      },
    });
  }

  async createSchedule(payload: any, editorId: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);

    return this.deps.prisma.projectSchedule.create({
      data: {
        site_id,
        leadId: payload.leadId || null,
        taskName: payload.taskName,
        assignedToId: payload.assignedToId,
        startDate: new Date(payload.startDate),
        endDate: new Date(payload.endDate),
        status: payload.status || "PERSIAPAN",
        lastEditedById: editorId,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
  }

  async updateSchedule(id: string, payload: any, editorId: string, rawSiteId?: string) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(
      payload?.site_id ?? rawSiteId
    );
    const current = await this.deps.prisma.projectSchedule.findFirst({
      where: { id, site_id },
    });
    if (!current) {
      throw AppError.notFound("Jadwal tidak ditemukan.");
    }

    // Explicit allowlist field mapping to prevent Mass Assignment
    const dataToUpdate: Record<string, unknown> = {
      lastEditedById: editorId,
    };

    if (payload.taskName !== undefined) dataToUpdate.taskName = payload.taskName;
    if (payload.assignedToId !== undefined) {
      dataToUpdate.assignedToId = payload.assignedToId;
    }
    if (payload.status !== undefined) dataToUpdate.status = payload.status;
    if (payload.startDate !== undefined) {
      dataToUpdate.startDate = new Date(payload.startDate);
    }
    if (payload.endDate !== undefined) {
      dataToUpdate.endDate = new Date(payload.endDate);
    }

    return this.deps.prisma.projectSchedule.update({
      where: { id: current.id },
      data: dataToUpdate,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
  }
}
