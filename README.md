# Next-Karya-Backend

# Next Karya Digital Solutions - Backend API Core

Backend REST API resmi untuk operasional Next Karya Digital Solutions, dibangun menggunakan **Express.js (TypeScript)**, **Prisma ORM**, **PostgreSQL**, dan **Redis**.

Dokumentasi arsitektur dan spesifikasi kontrak API dapat dilihat secara lengkap pada folder `docs/`:
- `docs/system-architecture-v1.0.md`: Cetak Biru Arsitektur Sistem Terintegrasi
- `docs/schema-database-v1.1.md`: Struktur 20 Tabel Basis Data PostgreSQL & Prisma ORM
- `docs/api-contracts-v1.0.md`: Kontrak REST API `/api/v1` & Skema Validasi Zod
- `docs/cms-v2.2.md`: Spesifikasi CMS Headless & Manajemen Konten
- `docs/crm-v2.2.md`: Spesifikasi CRM, Follow-up Harian & Beban Kerja Tim
- `docs/analytics-v2.2.md`: Spesifikasi Mesin Pengukur Trafik & Rollup Analitik
- `docs/architecture-desktop-vs-mobile-v1.1.md`: Pembagian Peran Desktop Web vs Mobile Flutter

## 1. Kebutuhan Sistem
- Node.js v20+ atau v24+
- PostgreSQL v15+ (mendukung pooler / Neon)
- Redis v6+ (opsional pada development, otomatis fallback ke in-memory cache)

## 2. Pemasangan & Persiapan Lingkungan

1. Pasang seluruh dependensi:
```bash
npm install
```

2. Konfigurasi file lingkungan:
Salin berkas `.env.example` menjadi `.env`, lalu lengkapi variabel berikut:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="postgresql://user:password@localhost:5432/nextkarya?schema=public"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="kunci-rahasia-jwt-minimal-32-karakter"
WEBHOOK_SECRET="kunci-rahasia-webhook-revalidasi"
FRONTEND_URL="http://localhost:3000"
SITE_ID="nextkarya-main"
UPLOAD_DIR="./uploads"
STORAGE_DRIVER="local"
```

> `JWT_SECRET` dan `WEBHOOK_SECRET` harus sama persis dengan nilai di `frontend/.env.local`.
> Untuk direct upload ke Supabase Storage, gunakan `.env.supabase.example` dan
> ikuti `docs/supabase-setup.md`.

3. Generate Prisma Client:
```bash
npm run db:generate
```

4. Jalankan Seed Database Awal (Akun 3 Staf & Data Master):
```bash
npm run db:seed
```

> Untuk produksi, isi `SEED_DEFAULT_PASSWORD` (minimal 8 karakter) sebelum seed.
> Seed tidak mengubah kata sandi akun yang sudah ada. Ganti kata sandi staf
> setelah login pertama, dan jangan pakai kata sandi contoh di produksi.

## 3. Menjalankan Server

- Mode Pengembangan (Hot Reload dengan `tsx`):
```bash
npm run dev
```

- Kompilasi TypeScript ke Distribusi Produksi:
```bash
npm run build
```

- Menjalankan Server Produksi:
```bash
npm start
```

### Backfill Analitik

Rollup `analytics_daily` dijalankan otomatis setiap jam. Setelah deploy pertama atau setelah perbaikan rollup, isi ulang data historis:

```bash
npm run analytics:backfill -- 90
```

Argumen opsional adalah jumlah hari ke belakang (1–90).

### Test

```bash
npm test
```

## 4. Struktur Rute REST API (/api/v1)
- `GET /api/v1/health`: Cek status kesehatan server
- Publik: `/articles`, `/portfolios`, `/services`, `/faqs`, `/testimonials`, `/pages`, `/leads`, `/analytics/event`
- Autentikasi: `POST /api/v1/auth/login`, `POST /api/v1/users/:id/revoke-sessions`
- CMS: `/posts`, `/portfolios`, `/services`, `/pages`, `/faqs`, `/testimonials`, `/content-snapshots/:id/restore`
- CRM: `/crm/leads`, `/crm/follow-up-today`, `/crm/schedules`
- Media: `GET /api/v1/media`, `POST /api/v1/media/upload-url`, `POST /api/v1/media/confirm`, `PATCH /api/v1/media/:id`, `DELETE /api/v1/media/:id`. `POST /api/v1/media` tetap tersedia sebagai fallback multipart saat `STORAGE_DRIVER=local`.
- Analitik: `/analytics/overview`, `/analytics/pages`, `/analytics/sources`, `/analytics/devices`
- Tanggap Darurat: `/emergency/unpublish`, `/emergency/lock-form`, `/emergency/unlock-form`, `/emergency/banner`, `/emergency/leads/:id/reassign`
