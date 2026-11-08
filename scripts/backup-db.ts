import crypto from "crypto";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  ActivityActionType,
  ClientNameMode,
  ContentStatus,
  EmergencyActionType,
  LeadStatus,
  Prisma,
  PrismaClient,
  ProjectStatus,
  UserRole,
} from "@prisma/client";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export const BACKUP_FORMAT_VERSION = "1.0.0";

export const TABLE_KEYS = [
  "sites",
  "users",
  "categories",
  "posts",
  "portfolios",
  "testimonials",
  "services",
  "faqs",
  "pages",
  "contentSnapshots",
  "media",
  "redirects",
  "leads",
  "interactionLogs",
  "projectSchedules",
  "activityLogs",
  "analyticsEvents",
  "analyticsDaily",
  "rateLimits",
  "emergencyAuditLogs",
] as const;

export type TableKey = (typeof TABLE_KEYS)[number];

export interface SerializedLead {
  id: string;
  site_id: string;
  clientName: string;
  companyName: string | null;
  whatsappNumber: string;
  email: string | null;
  serviceRequested: string;
  message: string;
  dealValue: string;
  status: LeadStatus;
  assignedToId: string | null;
  nextFollowUpDate: string | null;
  warrantyExpiryDate: string | null;
  stagingUrl: string | null;
  productionUrl: string | null;
  lastEditedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SerializedAnalyticsEvent {
  id: string;
  site_id: string;
  sessionId: string;
  eventName: string;
  path: string;
  referrer: string | null;
  source: string;
  device: string;
  browser: string | null;
  os: string | null;
  durationSec: number;
  visitorIdHash: string;
  occurredAt: string;
}

export interface SerializedAnalyticsDaily {
  id: string;
  site_id: string;
  date: string;
  path: string;
  source: string;
  device: string;
  pageviews: number;
  visitors: number;
  sessions: number;
  bounces: number;
  durationSec: number;
  whatsappClicks: number;
  formSubmits: number;
  conversions: number;
}

export interface BackupTables {
  sites: Array<{
    id: string;
    name: string;
    domain: string;
    isActive: boolean;
    isFormLocked: boolean;
    alertBanner: string | null;
    isAlertActive: boolean;
    createdAt: string;
    updatedAt: string;
  }>;
  users: Array<{
    id: string;
    email: string;
    passwordHash: string;
    fullName: string;
    role: UserRole;
    jobTitle: string;
    avatarUrl: string | null;
    isActive: boolean;
    tokenVersion: number;
    createdAt: string;
    updatedAt: string;
  }>;
  categories: Array<{
    id: string;
    site_id: string;
    name: string;
    slug: string;
    createdAt: string;
    updatedAt: string;
  }>;
  posts: Array<{
    id: string;
    site_id: string;
    title: string;
    slug: string;
    excerpt: string;
    content: Prisma.JsonValue;
    coverUrl: string | null;
    coverAlt: string | null;
    tags: string[];
    readingTimeMinutes: number;
    relatedPostIds: string[];
    status: ContentStatus;
    categoryId: string;
    authorId: string;
    lastEditedById: string;
    seoTitle: string | null;
    seoDescription: string | null;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  portfolios: Array<{
    id: string;
    site_id: string;
    title: string;
    slug: string;
    clientName: string;
    clientNameMode: ClientNameMode;
    serviceCategory: string;
    summary: string;
    metricResult: string | null;
    content: Prisma.JsonValue;
    thumbnailUrl: string | null;
    thumbnailAlt: string | null;
    projectUrl: string | null;
    isFeatured: boolean;
    sortOrder: number;
    status: ContentStatus;
    lastEditedById: string;
    publishedAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  testimonials: Array<{
    id: string;
    site_id: string;
    clientName: string;
    clientRole: string | null;
    companyName: string | null;
    content: string;
    avatarUrl: string | null;
    rating: number;
    portfolioId: string | null;
    sortOrder: number;
    status: ContentStatus;
    lastEditedById: string;
    createdAt: string;
    updatedAt: string;
  }>;
  services: Array<{
    id: string;
    site_id: string;
    title: string;
    slug: string;
    icon: string;
    shortDesc: string;
    features: string[];
    badge: string | null;
    ctaLabel: string;
    ctaHref: string;
    sortOrder: number;
    status: ContentStatus;
    lastEditedById: string;
    createdAt: string;
    updatedAt: string;
  }>;
  faqs: Array<{
    id: string;
    site_id: string;
    question: string;
    answer: string;
    category: string;
    sortOrder: number;
    isActive: boolean;
    lastEditedById: string;
    createdAt: string;
    updatedAt: string;
  }>;
  pages: Array<{
    id: string;
    site_id: string;
    title: string;
    slug: string;
    content: Prisma.JsonValue;
    seoTitle: string | null;
    seoDescription: string | null;
    status: ContentStatus;
    lastEditedById: string;
    createdAt: string;
    updatedAt: string;
  }>;
  contentSnapshots: Array<{
    id: string;
    site_id: string;
    entityType: string;
    entityId: string;
    version: number;
    title: string;
    snapshotPayload: Prisma.JsonValue;
    savedById: string;
    createdAt: string;
  }>;
  media: Array<{
    id: string;
    site_id: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    fileSize: number;
    width: number | null;
    height: number | null;
    url: string;
    altText: string | null;
    uploadedById: string;
    createdAt: string;
  }>;
  redirects: Array<{
    id: string;
    site_id: string;
    sourcePath: string;
    targetPath: string;
    statusCode: number;
    createdAt: string;
  }>;
  leads: SerializedLead[];
  interactionLogs: Array<{
    id: string;
    site_id: string;
    leadId: string;
    authorId: string;
    note: string;
    createdAt: string;
  }>;
  projectSchedules: Array<{
    id: string;
    site_id: string;
    leadId: string | null;
    taskName: string;
    assignedToId: string;
    startDate: string;
    endDate: string;
    status: ProjectStatus;
    lastEditedById: string;
    createdAt: string;
    updatedAt: string;
  }>;
  activityLogs: Array<{
    id: string;
    site_id: string;
    actorId: string;
    action: ActivityActionType;
    entityType: string;
    entityId: string;
    summary: string;
    metadata: Prisma.JsonValue | null;
    createdAt: string;
  }>;
  analyticsEvents: SerializedAnalyticsEvent[];
  analyticsDaily: SerializedAnalyticsDaily[];
  rateLimits: Array<{
    key: string;
    site_id: string;
    count: number;
    expiresAt: string;
  }>;
  emergencyAuditLogs: Array<{
    id: string;
    site_id: string;
    actorId: string;
    actionType: EmergencyActionType;
    targetEntity: string;
    targetId: string | null;
    reason: string;
    previousState: Prisma.JsonValue | null;
    isRolledBack: boolean;
    createdAt: string;
  }>;
}

export interface BackupArchive {
  metadata: {
    formatVersion: string;
    createdAt: string;
    siteId: string;
    databaseTarget: string;
    totalTables: number;
    totalRows: number;
    rowCounts: Record<TableKey, number>;
    tablesSha256: string;
  };
  tables: BackupTables;
}

// Prisma returns BigInt for Lead.dealValue, AnalyticsEvent.id, and AnalyticsDaily.id,
// which standard JSON.stringify rejects without a replacer.
export function bigIntJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "bigint" ? value.toString() : value;
}

export function computeSha256(payload: string | Buffer): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

export function maskDatabaseTarget(rawUrl: string | undefined): string {
  if (!rawUrl) return "unconfigured";
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.hostname}${parsed.pathname}`;
  } catch {
    return "configured-connection";
  }
}

export function verifyBackupFile(filePath: string): {
  archive: BackupArchive;
  fileSha256: string;
  companionChecksumVerified: boolean;
} {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Backup file not found: ${resolvedPath}`);
  }

  const rawBuffer = fs.readFileSync(resolvedPath);
  const actualFileSha256 = computeSha256(rawBuffer);

  const companionPath = `${resolvedPath}.sha256`;
  let companionChecksumVerified = false;
  if (fs.existsSync(companionPath)) {
    const expectedLine = fs.readFileSync(companionPath, "utf8").trim();
    const expectedHash = expectedLine.split(/\s+/)[0]?.toLowerCase();
    if (!expectedHash || expectedHash !== actualFileSha256) {
      throw new Error(
        `File SHA-256 mismatch for ${path.basename(resolvedPath)}: expected ${expectedHash}, got ${actualFileSha256}`
      );
    }
    companionChecksumVerified = true;
  }

  const archive = JSON.parse(rawBuffer.toString("utf8")) as BackupArchive;
  if (!archive || typeof archive !== "object" || !archive.metadata || !archive.tables) {
    throw new Error("Invalid backup archive structure: missing metadata or tables.");
  }

  for (const key of TABLE_KEYS) {
    const rows = archive.tables[key];
    if (!Array.isArray(rows)) {
      throw new Error(`Invalid backup archive: table "${key}" is missing or not an array.`);
    }
    const expectedCount = archive.metadata.rowCounts?.[key];
    if (typeof expectedCount === "number" && rows.length !== expectedCount) {
      throw new Error(
        `Row count mismatch on table "${key}": metadata says ${expectedCount}, found ${rows.length}.`
      );
    }
  }

  const recomputedTablesSha256 = computeSha256(
    JSON.stringify(archive.tables, bigIntJsonReplacer)
  );
  if (recomputedTablesSha256 !== archive.metadata.tablesSha256) {
    throw new Error(
      `Internal payload SHA-256 mismatch: expected ${archive.metadata.tablesSha256}, got ${recomputedTablesSha256}`
    );
  }

  verifyReferentialIntegrity(archive.tables);

  return {
    archive,
    fileSha256: actualFileSha256,
    companionChecksumVerified,
  };
}

function verifyReferentialIntegrity(tables: BackupTables): void {
  const siteIds = new Set(tables.sites.map((r) => r.id));
  const userIds = new Set(tables.users.map((r) => r.id));
  const categoryIds = new Set(tables.categories.map((r) => r.id));
  const portfolioIds = new Set(tables.portfolios.map((r) => r.id));
  const leadIds = new Set(tables.leads.map((r) => r.id));

  const assertExists = (set: Set<string>, id: string | null, context: string) => {
    if (id !== null && !set.has(id)) {
      throw new Error(`Referential integrity violation in ${context}: missing target "${id}".`);
    }
  };

  for (const r of tables.categories) {
    assertExists(siteIds, r.site_id, `categories(${r.id}).site_id`);
  }
  for (const r of tables.posts) {
    assertExists(siteIds, r.site_id, `posts(${r.id}).site_id`);
    assertExists(categoryIds, r.categoryId, `posts(${r.id}).categoryId`);
    assertExists(userIds, r.authorId, `posts(${r.id}).authorId`);
    assertExists(userIds, r.lastEditedById, `posts(${r.id}).lastEditedById`);
  }
  for (const r of tables.portfolios) {
    assertExists(siteIds, r.site_id, `portfolios(${r.id}).site_id`);
    assertExists(userIds, r.lastEditedById, `portfolios(${r.id}).lastEditedById`);
  }
  for (const r of tables.testimonials) {
    assertExists(siteIds, r.site_id, `testimonials(${r.id}).site_id`);
    assertExists(portfolioIds, r.portfolioId, `testimonials(${r.id}).portfolioId`);
    assertExists(userIds, r.lastEditedById, `testimonials(${r.id}).lastEditedById`);
  }
  for (const r of tables.services) {
    assertExists(siteIds, r.site_id, `services(${r.id}).site_id`);
    assertExists(userIds, r.lastEditedById, `services(${r.id}).lastEditedById`);
  }
  for (const r of tables.faqs) {
    assertExists(siteIds, r.site_id, `faqs(${r.id}).site_id`);
    assertExists(userIds, r.lastEditedById, `faqs(${r.id}).lastEditedById`);
  }
  for (const r of tables.pages) {
    assertExists(siteIds, r.site_id, `pages(${r.id}).site_id`);
    assertExists(userIds, r.lastEditedById, `pages(${r.id}).lastEditedById`);
  }
  for (const r of tables.contentSnapshots) {
    assertExists(siteIds, r.site_id, `contentSnapshots(${r.id}).site_id`);
    assertExists(userIds, r.savedById, `contentSnapshots(${r.id}).savedById`);
  }
  for (const r of tables.media) {
    assertExists(siteIds, r.site_id, `media(${r.id}).site_id`);
    assertExists(userIds, r.uploadedById, `media(${r.id}).uploadedById`);
  }
  for (const r of tables.redirects) {
    assertExists(siteIds, r.site_id, `redirects(${r.id}).site_id`);
  }
  for (const r of tables.leads) {
    assertExists(siteIds, r.site_id, `leads(${r.id}).site_id`);
    assertExists(userIds, r.assignedToId, `leads(${r.id}).assignedToId`);
    assertExists(userIds, r.lastEditedById, `leads(${r.id}).lastEditedById`);
  }
  for (const r of tables.interactionLogs) {
    assertExists(siteIds, r.site_id, `interactionLogs(${r.id}).site_id`);
    assertExists(leadIds, r.leadId, `interactionLogs(${r.id}).leadId`);
    assertExists(userIds, r.authorId, `interactionLogs(${r.id}).authorId`);
  }
  for (const r of tables.projectSchedules) {
    assertExists(siteIds, r.site_id, `projectSchedules(${r.id}).site_id`);
    assertExists(leadIds, r.leadId, `projectSchedules(${r.id}).leadId`);
    assertExists(userIds, r.assignedToId, `projectSchedules(${r.id}).assignedToId`);
    assertExists(userIds, r.lastEditedById, `projectSchedules(${r.id}).lastEditedById`);
  }
  for (const r of tables.activityLogs) {
    assertExists(siteIds, r.site_id, `activityLogs(${r.id}).site_id`);
    assertExists(userIds, r.actorId, `activityLogs(${r.id}).actorId`);
  }
  for (const r of tables.analyticsEvents) {
    assertExists(siteIds, r.site_id, `analyticsEvents(${r.id}).site_id`);
  }
  for (const r of tables.analyticsDaily) {
    assertExists(siteIds, r.site_id, `analyticsDaily(${r.id}).site_id`);
  }
  for (const r of tables.rateLimits) {
    assertExists(siteIds, r.site_id, `rateLimits(${r.key}).site_id`);
  }
  for (const r of tables.emergencyAuditLogs) {
    assertExists(siteIds, r.site_id, `emergencyAuditLogs(${r.id}).site_id`);
    assertExists(userIds, r.actorId, `emergencyAuditLogs(${r.id}).actorId`);
  }
}

export async function runDatabaseBackup(): Promise<string> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in environment.");
  }

  const prisma = new PrismaClient();
  const startedAt = Date.now();
  const now = new Date();
  const timestampLabel = now.toISOString().replace(/[:.]/g, "-");
  const backupDir = path.resolve(__dirname, "../backups");
  const dbTarget = maskDatabaseTarget(process.env.DATABASE_URL);
  const siteId = process.env.SITE_ID || "nextkarya-main";

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });

  console.log(`[Backup] Connecting to PostgreSQL target: ${dbTarget}`);

  try {
    // RepeatableRead guarantees all 20 tables are exported from a single consistent database snapshot.
    const rawTables = await prisma.$transaction(
      async (tx) => {
        const sites = await tx.site.findMany({ orderBy: { id: "asc" } });
        const users = await tx.user.findMany({ orderBy: { id: "asc" } });
        const categories = await tx.category.findMany({ orderBy: { id: "asc" } });
        const posts = await tx.post.findMany({ orderBy: { id: "asc" } });
        const portfolios = await tx.portfolio.findMany({ orderBy: { id: "asc" } });
        const testimonials = await tx.testimonial.findMany({ orderBy: { id: "asc" } });
        const services = await tx.service.findMany({ orderBy: { id: "asc" } });
        const faqs = await tx.faq.findMany({ orderBy: { id: "asc" } });
        const pages = await tx.page.findMany({ orderBy: { id: "asc" } });
        const contentSnapshots = await tx.contentSnapshot.findMany({ orderBy: { id: "asc" } });
        const media = await tx.media.findMany({ orderBy: { id: "asc" } });
        const redirects = await tx.redirect.findMany({ orderBy: { id: "asc" } });
        const leads = await tx.lead.findMany({ orderBy: { id: "asc" } });
        const interactionLogs = await tx.interactionLog.findMany({ orderBy: { id: "asc" } });
        const projectSchedules = await tx.projectSchedule.findMany({ orderBy: { id: "asc" } });
        const activityLogs = await tx.activityLog.findMany({ orderBy: { id: "asc" } });
        const analyticsEvents = await tx.analyticsEvent.findMany({ orderBy: { id: "asc" } });
        const analyticsDaily = await tx.analyticsDaily.findMany({ orderBy: { id: "asc" } });
        const rateLimits = await tx.rateLimit.findMany({ orderBy: { key: "asc" } });
        const emergencyAuditLogs = await tx.emergencyAuditLog.findMany({ orderBy: { id: "asc" } });

        return {
          sites,
          users,
          categories,
          posts,
          portfolios,
          testimonials,
          services,
          faqs,
          pages,
          contentSnapshots,
          media,
          redirects,
          leads,
          interactionLogs,
          projectSchedules,
          activityLogs,
          analyticsEvents,
          analyticsDaily,
          rateLimits,
          emergencyAuditLogs,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 15000,
        timeout: 60000,
      }
    );

    const serializedTablesJson = JSON.stringify(rawTables, bigIntJsonReplacer);
    const normalizedTables = JSON.parse(serializedTablesJson) as BackupTables;
    const tablesSha256 = computeSha256(serializedTablesJson);

    const rowCounts = {} as Record<TableKey, number>;
    let totalRows = 0;
    for (const key of TABLE_KEYS) {
      const count = normalizedTables[key].length;
      rowCounts[key] = count;
      totalRows += count;
    }

    const archive: BackupArchive = {
      metadata: {
        formatVersion: BACKUP_FORMAT_VERSION,
        createdAt: now.toISOString(),
        siteId,
        databaseTarget: dbTarget,
        totalTables: TABLE_KEYS.length,
        totalRows,
        rowCounts,
        tablesSha256,
      },
      tables: normalizedTables,
    };

    const fileName = `backup-nextkarya-${timestampLabel}.json`;
    const filePath = path.join(backupDir, fileName);
    const formattedJson = `${JSON.stringify(archive, null, 2)}\n`;
    const fileBuffer = Buffer.from(formattedJson, "utf8");
    const fileSha256 = computeSha256(fileBuffer);

    fs.writeFileSync(filePath, fileBuffer, { mode: 0o600 });
    fs.writeFileSync(`${filePath}.sha256`, `${fileSha256}  ${fileName}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });

    verifyBackupFile(filePath);

    const elapsedMs = Date.now() - startedAt;
    const sizeKb = (fileBuffer.byteLength / 1024).toFixed(2);

    console.log(`[Backup] Snapshot completed in ${elapsedMs} ms (${TABLE_KEYS.length} tables, ${totalRows} total rows).`);
    for (const key of TABLE_KEYS) {
      if (rowCounts[key] > 0) {
        console.log(`  - ${key}: ${rowCounts[key]} rows`);
      }
    }
    console.log(`[Backup] File saved: ${filePath} (${sizeKb} KB)`);
    console.log(`[Backup] File SHA-256: ${fileSha256}`);
    console.log(`[Backup] Payload SHA-256: ${tablesSha256}`);
    console.log("[Backup] Self-verification passed (checksum + foreign-key integrity OK).");

    return filePath;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  runDatabaseBackup().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Backup Failed] ${message}`);
    process.exit(1);
  });
}
