-- Hourly rollups keep the busy-hour chart cheap to read after raw events expire.
CREATE TABLE "analytics_hourly" (
    "id" BIGSERIAL NOT NULL,
    "site_id" VARCHAR(64) NOT NULL DEFAULT 'nextkarya-main',
    "date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "pageviews" INTEGER NOT NULL DEFAULT 0,
    "visitors" INTEGER NOT NULL DEFAULT 0,
    "sessions" INTEGER NOT NULL DEFAULT 0,
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "analytics_hourly_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "analytics_hourly_site_id_date_hour_key"
ON "analytics_hourly"("site_id", "date", "hour");

CREATE INDEX "analytics_hourly_site_id_date_idx"
ON "analytics_hourly"("site_id", "date");

ALTER TABLE "analytics_hourly"
ADD CONSTRAINT "analytics_hourly_site_id_fkey"
FOREIGN KEY ("site_id") REFERENCES "sites"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
