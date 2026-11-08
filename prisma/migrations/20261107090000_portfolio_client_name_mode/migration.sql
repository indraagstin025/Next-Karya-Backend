-- Mode tampilan nama klien pada portofolio publik.
CREATE TYPE "ClientNameMode" AS ENUM ('FULL', 'MASKED');

ALTER TABLE "portfolios"
ADD COLUMN "clientNameMode" "ClientNameMode" NOT NULL DEFAULT 'FULL';

-- Judul portofolio menjadi nama aplikasi saja, tanpa nama klien.
UPDATE "portfolios"
SET "title" = CASE "slug"
  WHEN 'klinik-pratama-sehat' THEN 'Sistem Reservasi & Profil Klinik'
  WHEN 'pt-mandiri-logistik' THEN 'ERP Pergudangan & Monitoring Armada'
  WHEN 'cv-berkah-pangan' THEN 'Website B2B & Katalog Produk'
  WHEN 'studio-kopi-nusantara' THEN 'Aplikasi Pemesanan & Loyalitas Pelanggan'
  WHEN 'bimbel-prestasi-gemilang' THEN 'Portal Ujian & Pembelajaran Daring'
  WHEN 'toko-ritel-sembako-modern' THEN 'Sistem Kasir POS & Inventaris Multi-Cabang'
  ELSE "title"
END
WHERE "slug" IN (
  'klinik-pratama-sehat',
  'pt-mandiri-logistik',
  'cv-berkah-pangan',
  'studio-kopi-nusantara',
  'bimbel-prestasi-gemilang',
  'toko-ritel-sembako-modern'
);

UPDATE "portfolios"
SET "thumbnailAlt" = "title"
WHERE "slug" IN (
  'klinik-pratama-sehat',
  'pt-mandiri-logistik',
  'cv-berkah-pangan',
  'studio-kopi-nusantara',
  'bimbel-prestasi-gemilang',
  'toko-ritel-sembako-modern'
);

-- Snapshot lama tidak lagi menyimpan data dampak dan teknologi.
UPDATE "content_snapshots"
SET "snapshotPayload" = "snapshotPayload" - 'impactSummary' - 'technologies'
WHERE "entityType" = 'PORTFOLIO';

ALTER TABLE "portfolios"
DROP COLUMN "impactSummary",
DROP COLUMN "technologies";
