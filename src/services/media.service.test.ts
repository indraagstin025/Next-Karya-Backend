import { beforeEach, describe, expect, it, vi } from "vitest";
import { MediaService } from "./media.service";

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

const env = {
  UPLOAD_DIR: "./uploads",
  SUPABASE_STORAGE_BUCKET: "nextkarya-media",
  SUPABASE_SIGNED_UPLOAD_TTL_SECONDS: 900,
};

function createHarness(overrides: Record<string, any> = {}) {
  const pendingStore = new Map<string, string>();
  const cache = {
    get: vi.fn(async (key: string) => pendingStore.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      pendingStore.set(key, value);
    }),
    del: vi.fn(async (key: string) => {
      pendingStore.delete(key);
    }),
    incr: vi.fn(),
  };

  const storage = {
    enabled: true,
    createSignedUploadUrl: vi.fn(async (path: string) => ({
      signedUrl: `https://example.supabase.co/storage/v1/object/upload/sign/nextkarya-media/${path}?token=test`,
      token: "test-token",
      path,
    })),
    getObjectInfo: vi.fn(async () => ({ size: 2048, contentType: "image/png" })),
    getPublicUrl: vi.fn((path: string) => `https://cdn.example.com/${path}`),
    deleteObject: vi.fn(async () => undefined),
    ...overrides.storage,
  };

  const prisma = {
    media: {
      create: vi.fn(async ({ data }: any) => ({
        id: "media-1",
        ...data,
        createdAt: new Date("2026-11-05T00:00:00.000Z"),
        uploadedBy: { fullName: "Staf Uji" },
      })),
      findFirst: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    post: { findFirst: vi.fn(async () => null) },
    portfolio: { findFirst: vi.fn(async () => null) },
    testimonial: { findFirst: vi.fn(async () => null) },
    user: { findFirst: vi.fn(async () => null) },
    ...overrides.prisma,
  };

  const service = new MediaService({
    prisma,
    env,
    cache,
    tenantGuard,
    logger,
    storage,
  } as never);

  return { service, prisma, cache, storage, pendingStore };
}

const baseUpload = {
  uploaderId: "user-1",
  originalName: "hero.png",
  mimeType: "image/png",
  fileSize: 2048,
  altText: "Tangkapan layar beranda",
  width: 1280,
  height: 720,
};

describe("MediaService direct upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a signed upload ticket with a tenant-scoped object path", async () => {
    const { service, storage, cache } = createHarness();

    const ticket = await service.createUploadTicket(baseUpload);

    expect(ticket.uploadUrl).toContain("token=test");
    expect(ticket.expiresIn).toBe(900);
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(
      expect.stringMatching(/^nextkarya-main\/\d{4}\/\d{2}\/[0-9a-f-]+\.png$/)
    );
    expect(cache.set).toHaveBeenCalledWith(
      `media_upload:${ticket.ticketId}`,
      expect.stringContaining(ticket.path),
      900
    );
  });

  it("rejects unsupported MIME types and oversized files before signing", async () => {
    const { service, storage } = createHarness();

    await expect(
      service.createUploadTicket({ ...baseUpload, mimeType: "text/html" })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    await expect(
      service.createUploadTicket({ ...baseUpload, mimeType: "toString" })
    ).rejects.toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

    await expect(
      service.createUploadTicket({ ...baseUpload, fileSize: 6 * 1024 * 1024 })
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });

    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it("confirms the upload after verifying object metadata", async () => {
    const { service, prisma, cache, storage } = createHarness();

    const ticket = await service.createUploadTicket(baseUpload);
    const media = await service.confirmUpload({
      ticketId: ticket.ticketId,
      uploaderId: "user-1",
      width: 1280,
      height: 720,
    });

    expect(storage.getObjectInfo).toHaveBeenCalledWith(ticket.path);
    expect(prisma.media.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          site_id: "nextkarya-main",
          fileName: ticket.path,
          fileSize: 2048,
          url: `https://cdn.example.com/${ticket.path}`,
          altText: "Tangkapan layar beranda",
          uploadedById: "user-1",
        }),
      })
    );
    expect(media.id).toBe("media-1");
    expect(cache.del).toHaveBeenCalledWith(`media_upload:${ticket.ticketId}`);
  });

  it("keeps the ticket when object metadata reports no size", async () => {
    const { service, prisma, cache, storage } = createHarness({
      storage: {
        getObjectInfo: vi.fn(async () => ({ size: 0, contentType: "image/png" })),
      },
    });

    const ticket = await service.createUploadTicket(baseUpload);

    await expect(
      service.confirmUpload({ ticketId: ticket.ticketId, uploaderId: "user-1" })
    ).rejects.toMatchObject({ code: "STORAGE_METADATA_INVALID" });

    expect(prisma.media.create).not.toHaveBeenCalled();
    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(cache.del).not.toHaveBeenCalledWith(`media_upload:${ticket.ticketId}`);
  });

  it("returns the existing row when the same object is confirmed twice", async () => {
    const existing = {
      id: "media-1",
      fileName: "nextkarya-main/2026/11/hero.png",
      originalName: "hero.png",
    };
    const prisma = {
      media: {
        findFirst: vi.fn(async () => existing),
        create: vi.fn(),
      },
    };
    const { service, cache } = createHarness({ prisma });

    const ticket = await service.createUploadTicket(baseUpload);
    const media = await service.confirmUpload({
      ticketId: ticket.ticketId,
      uploaderId: "user-1",
    });

    expect(media.id).toBe("media-1");
    expect(prisma.media.create).not.toHaveBeenCalled();
    expect(cache.del).toHaveBeenCalledWith(`media_upload:${ticket.ticketId}`);
  });

  it("removes the object when the stored MIME type does not match", async () => {
    const { service, prisma, storage } = createHarness({
      storage: {
        getObjectInfo: vi.fn(async () => ({
          size: 2048,
          contentType: "application/pdf",
        })),
      },
    });

    const ticket = await service.createUploadTicket(baseUpload);

    await expect(
      service.confirmUpload({ ticketId: ticket.ticketId, uploaderId: "user-1" })
    ).rejects.toMatchObject({ code: "FILE_TYPE_MISMATCH" });

    expect(storage.deleteObject).toHaveBeenCalledWith(ticket.path);
    expect(prisma.media.create).not.toHaveBeenCalled();
  });

  it("rejects a ticket owned by another staff member", async () => {
    const { service } = createHarness();
    const ticket = await service.createUploadTicket(baseUpload);

    await expect(
      service.confirmUpload({ ticketId: ticket.ticketId, uploaderId: "user-2" })
    ).rejects.toMatchObject({ code: "UPLOAD_TICKET_INVALID" });
  });

  it("updates only the alt text of an existing media row", async () => {
    const prisma = {
      media: {
        findFirst: vi.fn(async () => ({ id: "media-1" })),
        update: vi.fn(async ({ data }: any) => ({ id: "media-1", ...data })),
      },
    };
    const { service } = createHarness({ prisma });

    const result = await service.updateMedia("media-1", "nextkarya-main", {
      altText: "  Deskripsi baru  ",
    });

    expect(prisma.media.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "media-1" },
        data: { altText: "Deskripsi baru" },
      })
    );
    expect(result.altText).toBe("Deskripsi baru");
  });

  it("deletes the remote object and media row when unused", async () => {
    const prisma = {
      media: {
        findFirst: vi.fn(async () => ({
          id: "media-1",
          fileName: "nextkarya-main/2026/11/hero.png",
          url: "https://cdn.example.com/nextkarya-main/2026/11/hero.png",
        })),
        delete: vi.fn(async () => ({ id: "media-1" })),
      },
      post: { findFirst: vi.fn(async () => null) },
      portfolio: { findFirst: vi.fn(async () => null) },
      testimonial: { findFirst: vi.fn(async () => null) },
      user: { findFirst: vi.fn(async () => null) },
    };
    const { service, storage } = createHarness({ prisma });

    const result = await service.deleteMedia("media-1", "nextkarya-main");

    expect(storage.deleteObject).toHaveBeenCalledWith(
      "nextkarya-main/2026/11/hero.png"
    );
    expect(prisma.media.delete).toHaveBeenCalledWith({ where: { id: "media-1" } });
    expect(result.message).toContain("berhasil dihapus");
  });

  it("refuses to delete media that is still referenced", async () => {
    const prisma = {
      media: {
        findFirst: vi.fn(async () => ({
          id: "media-1",
          fileName: "nextkarya-main/2026/11/hero.png",
          url: "https://cdn.example.com/nextkarya-main/2026/11/hero.png",
        })),
        delete: vi.fn(),
      },
      post: { findFirst: vi.fn(async () => ({ id: "post-1", title: "Artikel" })) },
      portfolio: { findFirst: vi.fn(async () => null) },
      testimonial: { findFirst: vi.fn(async () => null) },
      user: { findFirst: vi.fn(async () => null) },
    };
    const { service, storage } = createHarness({ prisma });

    await expect(
      service.deleteMedia("media-1", "nextkarya-main")
    ).rejects.toMatchObject({ code: "MEDIA_IN_USE" });

    expect(storage.deleteObject).not.toHaveBeenCalled();
    expect(prisma.media.delete).not.toHaveBeenCalled();
  });
});
