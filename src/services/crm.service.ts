import { prisma } from "../config/prisma";
import { PaginationMeta } from "../utils/response";

export class CrmService {
  async createLeadInternal(payload: any, recordedById: string) {
    const lead = await prisma.lead.create({
      data: {
        site_id: payload.site_id,
        clientName: payload.clientName,
        companyName: payload.companyName,
        whatsappNumber: payload.whatsappNumber,
        email: payload.email,
        serviceRequested: payload.serviceRequested,
        message: payload.message,
        dealValue: BigInt(payload.dealValue || 0),
        status: payload.status || "BARU",
        assignedToId: payload.assignedToId || null,
        nextFollowUpDate: payload.nextFollowUpDate ? new Date(payload.nextFollowUpDate) : null,
      },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    await prisma.activityLog.create({
      data: {
        site_id: payload.site_id,
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
    site_id: string;
    status?: "BARU" | "DIHUBUNGI" | "PROPOSAL" | "DEAL" | "BATAL";
    assignedToId?: string;
    page: number;
    limit: number;
    search?: string;
  }) {
    const { site_id, status, assignedToId, page, limit, search } = query;
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
      prisma.lead.count({ where }),
      prisma.lead.findMany({
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

  async getLeadById(id: string) {
    const lead = await prisma.lead.findUnique({
      where: { id },
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

    // Fetch activity logs for this lead
    const activityLogs = await prisma.activityLog.findMany({
      where: { entityType: "LEAD", entityId: id },
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

  async updateLead(id: string, payload: any, editorId: string) {
    const current = await prisma.lead.findUnique({ where: { id } });
    if (!current) throw { statusCode: 404, code: "NOT_FOUND", message: "Data prospek tidak ditemukan." };

    const { updatedAt, nextFollowUpDate, dealValue, ...updateData } = payload;

    const dataToUpdate: any = {
      ...updateData,
      lastEditedById: editorId,
    };

    if (dealValue !== undefined) {
      dataToUpdate.dealValue = BigInt(dealValue);
    }

    if (nextFollowUpDate !== undefined) {
      dataToUpdate.nextFollowUpDate = nextFollowUpDate ? new Date(nextFollowUpDate) : null;
    }

    const updated = await prisma.lead.update({
      where: { id },
      data: dataToUpdate,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });

    // Record activity logs if status changed or reassigned
    if (payload.status && payload.status !== current.status) {
      await prisma.activityLog.create({
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
      await prisma.activityLog.create({
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

  async addLeadNote(leadId: string, payload: { channel?: string; notes: string }, userId: string) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) throw { statusCode: 404, code: "NOT_FOUND", message: "Prospek tidak ditemukan." };

    const note = await prisma.interactionLog.create({
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

  async getFollowUpToday(site_id: string, assignedToId?: string) {
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

    const leads = await prisma.lead.findMany({
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
  async getSchedules(site_id: string, assignedToId?: string) {
    const where: any = { site_id };
    if (assignedToId) where.assignedToId = assignedToId;

    return prisma.projectSchedule.findMany({
      where,
      orderBy: { startDate: "asc" },
      include: {
        assignedTo: { select: { id: true, fullName: true } },
        lead: { select: { id: true, clientName: true, companyName: true } },
      },
    });
  }

  async createSchedule(payload: any, editorId: string) {
    return prisma.projectSchedule.create({
      data: {
        site_id: payload.site_id,
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

  async updateSchedule(id: string, payload: any, editorId: string) {
    const { updatedAt, startDate, endDate, ...updateData } = payload;
    const dataToUpdate: any = {
      ...updateData,
      lastEditedById: editorId,
    };

    if (startDate) dataToUpdate.startDate = new Date(startDate);
    if (endDate) dataToUpdate.endDate = new Date(endDate);

    return prisma.projectSchedule.update({
      where: { id },
      data: dataToUpdate,
      include: {
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
  }
}
