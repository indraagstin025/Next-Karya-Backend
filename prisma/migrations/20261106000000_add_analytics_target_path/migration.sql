-- Add the clicked content target for service and portfolio click events.
ALTER TABLE "analytics_events" ADD COLUMN "targetPath" VARCHAR(255);
