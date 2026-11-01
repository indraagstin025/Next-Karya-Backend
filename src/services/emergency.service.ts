import { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../config/prisma";
import { ITenantGuard, IWebhookNotifier } from "../container/types";
import { AppError } from "../core/AppError";
import { defaultLogger, ILogger } from "../core/logger";
import { defaultTenantGuard } from "../utils/optimistic";
import { defaultWebhookNotifier } from "../utils/webhook";

export interface EmergencyServiceDeps {
  prisma: PrismaClient;
  tenantGuard: ITenantGuard;
  webhook: IWebhookNotifier;
  logger: ILogger;
}

/**
 * Executes high-priority operational overrides (emergency content takedown, contact form lockdown,
 * site-wide alert banners, and emergency lead reassignment) with mandatory audit logging.
 */
export class EmergencyService {
  constructor(
    private readonly deps: EmergencyServiceDeps = {
      prisma: defaultPrisma,
      tenantGuard: defaultTenantGuard,
      webhook: defaultWebhookNotifier,
      logger: defaultLogger,
    }
  ) {}

  /**
   * Returns current site operational flags alongside recent `EmergencyAuditLog` and `ActivityLog` records.
   */
  async getEmergencyOverview(rawSiteId?: string, limit = 30) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(rawSiteId);
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    const [site, emergencyLogs, activityLogs] = await Promise.all([
      this.deps.prisma.site.findUnique({
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
      this.deps.prisma.emergencyAuditLog.findMany({
        where: { site_id },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        include: {
          actor: {
            select: { id: true, fullName: true, email: true, jobTitle: true },
          },
        },
      }),
      this.deps.prisma.activityLog.findMany({
        where: { site_id },
        orderBy: { createdAt: "desc" },
        take: safeLimit,
        include: {
          actor: {
            select: { id: true, fullName: true, email: true, jobTitle: true },
          },
        },
      }),
    ]);

    return {
      site,
      emergencyLogs,
      activityLogs,
    };
  }

  /**
   * Immediately reverts a published post, portfolio, service, or page to `DRAFT`, triggers
   * Next.js cache revalidation, and records both an `EmergencyAuditLog` and `ActivityLog`.
   */
  async unpublishContent(payload: {
    site_id?: string;
    targetEntity: "POST" | "PORTFOLIO" | "SERVICE" | "PAGE";
    targetId: string;
    reason: string;
    executedById: string;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);
    const { targetEntity, targetId, reason, executedById } = payload;

    let previousStatus = "PUBLISHED";
    let targetTitle = targetId;

    if (targetEntity === "POST") {
      const existing = await this.deps.prisma.post.findFirst({
        where: { id: targetId, site_id },
      });
      if (!existing) throw AppError.notFound("Artikel tidak ditemukan.");
      previousStatus = existing.status;
      targetTitle = existing.title;
      await this.deps.prisma.post.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      this.deps.webhook.triggerRevalidation("articles").catch(() => {});
    } else if (targetEntity === "PORTFOLIO") {
      const existing = await this.deps.prisma.portfolio.findFirst({
        where: { id: targetId, site_id },
      });
      if (!existing) throw AppError.notFound("Portofolio tidak ditemukan.");
      previousStatus = existing.status;
      targetTitle = existing.title;
      await this.deps.prisma.portfolio.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      this.deps.webhook.triggerRevalidation("portfolios").catch(() => {});
    } else if (targetEntity === "SERVICE") {
      const existing = await this.deps.prisma.service.findFirst({
        where: { id: targetId, site_id },
      });
      if (!existing) throw AppError.notFound("Layanan tidak ditemukan.");
      previousStatus = existing.status;
      targetTitle = existing.title;
      await this.deps.prisma.service.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      this.deps.webhook.triggerRevalidation("services").catch(() => {});
    } else if (targetEntity === "PAGE") {
      const existing = await this.deps.prisma.page.findFirst({
        where: { id: targetId, site_id },
      });
      if (!existing) throw AppError.notFound("Halaman tidak ditemukan.");
      previousStatus = existing.status;
      targetTitle = existing.title;
      await this.deps.prisma.page.update({
        where: { id: existing.id },
        data: { status: "DRAFT", lastEditedById: executedById },
      });
      this.deps.webhook.triggerRevalidation("pages").catch(() => {});
    }

    const [auditLog] = await this.deps.prisma.$transaction([
      this.deps.prisma.emergencyAuditLog.create({
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
      this.deps.prisma.activityLog.create({
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

    this.deps.logger.security("EMERGENCY_UNPUBLISH_CONTENT", {
      site_id,
      targetEntity,
      targetId,
      executedById,
      reason,
    });

    return {
      message: "Konten berhasil diturunkan darurat ke status DRAFT.",
      auditLogId: auditLog.id,
      actionType: "UNPUBLISH_CONTENT",
      executedAt: auditLog.createdAt,
    };
  }

  /**
   * Disables public lead intake (`isFormLocked = true`) during spam attacks or maintenance,
   * redirecting visitors to official WhatsApp channels.
   */
  async lockContactForm(payload: {
    site_id?: string;
    reason: string;
    executedById: string;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);
    const { reason, executedById } = payload;

    const [, auditLog] = await this.deps.prisma.$transaction([
      this.deps.prisma.site.update({
        where: { id: site_id },
        data: { isFormLocked: true },
      }),
      this.deps.prisma.emergencyAuditLog.create({
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
      this.deps.prisma.activityLog.create({
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

    this.deps.webhook.triggerRevalidation("site").catch(() => {});
    this.deps.logger.security("EMERGENCY_LOCK_CONTACT_FORM", {
      site_id,
      executedById,
      reason,
    });

    return {
      message: "Formulir kontak publik berhasil dikunci secara darurat.",
      auditLogId: auditLog.id,
      actionType: "LOCK_CONTACT_FORM",
      executedAt: auditLog.createdAt,
    };
  }

  /**
   * Re-enables the public consultation form (`isFormLocked = false`) and logs the audit trail.
   */
  async unlockContactForm(payload: {
    site_id?: string;
    reason: string;
    executedById: string;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);
    const { reason, executedById } = payload;

    const [, auditLog] = await this.deps.prisma.$transaction([
      this.deps.prisma.site.update({
        where: { id: site_id },
        data: { isFormLocked: false },
      }),
      this.deps.prisma.emergencyAuditLog.create({
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
      this.deps.prisma.activityLog.create({
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

    this.deps.webhook.triggerRevalidation("site").catch(() => {});
    this.deps.logger.security("EMERGENCY_UNLOCK_CONTACT_FORM", {
      site_id,
      executedById,
      reason,
    });

    return {
      message: "Formulir kontak publik berhasil dibuka kembali.",
      auditLogId: auditLog.id,
      actionType: "UNLOCK_CONTACT_FORM",
      executedAt: auditLog.createdAt,
    };
  }

  /**
   * Activates or clears the site-wide announcement banner (`alertBanner`) and triggers frontend revalidation.
   */
  async setAlertBanner(payload: {
    site_id?: string;
    isActive: boolean;
    alertBanner?: string | null;
    reason: string;
    executedById: string;
  }) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);
    const { isActive, alertBanner, reason, executedById } = payload;
    const cleanBanner = isActive && alertBanner ? alertBanner.trim() : null;
    const actionType = isActive ? "SET_ALERT_BANNER" : "REMOVE_ALERT_BANNER";

    const [, auditLog] = await this.deps.prisma.$transaction([
      this.deps.prisma.site.update({
        where: { id: site_id },
        data: {
          isAlertActive: isActive,
          alertBanner: cleanBanner,
        },
      }),
      this.deps.prisma.emergencyAuditLog.create({
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
      this.deps.prisma.activityLog.create({
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

    this.deps.webhook.triggerRevalidation("site").catch(() => {});

    return {
      message: isActive
        ? "Banner darurat berhasil diaktifkan."
        : "Banner darurat berhasil dinonaktifkan.",
      auditLogId: auditLog.id,
      actionType,
      executedAt: auditLog.createdAt,
    };
  }

  /**
   * Transfers ownership of an active lead to another active staff member when the original PIC
   * is unavailable, recording an immutable `REASSIGN_STAFF` audit log.
   */
  async reassignLead(
    leadId: string,
    payload: {
      site_id?: string;
      newAssignedToId: string;
      reason: string;
      executedById: string;
    }
  ) {
    const site_id = this.deps.tenantGuard.resolveAuthorizedSiteId(payload.site_id);
    const { newAssignedToId, reason, executedById } = payload;

    const [lead, targetStaff] = await Promise.all([
      this.deps.prisma.lead.findFirst({ where: { id: leadId, site_id } }),
      this.deps.prisma.user.findFirst({
        where: { id: newAssignedToId, isActive: true },
      }),
    ]);

    if (!lead) throw AppError.notFound("Prospek tidak ditemukan.");
    if (!targetStaff) {
      throw AppError.notFound(
        "Staf tujuan tidak ditemukan atau tidak aktif."
      );
    }

    const [updatedLead, auditLog] = await this.deps.prisma.$transaction([
      this.deps.prisma.lead.update({
        where: { id: lead.id },
        data: { assignedToId: newAssignedToId },
      }),
      this.deps.prisma.emergencyAuditLog.create({
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
      this.deps.prisma.activityLog.create({
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

    this.deps.logger.security("EMERGENCY_REASSIGN_LEAD", {
      leadId: lead.id,
      newAssignedToId,
      executedById,
      reason,
    });

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
