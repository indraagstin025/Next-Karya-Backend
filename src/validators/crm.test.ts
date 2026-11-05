import { describe, expect, it } from "vitest";
import { createLeadNoteSchema, createScheduleSchema } from "./crm";

describe("CRM validators", () => {
  it("accepts the notes field used by the CRM drawer", () => {
    const parsed = createLeadNoteSchema.safeParse({
      notes: "Klien meminta proposal dikirim besok.",
      channel: "INTERNAL_NOTE",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects the legacy singular note field", () => {
    const parsed = createLeadNoteSchema.safeParse({
      note: "Klien meminta proposal dikirim besok.",
    });

    expect(parsed.success).toBe(false);
  });

  it("accepts YYYY-MM-DD schedule dates", () => {
    const parsed = createScheduleSchema.safeParse({
      taskName: "Desain prototipe",
      assignedToId: "user-1",
      startDate: "2026-11-02",
      endDate: "2026-11-09",
    });

    expect(parsed.success).toBe(true);
  });

  it("rejects full ISO timestamps for schedule dates", () => {
    const parsed = createScheduleSchema.safeParse({
      taskName: "Desain prototipe",
      assignedToId: "user-1",
      startDate: "2026-11-02T00:00:00.000Z",
      endDate: "2026-11-09T00:00:00.000Z",
    });

    expect(parsed.success).toBe(false);
  });
});
