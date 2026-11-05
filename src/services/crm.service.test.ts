import { describe, expect, it, vi } from "vitest";
import { CrmService } from "./crm.service";

const tenantGuard = {
  resolveAuthorizedSiteId: (raw?: unknown) =>
    typeof raw === "string" && raw.length > 0 ? raw : "nextkarya-main",
};

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  security: vi.fn(),
};

describe("CrmService.addLeadNote", () => {
  it("stores the notes payload as an interaction log", async () => {
    const prisma = {
      lead: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "lead-1", site_id: "nextkarya-main" }),
      },
      interactionLog: {
        create: vi.fn().mockResolvedValue({ id: "note-1" }),
      },
    };

    const service = new CrmService({
      prisma: prisma as never,
      tenantGuard: tenantGuard as never,
      logger: logger as never,
    });

    const result = await service.addLeadNote(
      "lead-1",
      { notes: "Klien meminta proposal dikirim besok." },
      "user-1",
      "nextkarya-main"
    );

    expect(result).toEqual({ id: "note-1" });
    expect(prisma.interactionLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: "lead-1",
          authorId: "user-1",
          note: "Klien meminta proposal dikirim besok.",
        }),
      })
    );
  });

  it("rejects a lead outside the tenant", async () => {
    const prisma = {
      lead: { findFirst: vi.fn().mockResolvedValue(null) },
      interactionLog: { create: vi.fn() },
    };

    const service = new CrmService({
      prisma: prisma as never,
      tenantGuard: tenantGuard as never,
      logger: logger as never,
    });

    await expect(
      service.addLeadNote(
        "missing",
        { notes: "Catatan" },
        "user-1",
        "nextkarya-main"
      )
    ).rejects.toThrow("Prospek tidak ditemukan.");

    expect(prisma.interactionLog.create).not.toHaveBeenCalled();
  });
});

describe("CrmService.deleteSchedule", () => {
  it("deletes the schedule and records an activity log", async () => {
    const prisma = {
      projectSchedule: {
        findFirst: vi.fn().mockResolvedValue({
          id: "schedule-1",
          site_id: "nextkarya-main",
          taskName: "Desain prototipe",
        }),
        delete: vi.fn().mockResolvedValue({ id: "schedule-1" }),
      },
      activityLog: {
        create: vi.fn().mockResolvedValue({ id: "log-1" }),
      },
    };

    const service = new CrmService({
      prisma: prisma as never,
      tenantGuard: tenantGuard as never,
      logger: logger as never,
    });

    const result = await service.deleteSchedule(
      "schedule-1",
      "user-1",
      "nextkarya-main"
    );

    expect(result).toEqual({ id: "schedule-1" });
    expect(prisma.projectSchedule.delete).toHaveBeenCalledWith({
      where: { id: "schedule-1" },
    });
    expect(prisma.activityLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "SCHEDULE_SHIFTED",
          entityType: "PROJECT_SCHEDULE",
          entityId: "schedule-1",
        }),
      })
    );
  });

  it("rejects schedules outside the tenant", async () => {
    const prisma = {
      projectSchedule: {
        findFirst: vi.fn().mockResolvedValue(null),
        delete: vi.fn(),
      },
      activityLog: { create: vi.fn() },
    };

    const service = new CrmService({
      prisma: prisma as never,
      tenantGuard: tenantGuard as never,
      logger: logger as never,
    });

    await expect(
      service.deleteSchedule("missing", "user-1", "nextkarya-main")
    ).rejects.toThrow("Jadwal tidak ditemukan.");

    expect(prisma.projectSchedule.delete).not.toHaveBeenCalled();
  });
});
