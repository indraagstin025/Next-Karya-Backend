-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('BARU', 'DIHUBUNGI', 'PROPOSAL', 'DEAL', 'BATAL');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('PERSIAPAN', 'AKTIF', 'REVISI', 'SELESAI');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STAFF');

-- CreateEnum
CREATE TYPE "EmergencyActionType" AS ENUM ('UNPUBLISH_CONTENT', 'LOCK_CONTACT_FORM', 'UNLOCK_CONTACT_FORM', 'SET_ALERT_BANNER', 'REMOVE_ALERT_BANNER', 'REASSIGN_STAFF', 'REVOKE_SESSION');

-- CreateEnum
CREATE TYPE "ActivityActionType" AS ENUM ('LEAD_STATUS_CHANGED', 'LEAD_DEAL_VALUE_UPDATED', 'LEAD_REASSIGNED', 'SCHEDULE_SHIFTED', 'CONTENT_STATUS_CHANGED');

-- CreateTable
CREATE TABLE "sites" (
    "id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "domain" VARCHAR(255) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFormLocked" BOOLEAN NOT NULL DEFAULT false,
    "alertBanner" TEXT,
    "isAlertActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" VARCHAR(64) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "fullName" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'STAFF',
    "jobTitle" VARCHAR(100) NOT NULL,
    "avatarUrl" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(150) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "excerpt" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "coverUrl" VARCHAR(500),
    "coverAlt" VARCHAR(255),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "readingTimeMinutes" INTEGER NOT NULL DEFAULT 1,
    "relatedPostIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "categoryId" VARCHAR(64) NOT NULL,
    "authorId" VARCHAR(64) NOT NULL,
    "lastEditedById" VARCHAR(64) NOT NULL,
    "seoTitle" VARCHAR(255),
    "seoDescription" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolios" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "clientName" VARCHAR(255) NOT NULL,
    "serviceCategory" VARCHAR(100) NOT NULL,
    "summary" TEXT NOT NULL,
    "impactSummary" TEXT,
    "metricResult" VARCHAR(100),
    "content" JSONB NOT NULL,
    "thumbnailUrl" VARCHAR(500),
    "thumbnailAlt" VARCHAR(255),
    "technologies" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectUrl" VARCHAR(500),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "lastEditedById" VARCHAR(64) NOT NULL,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "portfolios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "icon" VARCHAR(100) NOT NULL,
    "shortDesc" TEXT NOT NULL,
    "features" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceLabel" VARCHAR(100) NOT NULL,
    "priceNote" VARCHAR(255),
    "badge" VARCHAR(100),
    "ctaLabel" VARCHAR(100) NOT NULL DEFAULT 'Konsultasi Sekarang',
    "ctaHref" VARCHAR(255) NOT NULL DEFAULT '/kontak',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "lastEditedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "faqs" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "question" VARCHAR(500) NOT NULL,
    "answer" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL DEFAULT 'Umum',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastEditedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "testimonials" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "clientName" VARCHAR(255) NOT NULL,
    "clientRole" VARCHAR(150),
    "companyName" VARCHAR(255),
    "content" TEXT NOT NULL,
    "avatarUrl" VARCHAR(500),
    "rating" INTEGER NOT NULL DEFAULT 5,
    "portfolioId" VARCHAR(64),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "ContentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "lastEditedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "title" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "content" JSONB NOT NULL,
    "seoTitle" VARCHAR(255),
    "seoDescription" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "lastEditedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_snapshots" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "title" VARCHAR(255) NOT NULL,
    "snapshotPayload" JSONB NOT NULL,
    "savedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "fileName" VARCHAR(255) NOT NULL,
    "originalName" VARCHAR(255) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "url" VARCHAR(500) NOT NULL,
    "altText" VARCHAR(255),
    "uploadedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "redirects" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "sourcePath" VARCHAR(255) NOT NULL,
    "targetPath" VARCHAR(255) NOT NULL,
    "statusCode" INTEGER NOT NULL DEFAULT 301,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "redirects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "clientName" VARCHAR(255) NOT NULL,
    "companyName" VARCHAR(255),
    "whatsappNumber" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255),
    "serviceRequested" VARCHAR(100) NOT NULL,
    "message" TEXT NOT NULL,
    "dealValue" BIGINT NOT NULL DEFAULT 0,
    "status" "LeadStatus" NOT NULL DEFAULT 'BARU',
    "assignedToId" VARCHAR(64),
    "nextFollowUpDate" DATE,
    "warrantyExpiryDate" DATE,
    "stagingUrl" VARCHAR(500),
    "productionUrl" VARCHAR(500),
    "lastEditedById" VARCHAR(64),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interaction_logs" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "leadId" VARCHAR(64) NOT NULL,
    "authorId" VARCHAR(64) NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interaction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_logs" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "actorId" VARCHAR(64) NOT NULL,
    "action" "ActivityActionType" NOT NULL,
    "entityType" VARCHAR(50) NOT NULL,
    "entityId" VARCHAR(64) NOT NULL,
    "summary" VARCHAR(500) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_schedules" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "leadId" VARCHAR(64),
    "taskName" VARCHAR(255) NOT NULL,
    "assignedToId" VARCHAR(64) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'AKTIF',
    "lastEditedById" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "project_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "sessionId" VARCHAR(64) NOT NULL,
    "eventName" VARCHAR(50) NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "referrer" VARCHAR(500),
    "source" VARCHAR(50) NOT NULL DEFAULT 'direct',
    "device" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "browser" VARCHAR(50),
    "os" VARCHAR(50),
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "visitorIdHash" VARCHAR(64) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_daily" (
    "id" BIGSERIAL NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "date" DATE NOT NULL,
    "path" VARCHAR(255) NOT NULL,
    "source" VARCHAR(50) NOT NULL DEFAULT 'direct',
    "device" VARCHAR(20) NOT NULL DEFAULT 'unknown',
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "bounces" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "whatsappClicks" INTEGER NOT NULL DEFAULT 0,
    "formSubmits" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limits" (
    "key" VARCHAR(255) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "emergency_audit_logs" (
    "id" VARCHAR(64) NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "actorId" VARCHAR(64) NOT NULL,
    "actionType" "EmergencyActionType" NOT NULL,
    "targetEntity" VARCHAR(50) NOT NULL,
    "targetId" VARCHAR(64),
    "reason" TEXT NOT NULL,
    "previousState" JSONB,
    "isRolledBack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "emergency_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sites_domain_key" ON "sites"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

-- CreateIndex
CREATE INDEX "categories_site_id_idx" ON "categories"("site_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_site_id_slug_key" ON "categories"("site_id", "slug");

-- CreateIndex
CREATE INDEX "posts_site_id_status_publishedAt_idx" ON "posts"("site_id", "status", "publishedAt");

-- CreateIndex
CREATE INDEX "posts_site_id_categoryId_status_idx" ON "posts"("site_id", "categoryId", "status");

-- CreateIndex
CREATE INDEX "posts_site_id_updatedAt_idx" ON "posts"("site_id", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "posts_site_id_slug_key" ON "posts"("site_id", "slug");

-- CreateIndex
CREATE INDEX "portfolios_site_id_status_isFeatured_sortOrder_idx" ON "portfolios"("site_id", "status", "isFeatured", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "portfolios_site_id_slug_key" ON "portfolios"("site_id", "slug");

-- CreateIndex
CREATE INDEX "services_site_id_status_sortOrder_idx" ON "services"("site_id", "status", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "services_site_id_slug_key" ON "services"("site_id", "slug");

-- CreateIndex
CREATE INDEX "faqs_site_id_isActive_sortOrder_idx" ON "faqs"("site_id", "isActive", "sortOrder");

-- CreateIndex
CREATE INDEX "faqs_site_id_category_idx" ON "faqs"("site_id", "category");

-- CreateIndex
CREATE INDEX "testimonials_site_id_status_sortOrder_idx" ON "testimonials"("site_id", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "pages_site_id_status_idx" ON "pages"("site_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "pages_site_id_slug_key" ON "pages"("site_id", "slug");

-- CreateIndex
CREATE INDEX "content_snapshots_site_id_entityType_entityId_createdAt_ver_idx" ON "content_snapshots"("site_id", "entityType", "entityId", "createdAt", "version");

-- CreateIndex
CREATE INDEX "media_site_id_createdAt_idx" ON "media"("site_id", "createdAt");

-- CreateIndex
CREATE INDEX "media_site_id_mimeType_createdAt_idx" ON "media"("site_id", "mimeType", "createdAt");

-- CreateIndex
CREATE INDEX "media_site_id_originalName_idx" ON "media"("site_id", "originalName");

-- CreateIndex
CREATE UNIQUE INDEX "redirects_site_id_sourcePath_key" ON "redirects"("site_id", "sourcePath");

-- CreateIndex
CREATE INDEX "leads_site_id_nextFollowUpDate_status_assignedToId_idx" ON "leads"("site_id", "nextFollowUpDate", "status", "assignedToId");

-- CreateIndex
CREATE INDEX "leads_site_id_status_createdAt_idx" ON "leads"("site_id", "status", "createdAt");

-- CreateIndex
CREATE INDEX "leads_site_id_warrantyExpiryDate_idx" ON "leads"("site_id", "warrantyExpiryDate");

-- CreateIndex
CREATE INDEX "interaction_logs_site_id_leadId_createdAt_idx" ON "interaction_logs"("site_id", "leadId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_site_id_entityType_entityId_createdAt_idx" ON "activity_logs"("site_id", "entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "activity_logs_site_id_action_createdAt_idx" ON "activity_logs"("site_id", "action", "createdAt");

-- CreateIndex
CREATE INDEX "project_schedules_site_id_assignedToId_startDate_endDate_idx" ON "project_schedules"("site_id", "assignedToId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "analytics_events_site_id_occurredAt_idx" ON "analytics_events"("site_id", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_site_id_sessionId_occurredAt_idx" ON "analytics_events"("site_id", "sessionId", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_site_id_eventName_occurredAt_idx" ON "analytics_events"("site_id", "eventName", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_site_id_visitorIdHash_occurredAt_idx" ON "analytics_events"("site_id", "visitorIdHash", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_events_site_id_os_browser_occurredAt_idx" ON "analytics_events"("site_id", "os", "browser", "occurredAt");

-- CreateIndex
CREATE INDEX "analytics_daily_site_id_date_idx" ON "analytics_daily"("site_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "analytics_daily_site_id_date_path_source_device_key" ON "analytics_daily"("site_id", "date", "path", "source", "device");

-- CreateIndex
CREATE INDEX "rate_limits_site_id_expiresAt_idx" ON "rate_limits"("site_id", "expiresAt");

-- CreateIndex
CREATE INDEX "emergency_audit_logs_site_id_actionType_createdAt_idx" ON "emergency_audit_logs"("site_id", "actionType", "createdAt");

-- CreateIndex
CREATE INDEX "emergency_audit_logs_site_id_targetEntity_targetId_idx" ON "emergency_audit_logs"("site_id", "targetEntity", "targetId");

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "faqs" ADD CONSTRAINT "faqs_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "portfolios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_snapshots" ADD CONSTRAINT "content_snapshots_savedById_fkey" FOREIGN KEY ("savedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "redirects" ADD CONSTRAINT "redirects_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interaction_logs" ADD CONSTRAINT "interaction_logs_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_schedules" ADD CONSTRAINT "project_schedules_lastEditedById_fkey" FOREIGN KEY ("lastEditedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rate_limits" ADD CONSTRAINT "rate_limits_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_audit_logs" ADD CONSTRAINT "emergency_audit_logs_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emergency_audit_logs" ADD CONSTRAINT "emergency_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
