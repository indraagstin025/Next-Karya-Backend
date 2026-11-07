-- Harga paket tidak lagi ditampilkan di situs publik. Kolom dihapus agar
-- data dan kontrak CMS tidak menyimpan nilai yang tidak dipakai.
UPDATE "content_snapshots"
SET "snapshotPayload" = "snapshotPayload" - 'priceLabel' - 'priceNote'
WHERE "entityType" = 'SERVICE';

ALTER TABLE "services"
DROP COLUMN "priceLabel",
DROP COLUMN "priceNote";
