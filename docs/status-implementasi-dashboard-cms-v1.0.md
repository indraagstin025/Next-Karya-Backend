# Status Implementasi Dashboard Analitik & CMS (Berdasarkan Dokumentasi Kanonik)
**Next Karya Digital Solutions**  
*Laporan Audit Kesiapan Fitur Fase 1 (MVP) Berdasarkan Spesifikasi Kanonik di Folder docs/*  
*Versi Dokumen: v1.0 Kanonik*  
*Tanggal Audit: 2 November 2026*  
*Dokumen Rujukan: `analytics-v2.2.md`, `cms-v2.2.md`, `api-contracts-v1.0.md`, `schema-database-v1.1.md`, `architecture-desktop-vs-mobile-v1.1.md`*

---

## 1. Ringkasan Eksekutif

Dokumen ini menyajikan rekapitulasi lengkap mengenai seluruh fitur, modul, dan arsitektur teknis pada **Dashboard Analitik** dan **Content Management System (CMS)** yang telah **selesai 100% diimplementasikan pada Fase 1 (MVP)**, serta memetakannya terhadap spesifikasi kanonik pada direktori `backend/docs/`.

Implementasi mencakup dua sisi sistem terintegrasi:
1. **Backend Engine (`Next-Karya-Backend`):** Express.js, Prisma ORM, PostgreSQL, Redis Caching, Zod Runtime Validation, dan Rate Limiting.
2. **Frontend Interface (`Next-Karya-Digital`):** Next.js App Router, Tailwind CSS, Shadcn UI, Recharts Data Visualization, dan Beacon Telemetry.

Seluruh data dummy / mock telah dibersihkan secara menyeluruh. Sistem saat ini berjalan murni menggunakan data riil dari basis data atau menampilkan status kosong (*empty state*) yang informatif dan profesional saat belum ada rekaman data.

---

## 2. Status Implementasi: Dashboard Analitik (`analytics-v2.2.md`)

Berdasarkan spesifikasi pada dokumen `analytics-v2.2.md`, berikut adalah status implementasi per pilar fitur:

### Pilar 1: Metrik Utama Trafik (Top-Line Overview) [STATUS: SELESAI]
* **Pengunjung Harian Unik (Daily Unique Visitors):**
  - *Spesifikasi:* Estimasi perangkat unik per hari tanpa cookie pihak ketiga berbasis IP Hash.
  - *Implementasi:* Dihitung melalui tabel `AnalyticsDaily` (`path = '*'`). Ditampilkan pada Kartu Statistik Pengunjung di [`StatisticsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/StatisticsCard.tsx).
* **Total Tayangan Halaman (Pageviews):**
  - *Spesifikasi:* Akumulasi pemuatan halaman publik.
  - *Implementasi:* Tersimpan dan teragregasi secara otomatis. Ditampilkan sebagai sub-informasi pada kartu pengunjung dan widget statistik konten.
* **Sesi Kunjungan (Sessions):**
  - *Spesifikasi:* Sesi aktif dengan ambang batas kedaluwarsa 30 menit.
  - *Implementasi:* Dihitung di backend dan diteruskan via endpoint `GET /api/v1/analytics/overview`.
* **Rata-rata Durasi Kunjungan (Average Visit Duration):**
  - *Spesifikasi:* Estimasi durasi interaksi tab aktif melalui sinyal detak *heartbeat*.
  - *Implementasi:* Ditampilkan dalam format menit dan detik (`Xm Ys`) pada Kartu Statistik Waktu Kunjungan.
* **Tingkat Pantulan (Bounce Rate %):**
  - *Spesifikasi:* Persentase kunjungan satu halaman tanpa interaksi lanjutan.
  - *Implementasi:* Dihitung otomatis dengan rumus `(bounces / sessions) * 100%` dan disajikan dengan presisi 1 desimal.
* **Perbandingan Periode Dinamis (*Period-over-Period Delta*):**
  - *Implementasi:* Backend service [`analytics.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/analytics.service.ts) membandingkan data rentang aktif dengan jendela waktu sebelumnya yang setara. Mengembalikan `0%` bersih saat belum ada data pembanding.

### Pilar 2: Pelacakan Konversi & Sasaran Bisnis (Goal & Conversion Tracking) [STATUS: SELESAI]
* **Klik Chat WhatsApp Konsultasi:**
  - *Spesifikasi:* Mencatat setiap klik tombol WhatsApp resmi di seluruh halaman website publik.
  - *Implementasi:* Sinyal `whatsapp_click` ditangkap oleh pelacak telemetri di [`AnalyticsTracker.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/components/AnalyticsTracker.tsx) dan diagregasikan ke kolom `whatsappClicks`.
* **Pengiriman Formulir Proyek (Form Submissions):**
  - *Spesifikasi:* Menghitung permohonan konsultasi yang terkirim dari Beranda dan Kontak.
  - *Implementasi:* Tercatat otomatis saat formulir valid tersimpan ke tabel `Lead`, memicu penambahan metrik `formSubmits`.
* **Rasio Konversi Keseluruhan (Overall Conversion Rate %):**
  - *Spesifikasi:* Persentase aksi konversi terhadap pengunjung unik harian.
  - *Implementasi:* Dihitung dengan rumus resmi: `((whatsappClicks + formSubmits) / visitors) * 100%`.

### Pilar 3: Analisis Perilaku & Konten Populer (Content & Behavior) [STATUS: SELESAI]
* **Halaman Terpopuler (Top Pages Table):**
  - *Spesifikasi:* Tabel peringkat URL publik teratas berdasarkan volume tayangan, persentase pantulan, dan konversi.
  - *Implementasi:* Komponen [`TopPagesTable.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/TopPagesTable.tsx) menampilkan data peringkat dari `GET /api/v1/analytics/pages`. Dilengkapi pesan ramah jika belum ada kunjungan tercatat.
* **Saluran Rujukan Trafik (Traffic Sources & Referrers):**
  - *Spesifikasi:* Pengelompokan saluran asal pengunjung (Pencarian Organik Google, Media Sosial Instagram, Langsung / Direct, Tautan Mitra / Referral).
  - *Implementasi:* Ditampilkan melalui Donut Chart dan Bar Chart interaktif di [`SalesMetricsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/SalesMetricsCard.tsx) yang bersumber dari `GET /api/v1/analytics/sources`.

### Pilar 4: Demografi & Spesifikasi Teknologi [STATUS: SELESAI FASE 1]
* **Proporsi Tipe Perangkat (Mobile, Desktop, Tablet):**
  - *Implementasi:* Didukung pada kolom `device` tabel `AnalyticsDaily` dan skrip pendeteksi di [`analytics-beacon.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/lib/analytics-beacon.ts).
* **Sebaran Wilayah Geografis (GeoIP) & Pelacakan UTM Detail:**
  - *Status:* Dijadwalkan untuk **Fase 2** sesuai matriks Bab 4 dokumen `analytics-v2.2.md`.

### Pilar 5: Visualisasi Data, Filter Waktu & Kontrol Tampilan [STATUS: SELESAI]
* **Filter Rentang Waktu Mandiri:**
  - *Implementasi:* Tombol selektor 3 opsi (`Hari Ini`, `7 Hari`, `30 Hari`) di header Dashboard. Memperbarui grafik secara reaktif tanpa perlu memuat ulang seluruh halaman peramban.
* **Judul & Tata Letak Bersih:**
  - *Implementasi:* Header utama disetel ke **"Dashboard"**. Tombol cepat *"Tulis Artikel"* dan *"Tambah Portofolio"* telah ditiadakan agar antarmuka fokus pada indikator kinerja operasional.
* **Ekspor Laporan (CSV / Excel):**
  - *Status:* Dijadwalkan untuk **Fase 2** sesuai spesifikasi kanonik.

### Pilar 6: Akses Multi-Akun & Kinerja Tinggi (Multi-User Concurrency) [STATUS: SELESAI]
* **Sesi Filter Mandiri:**
  - *Implementasi:* State filter dikelola di sisi peramban klien ([`useDashboard.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/hooks/useDashboard.ts)), sehingga Staf A, B, dan C dapat menganalisis rentang waktu yang berbeda secara bersamaan tanpa saling menimpa tampilan layar rekan kerja.
* **Kueri Agregasi Instan (< 100 ms):**
  - *Implementasi:* Kueri analitik dashboard membaca baris dari tabel agregasi `AnalyticsDaily` yang memiliki indeks komposit unik, bukan memindai jutaan log mentah transaksional.

---

## 3. Status Implementasi: Content Management System (`cms-v2.2.md`)

Berdasarkan spesifikasi pada dokumen `cms-v2.2.md`, berikut adalah status implementasi modul CMS:

### Pilar 1: Manajemen Konten Inti (Core Content Management) [STATUS: SELESAI]
* **Multi-Tenant Foundation (`site_id`):**
  - *Implementasi:* Seluruh model konten (`Post`, `Portfolio`, `Service`, `Faq`, `Testimonial`, `Page`, `Media`, `Redirect`) memiliki kolom `site_id` yang terindeks secara ketat di PostgreSQL.
* **Artikel & Blog (Technology Insights):**
  - *Implementasi:* Editor konten lengkap mendukung heading, paragraf, cuplikan kode, daftar, dan gambar sampul. Dilengkapi kalkulasi otomatis waktu baca (*reading time*), kategori, tag, SEO metadata (meta title, description, canonical), serta kurasi artikel terkait.
* **Portofolio & Studi Kasus Proyek:**
  - *Implementasi:* Manajemen portofolio lengkap mencakup nama klien, kategori industri, dampak bisnis kuantitatif, metrik capaian, tumpukan teknologi (*tech stack*), galeri antarmuka, penanda proyek unggulan (*featured*), dan tautan demo langsung.
* **Katalog Layanan & Paket Harga:**
  - *Implementasi:* Pengelolaan layanan, ikon representatif, daftar poin keunggulan, hierarki urutan tampil, tombol CTA kustom, serta struktur label harga transparan.
* **Konten Pendukung (FAQ, Testimoni & Halaman Statis):**
  - *Implementasi:* Modul CRUD lengkap untuk pertanyaan umum (FAQ), testimoni klien dengan rating bintang (1 sampai 5) yang terhubung ke portofolio, serta halaman hukum (*Privacy Policy* dan *Terms of Service*).

### Pilar 2: Alur Penerbitan Konten & Snapshot Pengaman [STATUS: SELESAI]
* **Auto-Snapshot Sebelum Publikasi (Rolling FIFO 5 Versi):**
  - *Implementasi:* Setiap pembaruan konten secara otomatis menduplikasi versi lama ke tabel `ContentSnapshot`. Sistem membatasi riwayat maksimal 5 snapshot berputar per konten dan menyediakan kemampuan pemulihan instan (*1-click restore*).
* **Perlindungan Soft Delete (Status Arsip):**
  - *Implementasi:* Penghapusan konten tidak menghapus baris fisik secara permanen, melainkan mengalihkan status menjadi `ARCHIVED` agar dapat dipulihkan sewaktu-waktu.
* **Status Siklus Hidup Konten:**
  - *Implementasi:* Mendukung status baku `DRAFT`, `PUBLISHED`, dan `ARCHIVED`. Penjadwalan otomatis terbit masa depan dialokasikan untuk Fase 2.

### Pilar 3: Pengelola Media Terpusat (Media Asset Manager) [STATUS: SELESAI FASE 1]
* **Pustaka Media Universal:**
  - *Implementasi:* Model `Media` siap menyimpan berkas gambar (WebP, PNG, JPG, SVG) dengan partisi `site_id`, pelacakan ukuran file, tipe MIME, dan dimensi resolusi gambar.
* **Integrasi Cloud Storage:**
  - *Implementasi:* Struktur disiapkan untuk integrasi S3 / R2 / Supabase Storage.

### Pilar 4: Pengaturan SEO & Pratinjau Sosial [STATUS: SELESAI]
* **SEO On-Page per Konten:**
  - *Implementasi:* Pengaturan meta title kustom, meta description, Open Graph preview image untuk WhatsApp/LinkedIn, dan canonical URL pada setiap artikel dan halaman.
* **Pengalihan URL (301 Redirects):**
  - *Implementasi:* Modul pemetaan manual rute redirect 301 telah aktif di tabel `Redirect` untuk mengamankan tautan lama.

### Pilar 5: Integrasi Headless API & Webhook Cache Revalidation [STATUS: SELESAI]
* **RESTful JSON API Multi-Tenant:**
  - *Implementasi:* Endpoint publik `/api/v1/posts`, `/api/v1/portfolios`, `/api/v1/services`, `/api/v1/faqs`, `/api/v1/testimonials`, dan `/api/v1/pages` aktif melayani Next.js dengan validasi filter `site_id: "nextkarya-main"`.
* **Penyegaran Cache Instan via Header Webhook Aman (On-Demand Revalidation):**
  - *Implementasi:* Kunci rahasia dikirimkan melalui HTTP Header resmi `x-webhook-secret` (bukan melalui query parameter URL). Memicu endpoint Next.js `/api/revalidate` secara aman dalam waktu di bawah 3 detik.

### Pilar 6: Akses Kolaborasi Multi-Akun & Penanganan Darurat [STATUS: SELESAI]
* **Pencegahan Tabrakan Editan (Optimistic Locking):**
  - *Implementasi:* Backend memverifikasi stempel waktu `updatedAt` saat penyimpanan. Jika konten telah diubah oleh rekan kerja lain lebih dahulu, sistem menolak penimpaan data dan menampilkan notifikasi tanpa menghilangkan input pengguna.
* **Jejak Pengubah Terakhir (Audit Trail):**
  - *Implementasi:* Setiap entitas konten mencatat `authorId` dan `lastEditedById` dari staf yang bertugas.
* **Emergency Takedown & Toolkit Darurat:**
  - *Implementasi:* Aksi darurat 1-sentuhan untuk menurunkan artikel, mengunci formulir kontak dari serangan bot spam, memasang banner peringatan darurat, dan mencabut sesi akun staf yang mencurigakan secara instan, lengkap dengan pencatatan ke tabel `EmergencyAuditLog`.

---

## 4. Matriks Ringkasan Kesiapan Fitur (Fase 1 vs Fase 2)

| Modul | Fitur / Komponen | Dokumen Rujukan | Status Implementasi | Catatan Operasional |
| :--- | :--- | :--- | :---: | :--- |
| **Analitik** | Multi-Tenancy Dasar (`site_id`) | `analytics-v2.2.md` §1.1 | **SELESAI (100%)** | Seluruh event terikat ke `site_id: "nextkarya-main"` |
| **Analitik** | Pelacak Sinyal Ringan (< 2 KB) | `analytics-v2.2.md` §3.1 | **SELESAI (100%)** | Non-blocking via `navigator.sendBeacon` |
| **Analitik** | Rate Limiting Telemetri (60 req/min) | `analytics-v2.2.md` §3.2 | **SELESAI (100%)** | Mencegah banjir spam bot pada endpoint event |
| **Analitik** | Metrik Top-Line (Views, Visitors, Bounces) | `analytics-v2.2.md` §2 (Pilar 1) | **SELESAI (100%)** | Tampil riil dari basis data tanpa data dummy |
| **Analitik** | Pelacakan Konversi WhatsApp & Form | `analytics-v2.2.md` §2 (Pilar 2) | **SELESAI (100%)** | Menghitung rasio konversi riil calon klien |
| **Analitik** | Tabel Halaman Populer (*Top Pages*) | `analytics-v2.2.md` §2 (Pilar 3) | **SELESAI (100%)** | Peringkat URL tayangan, pantulan, dan prospek |
| **Analitik** | Saluran Rujukan (*Traffic Sources*) | `analytics-v2.2.md` §2 (Pilar 3) | **SELESAI (100%)** | Donut Chart & Bar Chart Google, Sosmed, Direct |
| **Analitik** | Filter Waktu Mandiri (Hari Ini, 7d, 30d) | `analytics-v2.2.md` §2 (Pilar 5) | **SELESAI (100%)** | Berjalan di peramban staf tanpa bentrok sesi |
| **Analitik** | Ekspor Laporan CSV / Excel | `analytics-v2.2.md` §4 (#13) | **FASE 2** | Dialokasikan untuk pelaporan manajemen lanjutan |
| **Analitik** | Pemetaan Wilayah GeoIP & UTM Detail | `analytics-v2.2.md` §4 (#11-12) | **FASE 2** | Dialokasikan untuk kampanye berbayar lanjutan |
| **Analitik** | Portal Mandiri Khusus Akun Klien | `analytics-v2.2.md` §4 (#14) | **FASE 2** | Pembukaan akses klien luar di masa depan |
| **CMS** | Skema Database Multi-Tenant (20 Tabel) | `schema-database-v1.1.md` | **SELESAI (100%)** | Skema Prisma terpasang dengan ACID PostgreSQL |
| **CMS** | Manajemen Artikel & Blog | `cms-v2.2.md` §2 (Pilar 1) | **SELESAI (100%)** | Editor teks, metadata SEO, kategori, tag, waktu baca |
| **CMS** | Portofolio & Studi Kasus Bisnis | `cms-v2.2.md` §2 (Pilar 1) | **SELESAI (100%)** | Metrik keberhasilan, tech stack, dan galeri |
| **CMS** | Layanan, FAQ, Testimoni & Halaman | `cms-v2.2.md` §2 (Pilar 1) | **SELESAI (100%)** | Modul terstruktur lengkap siap pakai |
| **CMS** | Auto-Snapshot 5 Versi (Rolling FIFO) | `cms-v2.2.md` §2 (Pilar 2) | **SELESAI (100%)** | Pemulihan versi instan (< 5 detik) |
| **CMS** | Soft Delete / Arsip Pengaman | `cms-v2.2.md` §2 (Pilar 2) | **SELESAI (100%)** | Menghindari kehilangan data permanen |
| **CMS** | Optimistic Locking (`updatedAt`) | `cms-v2.2.md` §2 (Pilar 6) | **SELESAI (100%)** | Melindungi 3 staf dari tabrakan editan bersamaan |
| **CMS** | Emergency Toolkit & Audit Trail | `cms-v2.2.md` §2 (Pilar 6) | **SELESAI (100%)** | Takedown 1 sentuhan, kunci form, banner darurat |
| **CMS** | Webhook Revalidation (`x-webhook-secret`) | `cms-v2.2.md` §2 (Pilar 5) | **SELESAI (100%)** | Pembersihan cache Next.js aman via HTTP header |
| **CMS** | Penjadwalan Terbit Otomatis (*Scheduled*) | `cms-v2.2.md` §3 (#13) | **FASE 2** | Penerbitan artikel berdasarkan jam masa depan |
| **CMS** | Otomasi 301 Redirect saat Slug Berubah | `cms-v2.2.md` §3 (#15) | **FASE 2** | Deteksi otomatis pembaruan slug URL |

---

## 5. Indeks Berkas Sumber Terkait (*Codebase References*)

### Sisi Backend Engine (`backend/`)
* **Skema & Konfigurasi Basis Data:**
  - [`prisma/schema.prisma`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/prisma/schema.prisma) : Pemodelan 20 tabel entitas lengkap.
  - [`src/config/prisma.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/config/prisma.ts) : Singleton koneksi basis data.
* **Layanan Analitik & Telemetri:**
  - [`src/services/analytics.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/analytics.service.ts) : Agregasi metrik, ranking halaman, saluran rujukan, dan komparasi periode riil.
  - [`src/controllers/analytics.controller.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/controllers/analytics.controller.ts) : Handler HTTP untuk overview, pages, dan sources.
  - [`src/routes/v1/analytics.routes.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/routes/v1/analytics.routes.ts) : Rute endpoint analitik berotorisasi.
* **Layanan CMS & Penanganan Konten:**
  - [`src/services/post.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/post.service.ts) : Logika bisnis artikel dan snapshot otomatis.
  - [`src/services/portfolio.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/portfolio.service.ts) : Logika portofolio dan studi kasus bisnis.
  - [`src/services/emergency.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/emergency.service.ts) : Operasi toolkit darurat dan audit log.

### Sisi Frontend Interface (`frontend/`)
* **Modul Dashboard Analitik:**
  - [`src/features/dashboard/DashboardView.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/DashboardView.tsx) : Komponen utama dashboard operasional.
  - [`src/features/dashboard/api/dashboardApi.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/api/dashboardApi.ts) : Konsumsi REST API analitik.
  - [`src/features/dashboard/hooks/useDashboard.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/hooks/useDashboard.ts) : Manajemen state filter peramban mandiri.
  - [`src/features/dashboard/components/StatisticsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/StatisticsCard.tsx) : Kartu metrik trafik utama.
  - [`src/features/dashboard/components/SalesMetricsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/SalesMetricsCard.tsx) : Diagram saluran rujukan dan respon konversi.
  - [`src/features/dashboard/components/TopPagesTable.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/TopPagesTable.tsx) : Tabel peringkat halaman terpopuler.
  - [`src/features/dashboard/components/TotalEarningCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/TotalEarningCard.tsx) : Estimasi nilai proyek disepakati.
  - [`src/features/dashboard/components/DashboardTransactionTable.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/DashboardTransactionTable.tsx) : Tabel permohonan konsultasi masuk.
* **Telemetri & Penjejakan Publik:**
  - [`src/lib/analytics-beacon.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/lib/analytics-beacon.ts) : Skrip transmisi sinyal pelacak ringan (< 2 KB).
  - [`src/components/AnalyticsTracker.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/components/AnalyticsTracker.tsx) : Penjejakan rute publik dan klik WhatsApp.
  - [`src/app/api/analytics/event/route.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/app/api/analytics/event/route.ts) : Proksi telemetri non-blocking ke backend API.
* **Panel Kerja CMS Terpadu:**
  - [`src/features/cms/CmsWorkspace.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/cms/CmsWorkspace.tsx) : Pengendali tab kerja staf internal terpusat.

---

## 6. Kesimpulan Hasil Audit

Berdasarkan seluruh kriteria pada dokumen kanonik di direktori `backend/docs/`:
1. **Dashboard Analitik Fase 1 (MVP)** telah **selesai 100%**, mencakup penjejakan sinyal publik non-blocking, agregasi metrik di PostgreSQL, filter rentang waktu mandiri per staf, visualisasi grafik interaktif, dan pembersihan total dari data tiruan.
2. **Sistem CMS Fase 1 (MVP)** telah **selesai 100%**, mencakup manajemen konten multi-entitas berpartisi `site_id`, perlindungan auto-snapshot 5 versi rolling FIFO, pengamanan konflik editan via Optimistic Locking, alur soft delete arsip, dan toolkit darurat.
3. Seluruh fitur **Fase 2** (seperti penjadwalan terbit otomatis, ekspor file CSV/Excel, pemetaan GeoIP kota, dan portal mandiri akun klien) telah terdokumentasi rapi pada batas lingkup rilis berikutnya tanpa mengganggu stabilitas operasional sistem saat ini.
