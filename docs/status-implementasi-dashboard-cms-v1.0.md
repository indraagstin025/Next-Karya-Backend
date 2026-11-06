# Status Implementasi Dashboard Analitik & CMS (Berdasarkan Dokumentasi Kanonik)
**Next Karya Digital Solutions**  
*Laporan Audit Kesiapan Fitur Fase 1 (MVP) Berdasarkan Spesifikasi Kanonik di Folder docs/*  
*Versi Dokumen: v1.3 (Batch 1 & 2 Analitik)*  
*Tanggal Audit: 2 November 2026*  
*Pembaruan Terakhir: 6 November 2026*  
*Dokumen Rujukan: `analytics-v2.2.md`, `cms-v2.2.md`, `api-contracts-v1.0.md`, `schema-database-v1.1.md`, `architecture-desktop-vs-mobile-v1.1.md`*

---

## 1. Ringkasan Eksekutif

Dokumen ini menyajikan rekapitulasi lengkap mengenai seluruh fitur, modul, dan arsitektur teknis pada **Dashboard Analitik** dan **Content Management System (CMS)** yang telah diimplementasikan pada Fase 1 (MVP), serta memetakannya terhadap spesifikasi kanonik pada direktori `backend/docs/`. Perbaikan terbaru dan batasan yang masih tersisa dicatat pada Bagian 6.

Implementasi mencakup dua sisi sistem terintegrasi:
1. **Backend Engine (`Next-Karya-Backend`):** Express.js, Prisma ORM, PostgreSQL, Redis Caching, Zod Runtime Validation, dan Rate Limiting.
2. **Frontend Interface (`Next-Karya-Digital`):** Next.js App Router, Tailwind CSS, Shadcn UI, Recharts Data Visualization, dan Beacon Telemetry.

Seluruh data dummy / mock telah dibersihkan secara menyeluruh. Sistem saat ini berjalan murni menggunakan data riil dari basis data atau menampilkan status kosong (*empty state*) yang informatif dan profesional saat belum ada rekaman data.

Pada 6 November 2026, **Batch 1 dan Batch 2 perbaikan analitik** diselesaikan dan diterapkan ke produksi. Batch 1 mencakup akurasi pengunjung dan sesi, validasi origin, breakdown browser/OS, klik layanan/portofolio, serta durasi baca dan porsi trafik pada Top Pages. Batch 2 menambahkan **rentang tanggal kustom** dan **pola jam sibuk**. **Site Selector dilewati** sehingga dashboard tetap berjalan single-site.

---

## 2. Status Implementasi: Dashboard Analitik (`analytics-v2.2.md`)

Berdasarkan spesifikasi pada dokumen `analytics-v2.2.md`, berikut adalah status implementasi per pilar fitur:

### Pilar 1: Metrik Utama Trafik (Top-Line Overview) [STATUS: SELESAI]
* **Pengunjung Harian Unik (Daily Unique Visitors):**
  - *Spesifikasi:* Estimasi perangkat unik per hari tanpa cookie pihak ketiga berbasis IP Hash.
  - *Implementasi:* Setiap event menyimpan `visitorIdHash` 64 karakter dari HMAC-SHA256 atas `site_id`, tanggal Jakarta, dan IP klien. Jika IP tidak tersedia, identitas jatuh ke sesi. Hash dibuat di `src/utils/analytics.ts`; IP mentah tidak disimpan. Rollup menghitung `COUNT(DISTINCT visitorIdHash)` sehingga dua sesi dari IP yang sama tetap dihitung satu pengunjung pada hari tersebut.
* **Total Tayangan Halaman (Pageviews):**
  - *Spesifikasi:* Akumulasi pemuatan halaman publik.
  - *Implementasi:* Tersimpan dan teragregasi secara otomatis. Ditampilkan sebagai sub-informasi pada kartu pengunjung dan widget statistik konten.
* **Sesi Kunjungan (Sessions):**
  - *Spesifikasi:* Sesi aktif dengan ambang batas kedaluwarsa 30 menit.
  - *Implementasi:* Sesi berputar setelah 30 menit tanpa aktivitas. Heartbeat hanya menghitung waktu saat tab terlihat, dikirim berkala, dan di-flush saat tab disembunyikan atau halaman ditutup. Jumlah sesi diteruskan via endpoint `GET /api/v1/analytics/overview`.
* **Rata-rata Durasi Kunjungan (Average Visit Duration):**
  - *Spesifikasi:* Estimasi durasi interaksi tab aktif melalui sinyal detak *heartbeat*.
  - *Implementasi:* Durasi heartbeat per halaman dijumlahkan pada rollup, lalu dibagi jumlah sesi halaman tersebut. Nilai ditampilkan dalam format menit dan detik (`Xm Ys`).
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
  - *Implementasi:* [`TopPagesTable.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/TopPagesTable.tsx) menampilkan data dari `GET /api/v1/analytics/pages`. Setiap baris memuat tayangan, porsi trafik (`sharePercentage`), rata-rata durasi baca (`averageDurationSec`), pengunjung, pantulan, dan konversi. Porsi dihitung dari total tayangan seluruh halaman pada rentang aktif, sedangkan rata-rata durasi berasal dari akumulasi `durationSec` heartbeat dibagi jumlah sesi halaman. Tabel menampilkan pesan kosong bila belum ada kunjungan.
* **Klik Layanan & Portofolio (Content Clicks):**
  - *Spesifikasi:* Mengetahui layanan dan portofolio yang paling sering dibuka pengunjung.
  - *Implementasi:* [`AnalyticsTracker.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/components/AnalyticsTracker.tsx) memeriksa klik tautan internal ke `/layanan` atau `/portofolio`, lalu mengirim event `service_click` atau `portfolio_click` beserta `targetPath`. Backend menyimpan `targetPath` pada `AnalyticsEvent` dan mengagregasikannya di `GET /api/v1/analytics/content-clicks`. Hasilnya tampil di [`ContentClicksCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/ContentClicksCard.tsx). Rincian ini dibatasi retensi event mentah 90 hari.
* **Saluran Rujukan Trafik (Traffic Sources & Referrers):**
  - *Spesifikasi:* Pengelompokan saluran asal pengunjung (Pencarian Organik Google, Media Sosial Instagram, Langsung / Direct, Tautan Mitra / Referral).
  - *Implementasi:* Ditampilkan melalui Donut Chart dan Bar Chart interaktif di [`SalesMetricsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/SalesMetricsCard.tsx) yang bersumber dari `GET /api/v1/analytics/sources`.

### Pilar 4: Demografi & Spesifikasi Teknologi [STATUS: SELESAI FASE 1]
* **Proporsi Tipe Perangkat (Mobile, Desktop, Tablet):**
  - *Implementasi:* `detectDevice()` di [`analytics-beacon.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/lib/analytics-beacon.ts) mengelompokkan lebar layar menjadi mobile (di bawah 768 px), tablet (768 sampai 1023 px), dan desktop (1024 px ke atas). Rollup menyimpan agregat per perangkat di `AnalyticsDaily`.
* **Browser dan Sistem Operasi:**
  - *Implementasi:* [`analytics-core.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/lib/analytics-core.ts) membaca user agent dan mengelompokkan browser (Chrome, Safari, Firefox, Edge, Opera, Samsung Internet, Lainnya) serta sistem operasi (Windows, Android, iOS, macOS, ChromeOS, Linux, Lainnya). Nilai disimpan pada `AnalyticsEvent.browser` dan `AnalyticsEvent.os`, lalu diringkas di `GET /api/v1/analytics/audience` dan ditampilkan di [`AudienceBreakdownCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/AudienceBreakdownCard.tsx). Data historis sebelum 6 November 2026 tampil sebagai "Tidak diketahui" karena kolomnya baru terisi setelah deploy.
* **Sebaran Wilayah Geografis (GeoIP) & Pelacakan UTM Detail:**
  - *Status:* Dijadwalkan untuk **Fase 2** sesuai matriks Bab 4 dokumen `analytics-v2.2.md`.

### Pilar 5: Visualisasi Data, Filter Waktu & Kontrol Tampilan [STATUS: SELESAI]
* **Filter Rentang Waktu Cepat:**
  - *Implementasi:* Tombol `Hari Ini`, `7 Hari`, dan `30 Hari` di header Dashboard. Rentang dihitung dalam zona waktu `Asia/Jakarta` dan memperbarui grafik tanpa memuat ulang seluruh halaman.
* **Rentang Tanggal Kustom (Batch 2):**
  - *Status:* **SELESAI.** Tombol `Kustom` membuka popover berisi input tanggal awal dan akhir, sementara preset `Hari Ini`, `7 Hari`, dan `30 Hari` tetap tersedia. Rentang divalidasi di klien dan backend: maksimal 366 hari, tanggal akhir tidak boleh melewati hari ini, tanggal awal tidak boleh melewati tanggal akhir, dan format tanggal harus valid. Jika rentang melewati 90 hari, popover menampilkan catatan bahwa rincian browser, OS, dan klik konten hanya tersedia untuk 90 hari terakhir.
* **Site Selector:**
  - *Status:* **DILEWATI** berdasarkan keputusan pemilik produk pada 6 November 2026. Dashboard berjalan single-site (`nextkarya-main`). Komponen pemilih situs hanya dirender bila daftar situs berisi lebih dari satu entri, sehingga tidak tampil pada konfigurasi saat ini.
* **Pola Jam Sibuk (Hourly Busy Pattern, Batch 2):**
  - *Status:* **SELESAI.** Tabel `AnalyticsHourly` menyimpan rollup `(site_id, date, hour)` berisi pengunjung, sesi, tayangan, durasi, dan konversi. Cron mengisi dua hari terakhir setiap jam, sedangkan `npm run analytics:backfill -- 90` mengisi data historis. `GET /api/v1/analytics/overview` mengembalikan larik `hourly` 24 jam yang selalu terisi nol, lalu `HourlyPatternChart` menampilkannya di samping tren harian. Nilai pengunjung per jam adalah penjumlahan bucket pengunjung harian, bukan pengunjung unik lintas rentang; karena itu grafik memakai tayangan halaman sebagai ukuran utama.
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

### Pilar 3: Pengelola Media Terpusat (Media Asset Manager) [STATUS: SELESAI FASE 1 + SUPABASE DIRECT UPLOAD]
* **Pustaka Media Universal:**
  - *Implementasi:* Model `Media` menyimpan berkas gambar (WebP, PNG, JPG, SVG) dan PDF dengan partisi `site_id`, pelacakan ukuran file, tipe MIME, serta dimensi resolusi gambar.
* **Integrasi Cloud Storage:**
  - *Implementasi:* Supabase Storage aktif melalui `STORAGE_DRIVER=supabase`. Browser mengunggah byte langsung ke bucket memakai signed upload URL sementara; backend hanya membuat URL, memverifikasi metadata objek, dan menyimpan baris `Media`. CRUD media mencakup daftar, konfirmasi upload, ubah teks alternatif, dan hapus objek. Fallback multipart lokal tetap tersedia saat `STORAGE_DRIVER=local`.

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
| **Analitik** | Multi-Tenancy Dasar (`site_id`) | `analytics-v2.2.md` §1.1 | **SELESAI** | Seluruh event terikat ke `site_id: "nextkarya-main"` |
| **Analitik** | Pelacak Sinyal Ringan (< 2 KB) | `analytics-v2.2.md` §3.1 | **SELESAI** | Non-blocking via `navigator.sendBeacon` |
| **Analitik** | Rate Limiting Telemetri (60 req/min) | `analytics-v2.2.md` §3.2 | **SELESAI** | Mencegah banjir spam bot pada endpoint event |
| **Analitik** | Identitas Pengunjung Harian (IP Hash) | `analytics-v2.2.md` §3.1 | **SELESAI** | HMAC-SHA256 harian, IP mentah tidak disimpan |
| **Analitik** | Sesi 30 Menit & Heartbeat Tab Aktif | `analytics-v2.2.md` §2 (Pilar 1) | **SELESAI** | Durasi hanya dihitung saat tab terlihat |
| **Analitik** | Validasi Origin Telemetri | `analytics-v2.2.md` §3.2 | **SELESAI** | BFF dan backend menolak origin asing dengan `403` |
| **Analitik** | Metrik Top-Line (Views, Visitors, Bounces) | `analytics-v2.2.md` §2 (Pilar 1) | **SELESAI** | Tampil riil dari basis data tanpa data dummy |
| **Analitik** | Pelacakan Konversi WhatsApp & Form | `analytics-v2.2.md` §2 (Pilar 2) | **SELESAI** | Menghitung rasio konversi riil calon klien |
| **Analitik** | Tabel Halaman Populer (*Top Pages*) | `analytics-v2.2.md` §2 (Pilar 3) | **SELESAI** | Peringkat URL dengan tayangan, porsi trafik, durasi baca, pantulan, dan konversi |
| **Analitik** | Klik Layanan & Portofolio | `analytics-v2.2.md` §2 (Pilar 3) | **SELESAI** | Event `service_click` dan `portfolio_click` menyimpan `targetPath` |
| **Analitik** | Saluran Rujukan (*Traffic Sources*) | `analytics-v2.2.md` §2 (Pilar 3) | **SELESAI** | Donut Chart & Bar Chart Google, Sosmed, Direct |
| **Analitik** | Browser & Sistem Operasi | `analytics-v2.2.md` §2 (Pilar 4) | **SELESAI** | Parsing user agent di klien; data mentah 90 hari |
| **Analitik** | Filter Waktu Cepat (Hari Ini, 7d, 30d) | `analytics-v2.2.md` §2 (Pilar 5) | **SELESAI** | Berjalan di peramban staf tanpa bentrok sesi |
| **Analitik** | Rentang Tanggal Kustom (*Custom Date Range*) | `analytics-v2.2.md` §2 (Pilar 5) | **SELESAI** | Popover tanggal, preset cepat, validasi 366 hari dan tanggal masa depan di klien + backend |
| **Analitik** | Pola Jam Sibuk (*Hourly Busy Pattern*) | `analytics-v2.2.md` §2 (Pilar 5) | **SELESAI** | Rollup `AnalyticsHourly` per `(tanggal, jam)`; overview mengembalikan 24 bucket |
| **Analitik** | Pemilih Situs (*Site Selector*) | `analytics-v2.2.md` §2 (Pilar 5) | **DILEWATI** | Dashboard single-site `nextkarya-main`; komponen hanya muncul bila ada lebih dari satu situs |
| **Analitik** | Ekspor Laporan CSV / Excel | `analytics-v2.2.md` §4 (#13) | **FASE 2** | Dialokasikan untuk pelaporan manajemen lanjutan |
| **Analitik** | Pemetaan Wilayah GeoIP & UTM Detail | `analytics-v2.2.md` §4 (#11-12) | **FASE 2** | Dialokasikan untuk kampanye berbayar lanjutan |
| **Analitik** | Portal Mandiri Khusus Akun Klien | `analytics-v2.2.md` §4 (#14) | **FASE 2** | Pembukaan akses klien luar di masa depan |
| **CMS** | Skema Database Multi-Tenant (20 Tabel) | `schema-database-v1.1.md` | **SELESAI** | Skema Prisma terpasang dengan ACID PostgreSQL |
| **CMS** | Manajemen Artikel & Blog | `cms-v2.2.md` §2 (Pilar 1) | **SELESAI** | Editor teks, metadata SEO, kategori, tag, waktu baca |
| **CMS** | Portofolio & Studi Kasus Bisnis | `cms-v2.2.md` §2 (Pilar 1) | **SELESAI** | Metrik keberhasilan, tech stack, dan galeri |
| **CMS** | Layanan, FAQ, Testimoni & Halaman | `cms-v2.2.md` §2 (Pilar 1) | **SELESAI** | Modul terstruktur lengkap siap pakai |
| **CMS** | Auto-Snapshot 5 Versi (Rolling FIFO) | `cms-v2.2.md` §2 (Pilar 2) | **SELESAI** | Pemulihan versi instan (< 5 detik) |
| **CMS** | Soft Delete / Arsip Pengaman | `cms-v2.2.md` §2 (Pilar 2) | **SELESAI** | Menghindari kehilangan data permanen |
| **CMS** | Optimistic Locking (`updatedAt`) | `cms-v2.2.md` §2 (Pilar 6) | **SELESAI** | Melindungi 3 staf dari tabrakan editan bersamaan |
| **CMS** | Emergency Toolkit & Audit Trail | `cms-v2.2.md` §2 (Pilar 6) | **SELESAI** | Takedown 1 sentuhan, kunci form, banner darurat |
| **CMS** | Webhook Revalidation (`x-webhook-secret`) | `cms-v2.2.md` §2 (Pilar 5) | **SELESAI** | Pembersihan cache Next.js aman via HTTP header |
| **CMS** | Penjadwalan Terbit Otomatis (*Scheduled*) | `cms-v2.2.md` §3 (#13) | **FASE 2** | Penerbitan artikel berdasarkan jam masa depan |
| **CMS** | Otomasi 301 Redirect saat Slug Berubah | `cms-v2.2.md` §3 (#15) | **FASE 2** | Deteksi otomatis pembaruan slug URL |

---

## 5. Indeks Berkas Sumber Terkait (*Codebase References*)

### Sisi Backend Engine (`backend/`)
* **Skema & Konfigurasi Basis Data:**
  - [`prisma/schema.prisma`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/prisma/schema.prisma) : Pemodelan 20 tabel entitas lengkap, termasuk `AnalyticsEvent.targetPath`, `browser`, dan `os`.
  - [`prisma/migrations/20261106000000_add_analytics_target_path/migration.sql`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/prisma/migrations/20261106000000_add_analytics_target_path/migration.sql) : Migrasi kolom `targetPath` yang sudah diterapkan di produksi.
  - [`src/config/prisma.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/config/prisma.ts) : Singleton koneksi basis data.
* **Layanan Analitik & Telemetri:**
  - [`src/services/analytics.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/analytics.service.ts) : Agregasi metrik, ranking halaman dengan durasi dan porsi, saluran rujukan, audiens browser/OS, klik konten, dan komparasi periode.
  - [`src/controllers/analytics.controller.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/controllers/analytics.controller.ts) : Handler HTTP untuk overview, pages, sources, devices, audience, dan content-clicks.
  - [`src/routes/v1/analytics.routes.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/routes/v1/analytics.routes.ts) : Rute endpoint analitik berotorisasi.
  - [`src/services/public.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/public.service.ts) : Penerimaan beacon, validasi origin, dan penyimpanan identitas pengunjung.
  - [`src/utils/analytics.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/utils/analytics.ts) : Hash pengunjung harian, rentang tanggal Jakarta, pembacaan IP klien, dan validasi origin.
  - [`src/validators/public.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/validators/public.ts) : Skema event analitik, termasuk `heartbeat`, `targetPath`, dan batas durasi.
  - [`src/cron/index.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/cron/index.ts) : Rollup empat granularitas, agregasi durasi heartbeat, dan pembersihan event mentah 90 hari.
* **Layanan CMS & Penanganan Konten:**
  - [`src/services/cms.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/cms.service.ts) : Logika bisnis artikel, portofolio, layanan, halaman, dan snapshot otomatis.
  - [`src/services/emergency.service.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/backend/src/services/emergency.service.ts) : Operasi toolkit darurat dan audit log.

### Sisi Frontend Interface (`frontend/`)
* **Modul Dashboard Analitik:**
  - [`src/features/dashboard/DashboardView.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/DashboardView.tsx) : Komponen utama dashboard operasional.
  - [`src/features/dashboard/api/dashboardApi.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/api/dashboardApi.ts) : Konsumsi REST API analitik.
  - [`src/features/dashboard/hooks/useDashboard.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/hooks/useDashboard.ts) : Manajemen state filter peramban mandiri.
  - [`src/features/dashboard/components/StatisticsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/StatisticsCard.tsx) : Kartu metrik trafik utama.
  - [`src/features/dashboard/components/SalesMetricsCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/SalesMetricsCard.tsx) : Diagram saluran rujukan dan respon konversi.
  - [`src/features/dashboard/components/TopPagesTable.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/TopPagesTable.tsx) : Tabel peringkat halaman dengan tayangan, porsi, durasi baca, pantulan, dan konversi.
  - [`src/features/dashboard/components/ContentClicksCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/ContentClicksCard.tsx) : Peringkat klik layanan dan portofolio.
  - [`src/features/dashboard/components/AudienceBreakdownCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/AudienceBreakdownCard.tsx) : Distribusi browser dan sistem operasi.
  - [`src/features/dashboard/components/TotalEarningCard.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/TotalEarningCard.tsx) : Estimasi nilai proyek disepakati.
  - [`src/features/dashboard/components/DashboardTransactionTable.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/dashboard/components/DashboardTransactionTable.tsx) : Tabel permohonan konsultasi masuk.
* **Telemetri & Penjejakan Publik:**
  - [`src/lib/analytics-core.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/lib/analytics-core.ts) : Rotasi sesi 30 menit, deteksi browser/OS, klasifikasi klik layanan/portofolio, dan validasi origin.
  - [`src/lib/analytics-beacon.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/lib/analytics-beacon.ts) : Perakitan payload beacon, deteksi perangkat dan sumber trafik, serta pengiriman non-blocking.
  - [`src/components/AnalyticsTracker.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/components/AnalyticsTracker.tsx) : Penjejakan rute publik, heartbeat tab aktif, klik WhatsApp, dan klik layanan/portofolio.
  - [`src/app/api/analytics/event/route.ts`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/app/api/analytics/event/route.ts) : Proksi telemetri dengan validasi origin dan penerusan IP klien.
* **Panel Kerja CMS Terpadu:**
  - [`src/features/cms/CmsWorkspace.tsx`](file:///C:/Users/Indra/Documents/Documents/Proyek-NEXT-KARYA/frontend/src/features/cms/CmsWorkspace.tsx) : Pengendali tab kerja staf internal terpusat.

---

## 6. Catatan Perbaikan v1.1 (2 November 2026)

Audit lanjutan menemukan beberapa cacat implementasi yang membuat sebagian fitur belum berjalan end-to-end. Perbaikan berikut sudah diterapkan:

### 6.1 Analitik
- Rollup cron memakai nama kolom yang salah (`updated_at`, `session_id`, dan seterusnya) serta unique key yang tidak cocok. Rollup ditulis ulang dengan nama kolom camelCase dan `ON CONFLICT (site_id, "date", path, source, device)`.
- Rollup kini menghitung ulang dua hari penuh dan menulis empat granularitas: global, per halaman, per sumber, dan per perangkat. Baris agregat yang dibaca dashboard kini benar-benar dibuat oleh rollup.
- `visitors` dihitung dari `visitorIdHash`, bukan `sessionId`.
- Bounce rate dihitung dari sesi satu halaman tanpa heartbeat atau konversi.
- Event `form_submit` kini dikirim setelah submit form kontak berhasil.
- Tersedia `npm run analytics:backfill -- 90` untuk mengisi ulang data historis.

### 6.2 CRM
- Catatan lead dikirim sebagai `notes` (sebelumnya `note`) sehingga validator menerima.
- Jadwal dikirim dengan format `YYYY-MM-DD` (sebelumnya ISO lengkap) dan PIC wajib dipilih.
- Endpoint `DELETE /api/v1/crm/schedules/:id` ditambahkan beserta activity log.
- Perubahan jadwal dicatat sebagai `SCHEDULE_SHIFTED`.

### 6.3 Form Kontak
- Form kini mengumpulkan nomor WhatsApp wajib; nomor hardcoded dihapus.
- Aksi server tidak lagi mengembalikan sukses saat backend menolak permintaan. Respons 429, validasi, dan kegagalan server kini tampil sebagai pesan gagal yang sesuai.

### 6.4 Keamanan & Konfigurasi
- Fallback secret hardcoded di proxy dan endpoint revalidate dihapus; sistem fail-closed.
- Proxy memverifikasi `iss` dan `aud` token.
- Hashing IP dipisahkan dari modul sesi NAYKON dan memakai `CONTACT_IP_HASH_SECRET`; secret terpisah sudah diisi di `.env.local`.
- Rewrite `/uploads` mengikuti env backend, bukan `localhost`.
- `.env.example` frontend diperbarui.

### 6.5 Test
- Vitest ditambahkan di backend dan frontend.
- Cakupan: agregasi analitik, validator CRM, hapus jadwal, schema kontak, dan validator publik.
- Jumlah test pada tahap awal: 14 backend dan 10 frontend.

### 6.6 Perbaikan lanjutan (2 November 2026)
- Dashboard memakai `Lead.dealValue` asli untuk kartu estimasi nilai dan tabel prospek. Nominal karangan, metode pembayaran palsu, dan persentase tren buatan dihapus.
- Filter tanggal dashboard memakai zona waktu `Asia/Jakarta`, termasuk rentang Hari Ini, 7 Hari, dan 30 Hari.
- Perbandingan periode sebelumnya untuk rentang satu hari kini memakai hari sebelumnya, bukan rentang nol hari.
- Rollup analitik membucket event per tanggal Jakarta, bukan tanggal sesi database, dan menghapus baris lama pada rentang yang dihitung ulang agar data stale tidak tertinggal.
- Backfill diperlukan sekali setelah deploy untuk menyelaraskan bucket tanggal historis.

### 6.7 Penyelesaian Celah CMS dan Dashboard (5 November 2026)
- **Blok kode artikel:** editor menerima blok kode berpagar (tiga backtick) dan renderer publik menampilkannya sebagai `<pre><code>` dengan label bahasa. Sanitasi mempertahankan baris baru dan tab, tetapi tetap membuang karakter kontrol.
- **Artikel terkait:** editor menyediakan pemilih manual maksimal 10 artikel yang disimpan ke `relatedPostIds`. Halaman blog memprioritaskan pilihan manual dan kembali ke artikel sekategori bila kosong.
- **Galeri portofolio:** gambar galeri disimpan di `content.gallery` (maksimal 24), diisi dari Pustaka Media, dan ditampilkan pada halaman detail baru `/portofolio/[slug]`.
- **Detail portofolio:** halaman publik menampilkan ringkasan, dampak bisnis, metrik, teknologi, galeri, tautan proyek, serta metadata canonical dan Open Graph. Sitemap ikut memuat setiap slug portofolio yang terbit.
- **OG image:** artikel memakai `coverUrl`, portofolio memakai thumbnail, lengkap dengan alt text dan Twitter card.
- **Redirect global:** rute catch-all memeriksa tabel `Redirect` untuk setiap path tak dikenal sebelum mengembalikan 404, sehingga pengalihan tidak lagi terbatas pada artikel.
- **Sesi staf 7 hari:** JWT backend, cookie `nk_cms_token`, dan TTL cache versi token memakai masa berlaku 604.800 detik. Sesi bersifat absolut sejak login; perpanjangan otomatis saat ada aktivitas belum diterapkan. Sesi tetap dapat dicabut lebih awal melalui mekanisme darurat `REVOKE_SESSION` yang menaikkan `tokenVersion` staf.
- **Halaman syarat & ketentuan:** `/syarat-ketentuan` membaca halaman CMS bila tersedia dan memakai konten bawaan bila belum diisi. Tautan ditambahkan ke footer dan sitemap.
- **Konsistensi angka:** bounce rate dan conversion rate memakai satu desimal di API dan UI.
- **Publikasi artikel dan cache publik:** seed mengirim revalidasi `all` setelah selesai, sehingga artikel yang baru diisi langsung muncul di halaman publik. Kegagalan API tidak lagi ditampilkan sebagai "belum ada artikel", melainkan pesan gangguan; batas waktu baca konten publik dinaikkan menjadi 8 detik.
- **Ketahanan sesi dashboard:** sesi kedaluwarsa diarahkan ke `/?sesi=berakhir` dan modal login terbuka dengan penjelasan. Kegagalan sementara `/auth/me` menampilkan halaman "Dashboard belum bisa dimuat" dengan tombol coba lagi, bukan mengalihkan staf ke beranda. Kegagalan muat data di sisi klien menampilkan banner dengan tombol coba lagi.
- **Uji publikasi end-to-end:** artikel uji dibuat sebagai draf lewat CMS API, lalu dipublikasikan. Artikel muncul di `/blog` dalam 2 detik tanpa revalidasi manual dan halaman detailnya merespons 200. Setelah artikel uji dihapus, cache direvalidasi dan `/blog` kembali bersih sementara artikel kanonik tetap tampil.

### 6.8 Batch 1 Analitik (6 November 2026)

Batch 1 menutup celah akurasi data dan menambah rincian perilaku yang sebelumnya belum tersedia:

- **Identitas pengunjung harian:** setiap event menyimpan `visitorIdHash`, yaitu HMAC-SHA256 dari `site_id`, tanggal Jakarta, dan IP klien. IP mentah tidak masuk basis data. Bila IP tidak tersedia, identitas memakai `sessionId`. Rollup menghitung `COUNT(DISTINCT visitorIdHash)` per hari.
- **Sesi dan durasi:** sesi berputar setelah 30 menit tanpa aktivitas. Heartbeat 15 detik hanya menambah waktu saat tab terlihat, lalu di-flush setiap 30 detik atau saat tab disembunyikan dan halaman ditutup. Event dengan durasi di bawah 3 detik tidak dikirim.
- **Validasi origin:** BFF Next.js dan backend menolak `Origin` atau `Referer` yang tidak cocok dengan host request atau daftar origin yang diizinkan. Permintaan tanpa header origin tetap diterima untuk webview aplikasi seluler.
- **Browser dan OS:** parsing user agent dilakukan di klien. Hasilnya disimpan di `AnalyticsEvent.browser` dan `AnalyticsEvent.os`, lalu diagregasikan oleh `GET /api/v1/analytics/audience`.
- **Klik layanan dan portofolio:** klik tautan internal ke `/layanan` dan `/portofolio` mengirim `service_click` atau `portfolio_click` dengan `targetPath`. Backend memvalidasi `targetPath` dan menyimpannya untuk laporan `GET /api/v1/analytics/content-clicks`.
- **Top Pages:** endpoint `GET /api/v1/analytics/pages` kini mengembalikan `averageDurationSec` dan `sharePercentage` di samping metrik lama. Keduanya ditampilkan pada tabel Halaman Terpopuler.
- **Retensi:** rollup berjalan setiap jam untuk dua hari terakhir. Event mentah dihapus setelah 90 hari, sehingga rincian browser, OS, dan klik konten mengikuti batas tersebut.

### 6.9 Verifikasi Batch 1

- **Test otomatis:** backend lulus 58 dari 58 test dan frontend lulus 40 dari 40 test. Kedua proyek juga lulus build produksi.
- **Migrasi produksi:** `20261106000000_add_analytics_target_path` diterapkan pada 6 November 2026 pukul 11:21:20 UTC dan tercatat di `_prisma_migrations`.
- **Validasi origin:** permintaan BFF dari origin asing menghasilkan `403`; origin yang diizinkan menghasilkan `200`. Backend juga menolak origin asing dengan `403`.
- **Penyimpanan event:** event uji tersimpan dengan browser Chrome, OS Windows, dan `targetPath` yang benar. Endpoint pages, audience, dan content-clicks merespons `200`. Health check merespons `200` dan tidak ada error pada log kontainer.
- **Pembersihan data:** data sintetis dari pengujian dihapus sampai jumlahnya `0`.

### 6.10 Batch 2 Analitik (6 November 2026)

Batch 2 melengkapi filter waktu dan granularitas visualisasi:

- **Rentang tanggal kustom:** kontrol `Kustom` memakai input tanggal native di popover. Batas 366 hari, penolakan tanggal masa depan, dan urutan tanggal divalidasi di `date-range.ts` serta `validateAnalyticsDateRange()` pada backend. Endpoint laporan menolak rentang tidak valid dengan `400 INVALID_DATE_RANGE`.
- **Pola jam sibuk:** tabel `AnalyticsHourly` menyimpan agregat `(site_id, date, hour)` untuk pengunjung, sesi, tayangan, durasi, dan konversi. `runHourlyAnalyticsRollup()` dijalankan setiap jam untuk dua hari terakhir dan turut dijalankan oleh backfill. `getHourly()` mengembalikan 24 bucket berlabel `00:00` sampai `23:00`, dan `getOverview()` menyertakannya sebagai `hourly`.
- **Tampilan:** `HourlyPatternChart` ditempatkan di samping `TrafficTrendChart`. Grafik memakai tayangan halaman per jam agar perbandingan antar jam tetap bermakna; nilai pengunjung per jam tidak diklaim sebagai pengunjung unik lintas rentang.
- **Zona waktu:** bucket tanggal dan jam dihitung dengan `Asia/Jakarta`, sehingga grafik mengikuti WIB meskipun server berjalan di UTC.

### 6.11 Verifikasi Batch 2

- **Test otomatis:** backend lulus 67 dari 67 test dan frontend lulus 56 dari 56 test. Kedua proyek lulus build produksi. Lint terarah pada berkas Batch 2 bersih; error `react-hooks/set-state-in-effect` di `useCmsData.ts` sudah ada sebelumnya dan tidak berasal dari Batch 2.
- **Migrasi produksi:** `20261106010000_add_analytics_hourly` diterapkan ke Supabase pada 6 November 2026 sekitar 12:03 UTC.
- **Backfill produksi:** `npm run analytics:backfill -- 90` membangun ulang rollup harian dan per jam. Hasilnya 7 baris `analytics_daily` dan 2 baris `analytics_hourly` karena event mentah yang tersedia baru mencakup 6 November 2026 pukul 17:27–18:52 WIB.
- **Runtime API:** pemanggilan `AnalyticsService.getOverview("nextkarya-main", "2026-11-06", "2026-11-06")` di container produksi mengembalikan 24 bucket. Jam 17:00 berisi 7 tayangan, 2 pengunjung, 2 sesi; jam 18:00 berisi 5 tayangan, 2 pengunjung, 1 sesi.
- **Artefak container:** `dist/services/analytics.service.js` pada image backend memuat `getHourly`, dan chunk statis frontend memuat teks `Pola Jam Sibuk`.
- **Health dan log:** health API dan halaman utama merespons `200`; cron mendaftar tanpa error setelah deploy.

### 6.12 Batasan yang masih tersisa

- Backfill analitik perlu dijalankan sekali setelah deploy baru atau pemulihan basis data agar data historis terisi dan bucket Jakarta konsisten.
- Pengujian rollup dilakukan terhadap database pembangunan; belum ada test integrasi otomatis dengan PostgreSQL.
- Cron masih berjalan in-process; deployment multi-instance perlu memindahkannya ke worker.
- Halaman yang tercatat sebelum 6 November 2026 tidak memiliki browser dan OS, sehingga tampil sebagai "Tidak diketahui" sampai ada kunjungan baru.
- Rincian browser, OS, dan klik layanan/portofolio hanya tersedia selama 90 hari karena event mentah dihapus setelah periode itu.
- Identitas pengunjung berbasis IP harian dapat menggabungkan beberapa pengunjung di balik NAT yang sama dan memisahkan satu pengunjung yang berganti IP.
- Pola jam sibuk hanya terisi untuk hari yang memiliki rollup. Backfill awal mencakup 90 hari; hari yang lebih lama tidak dapat direkonstruksi setelah event mentah dihapus.
- **Site Selector dilewati** atas keputusan pemilik produk; dashboard tetap single-site.
- Dokumen ini tidak mengklaim seluruh fitur Fase 2 selesai.

---

## 7. Kesimpulan Hasil Audit

Berdasarkan seluruh kriteria pada dokumen kanonik di direktori `backend/docs/`:
1. **Dashboard Analitik Fase 1 (MVP)** telah diimplementasikan untuk lingkup Fase 1 dengan perbaikan yang didokumentasikan pada Bagian 6. Batch 1 dan Batch 2 analitik sudah live di produksi, mencakup identitas pengunjung harian, sesi heartbeat, validasi origin, breakdown browser/OS, klik layanan/portofolio, durasi dan porsi trafik pada Top Pages, rentang tanggal kustom, serta grafik pola jam sibuk. Site Selector dilewati atas keputusan pemilik produk.
2. **Sistem CMS Fase 1 (MVP)** telah diimplementasikan untuk lingkup Fase 1 dengan perbaikan yang didokumentasikan pada Bagian 6, mencakup manajemen konten multi-entitas berpartisi `site_id`, perlindungan auto-snapshot 5 versi rolling FIFO, pengamanan konflik editan via Optimistic Locking, alur soft delete arsip, dan toolkit darurat.
3. Seluruh fitur **Fase 2** (seperti penjadwalan terbit otomatis, ekspor file CSV/Excel, pemetaan GeoIP kota, dan portal mandiri akun klien) telah terdokumentasi rapi pada batas lingkup rilis berikutnya tanpa mengganggu stabilitas operasional sistem saat ini.
