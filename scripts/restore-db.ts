import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  maskDatabaseTarget,
  TABLE_KEYS,
  verifyBackupFile,
} from "./backup-db";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BATCH_SIZE = 500;

function parseArgs(argv: string[]): {
  file?: string;
  latest: boolean;
  verifyOnly: boolean;
  confirmRestore: boolean;
} {
  let file: string | undefined;
  let latest = false;
  let verifyOnly = false;
  let confirmRestore = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--file" && argv[i + 1]) {
      file = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--file=")) {
      file = arg.slice("--file=".length);
    } else if (arg === "--latest") {
      latest = true;
    } else if (arg === "--verify" || arg === "--dry-run") {
      verifyOnly = true;
    } else if (arg === "--confirm-restore") {
      confirmRestore = true;
    }
  }

  return { file, latest, verifyOnly, confirmRestore };
}

function resolveTargetBackupFile(fileArg: string | undefined, useLatest: boolean): string {
  const backupDir = path.resolve(__dirname, "../backups");

  if (fileArg) {
    const resolved = path.resolve(process.cwd(), fileArg);
    if (path.extname(resolved).toLowerCase() !== ".json") {
      throw new Error("Backup file must have a .json extension.");
    }
    return resolved;
  }

  if (!useLatest) {
    throw new Error(
      "Specify --latest or --file <path-to-backup.json>. Add --verify for integrity check or --confirm-restore to execute restore."
    );
  }

  if (!fs.existsSync(backupDir)) {
    throw new Error(`Backup directory does not exist: ${backupDir}`);
  }

  const candidates = fs
    .readdirSync(backupDir)
    .filter((name) => /^backup-nextkarya-.*\.json$/i.test(name))
    .map((name) => {
      const fullPath = path.join(backupDir, name);
      return { fullPath, mtimeMs: fs.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  if (candidates.length === 0) {
    throw new Error(`No backup-nextkarya-*.json files found in ${backupDir}`);
  }

  return candidates[0].fullPath;
}

async function insertInBatches<T>(
  items: T[],
  inserter: (batch: T[]) => Promise<unknown>
): Promise<void> {
  for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
    const batch = items.slice(offset, offset + BATCH_SIZE);
    await inserter(batch);
  }
}

function toRequiredJsonInput(
  value: Prisma.JsonValue
): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);
}

function toNullableJsonInput(
  value: Prisma.JsonValue | null | undefined
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  if (value === null || value === undefined) {
    return Prisma.DbNull;
  }
  return value as Prisma.InputJsonValue;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const targetFile = resolveTargetBackupFile(options.file, options.latest || options.verifyOnly);

  console.log(`[Restore] Validating backup archive: ${targetFile}`);
  const { archive, fileSha256, companionChecksumVerified } = verifyBackupFile(targetFile);

  console.log(`[Restore] Archive created at: ${archive.metadata.createdAt}`);
  console.log(`[Restore] Tables: ${archive.metadata.totalTables}, Total rows: ${archive.metadata.totalRows}`);
  console.log(`[Restore] File SHA-256: ${fileSha256} (companion .sha256 checked: ${companionChecksumVerified ? "yes" : "not present"})`);
  console.log(`[Restore] Payload SHA-256: ${archive.metadata.tablesSha256} (verified)`);
  console.log("[Restore] Foreign-key referential integrity check: PASSED.");

  if (options.verifyOnly || !options.confirmRestore) {
    if (!options.verifyOnly) {
      console.log(
        "[Restore] Dry-run verification finished. Pass --confirm-restore to replace current database contents with this snapshot."
      );
    }
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set in environment.");
  }

  const prisma = new PrismaClient();
  const dbTarget = maskDatabaseTarget(process.env.DATABASE_URL);
  const startedAt = Date.now();
  const { tables } = archive;

  console.log(`[Restore] Executing transactional restore against: ${dbTarget}`);

  try {
    await prisma.$transaction(
      async (tx) => {
        // Delete child tables before parent tables to satisfy onDelete: Restrict constraints.
        await tx.emergencyAuditLog.deleteMany();
        await tx.rateLimit.deleteMany();
        await tx.analyticsDaily.deleteMany();
        await tx.analyticsEvent.deleteMany();
        await tx.activityLog.deleteMany();
        await tx.projectSchedule.deleteMany();
        await tx.interactionLog.deleteMany();
        await tx.lead.deleteMany();
        await tx.redirect.deleteMany();
        await tx.media.deleteMany();
        await tx.contentSnapshot.deleteMany();
        await tx.page.deleteMany();
        await tx.faq.deleteMany();
        await tx.service.deleteMany();
        await tx.testimonial.deleteMany();
        await tx.portfolio.deleteMany();
        await tx.post.deleteMany();
        await tx.category.deleteMany();
        await tx.user.deleteMany();
        await tx.site.deleteMany();

        // Insert parent tables before dependent child tables.
        await insertInBatches(tables.sites, (batch) =>
          tx.site.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.users, (batch) =>
          tx.user.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.categories, (batch) =>
          tx.category.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.posts, (batch) =>
          tx.post.createMany({
            data: batch.map((r) => ({
              ...r,
              content: toRequiredJsonInput(r.content),
              publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.portfolios, (batch) =>
          tx.portfolio.createMany({
            data: batch.map((r) => ({
              ...r,
              content: toRequiredJsonInput(r.content),
              publishedAt: r.publishedAt ? new Date(r.publishedAt) : null,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.testimonials, (batch) =>
          tx.testimonial.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.services, (batch) =>
          tx.service.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.faqs, (batch) =>
          tx.faq.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.pages, (batch) =>
          tx.page.createMany({
            data: batch.map((r) => ({
              ...r,
              content: toRequiredJsonInput(r.content),
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.contentSnapshots, (batch) =>
          tx.contentSnapshot.createMany({
            data: batch.map((r) => ({
              ...r,
              snapshotPayload: toRequiredJsonInput(r.snapshotPayload),
              createdAt: new Date(r.createdAt),
            })),
          })
        );

        await insertInBatches(tables.media, (batch) =>
          tx.media.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
            })),
          })
        );

        await insertInBatches(tables.redirects, (batch) =>
          tx.redirect.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
            })),
          })
        );

        await insertInBatches(tables.leads, (batch) =>
          tx.lead.createMany({
            data: batch.map((r) => ({
              ...r,
              dealValue: BigInt(r.dealValue),
              nextFollowUpDate: r.nextFollowUpDate ? new Date(r.nextFollowUpDate) : null,
              warrantyExpiryDate: r.warrantyExpiryDate ? new Date(r.warrantyExpiryDate) : null,
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.interactionLogs, (batch) =>
          tx.interactionLog.createMany({
            data: batch.map((r) => ({
              ...r,
              createdAt: new Date(r.createdAt),
            })),
          })
        );

        await insertInBatches(tables.projectSchedules, (batch) =>
          tx.projectSchedule.createMany({
            data: batch.map((r) => ({
              ...r,
              startDate: new Date(r.startDate),
              endDate: new Date(r.endDate),
              createdAt: new Date(r.createdAt),
              updatedAt: new Date(r.updatedAt),
            })),
          })
        );

        await insertInBatches(tables.activityLogs, (batch) =>
          tx.activityLog.createMany({
            data: batch.map((r) => ({
              ...r,
              metadata: toNullableJsonInput(r.metadata),
              createdAt: new Date(r.createdAt),
            })),
          })
        );

        await insertInBatches(tables.analyticsEvents, (batch) =>
          tx.analyticsEvent.createMany({
            data: batch.map((r) => ({
              ...r,
              id: BigInt(r.id),
              occurredAt: new Date(r.occurredAt),
            })),
          })
        );

        await insertInBatches(tables.analyticsDaily, (batch) =>
          tx.analyticsDaily.createMany({
            data: batch.map((r) => ({
              ...r,
              id: BigInt(r.id),
              date: new Date(r.date),
            })),
          })
        );

        await insertInBatches(tables.rateLimits, (batch) =>
          tx.rateLimit.createMany({
            data: batch.map((r) => ({
              ...r,
              expiresAt: new Date(r.expiresAt),
            })),
          })
        );

        await insertInBatches(tables.emergencyAuditLogs, (batch) =>
          tx.emergencyAuditLog.createMany({
            data: batch.map((r) => ({
              ...r,
              previousState: toNullableJsonInput(r.previousState),
              createdAt: new Date(r.createdAt),
            })),
          })
        );

        // Explicit BigInt inserts do not advance PostgreSQL serial sequences automatically.
        await tx.$executeRaw`
          SELECT setval(
            pg_get_serial_sequence('analytics_events', 'id'),
            COALESCE((SELECT MAX(id) FROM analytics_events), 1),
            (SELECT COUNT(*) > 0 FROM analytics_events)
          )
        `;
        await tx.$executeRaw`
          SELECT setval(
            pg_get_serial_sequence('analytics_daily', 'id'),
            COALESCE((SELECT MAX(id) FROM analytics_daily), 1),
            (SELECT COUNT(*) > 0 FROM analytics_daily)
          )
        `;
      },
      {
        maxWait: 20000,
        timeout: 120000,
      }
    );

    const elapsedMs = Date.now() - startedAt;
    console.log(
      `[Restore] Completed atomically in ${elapsedMs} ms (${TABLE_KEYS.length} tables, ${archive.metadata.totalRows} rows restored).`
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[Restore Failed] ${message}`);
    process.exit(1);
  });
}
