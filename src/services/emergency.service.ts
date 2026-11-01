import { prisma } from "../config/prisma";
import { triggerRevalidationWebhook } from "../utils/webhook";
import { resolveAuthorizedSiteId } from "../utils/optimistic";

export class EmergencyService {
  async getEmergencyOverview(rawSiteId?: string, limit = 30) {
    const site_id = resolveAuthorizedSiteId(rawSiteId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const [site, emergencyLogs, activityLogs] = await Promise.all([
      prisma.site.findUnique({
        where: { id: site_id },
        select: {
          id: true,
          name: true,
          domain: true,
          isActive: true,
          isFormLocked: true,
          alertBanner: true,
          isAlertActive: true,
          updatedAt: true,
        },
      }),
      prisma.emergencyAuditLog.findMany({
        where: { site_id },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        include: {
          actor: { select: { id: true, fullName: true, email: true, jobTitle: true } },
        },
      }),
      prisma.activityLog.findMany({
        where: { site_id },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        include: {
          actor: { select: { id: true, fullName: true, email: true, jobTitle: true } },
        },
      }),
    ]);

    return {
      site,
      emergencyLogs,
      activityLogs,
    };
  }

  async unpublishContent(payload: {
    site_id?: string;
    targetEntity: "POST" | "PORTFOLIO" | "SERVICE" | "PAGE";
    targetId: string;
    reason: string;
    executedById: string;
  }) {
    const site_id = resolveAuthorizedSiteId(payload.site_id);
    const { targetEntity, targetId, reason, executedById } = payload;

    let previousStatus = "PUBLISHED";
    let targetTitle = targetId;

    if (targetEntity === "POST") {
      const existing = await prisma.post.findFirst({ where: { id: targetId, site_id } });
      if (!existing) throw { statusCode: 404, code: "NOT_FOUND", message: "Artikel tidak ditemukan." };
      previousStatus = existing.status;
      targetTitle = existing.title;
      await prisma.post.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      triggerRevalidationWebhook("articles").catch(console.error);
    } else if (targetEntity === "PORTFOLIO") {
      const existing = await prisma.portfolio.findFirst({ where: { id: targetId, site_id } });
      if (!existing) throw { statusCode: 404, code: "NOT_FOUND", message: "Portofolio tidak ditemukan." };
      previousStatus = existing.status;
      targetTitle = existing.title;
      await prisma.portfolio.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      triggerRevalidationWebhook("portfolios").catch(console.error);
    } else if (targetEntity === "SERVICE") {
      const existing = await prisma.service.findFirst({ where: { id: targetId, site_id } });
      if (!existing) throw { statusCode: 404, code: "NOT_FOUND", message: "Layanan tidak ditemukan." };
      previousStatus = existing.status;
      targetTitle = existing.title;
      await prisma.service.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      triggerRevalidationWebhook("services").catch(console.error);
    } else if (targetEntity === "PAGE") {
      const existing = await prisma.page.findFirst({ where: { id: targetId, site_id } });
      if (!existing) throw { statusCode: 404, code: "NOT_FOUND", message: "Halaman tidak ditemukan." };
      previousStatus = existing.status;
      targetTitle = existing.title;
      await prisma.page.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      triggerRevalidationWebhook("pages").catch(console.error);
    }

    const [auditLog] = await prisma.$transaction([
      prisma.emergencyAuditLog.create({
        data: {
          site_id,
          actionType: "UNPUBLISH_CONTENT",
          targetEntity,
          targetId,
          previousState: { status: previousStatus, title: targetTitle },
          reason,
          actorId: executedById,
        },
      }),
      prisma.activityLog.create({
        data: {
          site_id,
          actorId: executedById,
          action: "CONTENT_STATUS_CHANGED",
          entityType: targetEntity,
          entityId: targetId,
          summary: `Penurunan darurat ${targetEntity} "${targetTitle}" ke DRAFT. Alasan: ${reason}`,
        },
      }),
    ]);

    return {
      message: "Konten berhasil diturunkan darurat ke status DRAFT.",
      auditLogId: auditLog.id,
      actionType: "UNPUBLISH_CONTENT",
      executedAt: auditLog.createdAt,
    };
  }

  async lockContactForm(payload: { site_id?: string; reason: string; executedById: string }) {
    const site_id = resolveAuthorizedSiteId(payload.site_id);
    const { reason, executedById } = payload;

    const [, auditLog] = await prisma.$transaction([
      prisma.site.update({
        where: { id: site_id },
        data: { isFormLocked: true },
      }),
      prisma.emergencyAuditLog.create({
        data: {
          site_id,
          actionType: "LOCK_CONTACT_FORM",
          targetEntity: "SITE",
          targetId: site_id,
          previousState: { isFormLocked: false },
          reason,
          actorId: executedById,
        },
      }),
      prisma.activityLog.create({
        data: {
          site_id,
          actorId: executedById,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "SITE",
          entityId: site_id,
          summary: `Formulir kontak publik dikunci darurat. Alasan: ${reason}`,
        },
      }),
    ]);

    triggerRevalidationWebhook("site").catch(console.error);

    return {
      message: "Formulir kontak publik berhasil dikunci secara darurat.",
      auditLogId: auditLog.id,
      actionType: "LOCK_CONTACT_FORM",
      executedAt: auditLog.createdAt,
    };
  }

  async unlockContactForm(payload: { site_id?: string; reason: string; executedById: string }) {
    const site_id = resolveAuthorizedSiteId(payload.site_id);
    const { reason, executedById } = payload;

    const [, auditLog] = await prisma.$transaction([
      prisma.site.update({
        where: { id: site_id },
        data: { isFormLocked: false },
      }),
      prisma.emergencyAuditLog.create({
        data: {
          site_id,
          actionType: "UNLOCK_CONTACT_FORM",
          targetEntity: "SITE",
          targetId: site_id,
          previousState: { isFormLocked: true },
          reason,
          actorId: executedById,
        },
      }),
      prisma.activityLog.create({
        data: {
          site_id,
          actorId: executedById,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "SITE",
          entityId: site_id,
          summary: `Formulir kontak publik dibuka kembali. Alasan: ${reason}`,
        },
      }),
    ]);

    triggerRevalidationWebhook("site").catch(console.error);

    return {
      message: "Formulir kontak publik berhasil dibuka kembali.",
      auditLogId: auditLog.id,
      actionType: "UNLOCK_CONTACT_FORM",
      executedAt: auditLog.createdAt,
    };
  }

  async setAlertBanner(payload: {
    site_id?: string;
    isActive: boolean;
    alertBanner?: string | null;
    reason: string;
    executedById: string;
  }) {
    const site_id = resolveAuthorizedSiteId(payload.site_id);
    const { isActive, alertBanner, reason, executedById } = payload;
    const cleanBanner = isActive && alertBanner ? alertBanner.trim() : null;
    const actionType = isActive ? "SET_ALERT_BANNER" : "REMOVE_ALERT_BANNER";

    const [, auditLog] = await prisma.$transaction([
      prisma.site.update({
        where: { id: site_id },
        data: {
          isAlertActive: isActive,
          alertBanner: cleanBanner,
        },
      }),
      prisma.emergencyAuditLog.create({
        data: {
          site_id,
          actionType,
          targetEntity: "SITE",
          targetId: site_id,
          previousState: { isAlertActive: !isActive },
          reason,
          actorId: executedById,
        },
      }),
      prisma.activityLog.create({
        data: {
          site_id,
          actorId: executedById,
          action: "CONTENT_STATUS_CHANGED",
          entityType: "SITE",
          entityId: site_id,
          summary: isActive
            ? `Banner darurat diaktifkan: "${cleanBanner}". Alasan: ${reason}`
            : `Banner darurat dinonaktifkan. Alasan: ${reason}`,
        },
      }),
    ]);

    triggerRevalidationWebhook("site").catch(console.error);

    return {
      message: isActive
        ? "Banner darurat berhasil diaktifkan."
        : "Banner darurat berhasil dinonaktifkan.",
      auditLogId: auditLog.id,
      actionType,
      executedAt: auditLog.createdAt,
    };
  }

  async reassignLead(
    leadId: string,
    payload: { site_id?: string; newAssignedToId: string; reason: string; executedById: string }
  ) {
    const site_id = resolveAuthorizedSiteId(payload.site_id);
    const { newAssignedToId, reason, executedById } = payload;

    const [lead, targetStaff] = await Promise.all([
      prisma.lead.findFirst({ where: { id: leadId, site_id } }),
      prisma.user.findFirst({ where: { id: newAssignedToId, isActive: true } }),
    ]);

    if (!lead) throw { statusCode: 404, code: "NOT_FOUND", message: "Prospek tidak ditemukan." };
    if (!targetStaff) {
      throw { statusCode: 404, code: "NOT_FOUND", message: "Staf tujuan tidak ditemukan atau tidak aktif." };
    }

    const [updatedLead, auditLog] = await prisma.$transaction([
      prisma.lead.update({
        where: { id: lead.id },
        data: { assignedToId: newAssignedToId },
      }),
      prisma.emergencyAuditLog.create({
        data: {
          site_id: lead.site_id,
          actionType: "REASSIGN_STAFF",
          targetEntity: "LEAD",
          targetId: lead.id,
          previousState: { assignedToId: lead.assignedToId },
          reason,
          actorId: executedById,
        },
      }),
      prisma.activityLog.create({
        data: {
          site_id: lead.site_id,
          actorId: executedById,
          action: "LEAD_REASSIGNED",
          entityType: "LEAD",
          entityId: lead.id,
          summary: `Pengalihan darurat prospek ke ${targetStaff.fullName}. Alasan: ${reason}`,
        },
      }),
    ]);

    return {
      message: "Penanggung jawab prospek berhasil dialihkan secara darurat.",
      auditLogId: auditLog.id,
      actionType: "REASSIGN_STAFF",
      executedAt: auditLog.createdAt,
      lead: {
        ...updatedLead,
        dealValue: Number(updatedLead.dealValue),
      },
    };
  }
}
