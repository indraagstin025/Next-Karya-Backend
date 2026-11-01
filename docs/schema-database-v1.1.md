# Spesifikasi Skema Basis Data PostgreSQL & Prisma (Single Source of Truth)
**Next Karya Digital Solutions**  
*Cetak Biru Struktur 20 Tabel Relasional, Indeks, Konkurensi, Prisma ORM & Raw SQL*  
*Versi: 1.1 Kanonik (Struktur Tabel Relasional PostgreSQL & Prisma ORM)*  
*Tanggal Berlaku: 31 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Prinsip Utama Desain Basis Data

Dokumen ini merupakan satu-satunya sumber kebenaran (*single source of truth*) untuk seluruh pemodelan data PostgreSQL. Seluruh pengembang backend Express.js (TypeScript) dengan Prisma ORM wajib mematuhi aturan baku berikut:

### 1.1 Konvensi Penamaan Kolom
* **Kolom `site_id` (Snake Case):** Wajib ditulis `site_id` (menggunakan garis bawah) di seluruh tabel dan skema relasional. Dilarang mengubahnya menjadi `siteId` agar konsisten dengan parameter REST API, query string, dan header integrasi lintas sistem.
* **Kolom Lainnya (Camel Case):** Seluruh kolom entitas lainnya menggunakan standar camelCase (contoh: `lastEditedById`, `visitorIdHash`, `nextFollowUpDate`) yang dipetakan langsung ke model Prisma dan objek TypeScript.

### 1.2 Multi-Tenancy Sejak Hari Pertama
* Kolom `site_id` bertipe `VARCHAR(64)` wajib hadir dan terindeks di 17 tabel entitas data (konten, media, prospek CRM, jadwal proyek, analitik, hingga log audit). Tiga tabel tingkat sistem yang dikecualikan dari kolom `site_id` adalah `sites` (master tenant), `users` (master kredensial staf), dan `rate_limits` (rekayasa IP).
* Pada Fase 1 (MVP), seluruh baris data menggunakan nilai `site_id: "nextkarya-main"`.
* Skema ini menjamin isolasi data siap pakai saat situs klien ditambahkan pada Fase 2 tanpa perlu migrasi pemecah kode (*zero breaking migration*).

### 1.3 Standar Waktu & Pemisahan Tanggal
* **Stempel Waktu Transaksi:** Seluruh stempel waktu transaksi (`occurredAt`, `createdAt`, `updatedAt`, `publishedAt`) disimpan dalam format UTC menggunakan tipe PostgreSQL `TIMESTAMPTZ(3)`.
* **Kolom Tanggal Murni (DATE):** Kolom penanggalan murni kalender tanpa jam (`nextFollowUpDate` dan `warrantyExpiryDate` pada `leads`, serta `startDate` dan `endDate` pada `project_schedules`) disimpan menggunakan tipe data `DATE`.
* Lapisan antarmuka pengguna (Next.js Desktop Web dan Flutter Mobile) bertugas mengonversi waktu UTC menjadi Waktu Indonesia Barat (WIB / UTC+7) saat disajikan kepada staf.

### 1.4 Satu Peran Tunggal yang Setara (*Single Role: STAFF*)
* Seluruh 3 anggota tim internal (Staf A Programmer, Staf B Desainer, Staf C Project Lead) memiliki hak akses yang setara dan penuh (*full operational permissions*).
* Seluruh staf dapat mengelola CMS, CRM, melihat Analitik, dan memicu *Emergency Toolkit*. Tidak ada fitur operasional harian yang terkunci antar-staf.
* Kolom `role` pada tabel `users` diseragamkan bernilai `STAFF`.

### 1.5 Mekanisme Kolaborasi 3 Staf (*Optimistic Locking*)
* Setiap tabel CMS (`posts`, `portfolios`, `services`, `faqs`, `testimonials`, `pages`) dan CRM (`leads`, `project_schedules`) wajib memiliki kolom `updatedAt` bertipe `DateTime @updatedAt` dan `lastEditedById` bertipe `String` (FK ke `users`).
* Saat pembaruan data dikirimkan, backend memeriksa stempel `updatedAt`. Jika data di basis data memiliki stempel yang lebih baru daripada yang dikirimkan oleh klien, mutasi ditolak dengan HTTP 409 Conflict untuk mencegah penimpaan data tanpa sengaja.

### 1.6 Penghapusan Konten Aman (*Soft Delete*)
* CMS tidak menerapkan *hard delete* (penghapusan baris permanen dari disk).
* Penghapusan artikel, portofolio, layanan, atau testimoni dilakukan dengan mengubah statusnya menjadi `ARCHIVED`. Data arsip tidak akan ditampilkan pada website publik, namun tetap tersimpan untuk kebutuhan jejak riwayat.

### 1.7 Snapshot Riwayat Konten (*Rolling FIFO 5 Versi*)
* Tabel `content_snapshots` menampung salinan konten sebelum proses penerbitan (*pre-publish snapshot*).
* Maksimal 5 rekaman snapshot tersimpan per entitas konten.
* **Aturan Increment & Tie-Breaker:** Nilai kolom `version` dinaikkan otomatis: `version = MAX(version) + 1` untuk entitas tersebut. Jika terjadi stempel waktu `createdAt` yang identik hingga milidetik, penentuan urutan FIFO menggunakan `id` (CUID) dan nomor `version` secara menurun (`ORDER BY createdAt DESC, version DESC`). Snapshot tertua otomatis dihapus saat snapshot ke-6 masuk.

### 1.8 Pemisahan Mesin Analitik & Privasi Pengunjung
* **Tabel Raw Event (`analytics_events`):** Menampung data mentah per kunjungan dengan masa simpan 90 hari (*TTL 90 days*). Dibersihkan otomatis oleh cron job harian pada pukul 02:00 WIB. Bebas PII, hanya menyimpan `visitorIdHash` (hasil enkripsi IP + User Agent + salt harian). Kolom geografis kota ditiadakan pada tabel mentah karena pelacakan GeoIP dialokasikan untuk Fase 2.
* **Tabel Agregasi Harian (`analytics_daily`):** Menampung rangkuman statistik harian dengan indeks unik `[site_id, date, path, source, device]`. Memisahkan konversi menjadi `whatsappClicks` dan `formSubmits`.
* **Breakdown OS & Browser:** Metrik distribusi sistem operasi dan peramban pada Fase 1 diagregasi langsung dari tabel mentah `analytics_events` untuk rentang 30 hari aktif (yang selalu tercover oleh retensi 90 hari).

### 1.9 Pemutusan Sesi Login HP (*Session Revocation*)
* Kolom `tokenVersion` bertipe integer pada tabel `users` digunakan sebagai mekanisme pemutus sesi cepat di Fase 1 (MVP).
* Nilai `tokenVersion` aktif disimpan secara paralel pada cache Redis (`auth:token_ver:{userId}`) untuk verifikasi token JWT O(1) pada setiap request API ke backend Express.js.
* Jika salah satu ponsel staf hilang atau tertinggal, menaikkan nilai `tokenVersion` (via endpoint `POST /api/v1/users/:id/revoke-sessions`) akan memperbarui Redis dan database seketika, membatalkan seluruh token JWT yang beredar untuk staf tersebut pada request milidetik berikutnya.

### 1.10 Kebijakan Hapus Situs (*Cascading vs Restricting*)
* Jika sebuah situs dihapus (misal situs klien di Fase 2 yang sudah selesai kontrak):
  - Data operasional transient (snapshot, media usages, redirects, interaction logs, activity logs, analytics events, analytics daily, rate limits) dihapus otomatis menggunakan `ON DELETE CASCADE`.
  - Data aset inti (posts, portfolios, services, leads, project schedules) dilindungi menggunakan `ON DELETE RESTRICT` agar staf diwajibkan melakukan konfirmasi pencadangan data (*data export*) sebelum situs dapat dihapus total.

---

## 2. Definisi Tipe Enum Baku

Nilai enum di bawah ini harus sama persis antara skema Prisma, validasi Zod, API backend, dan antarmuka Flutter:

### 2.1 `ContentStatus` (Status Konten CMS)
* `DRAFT`: Konten sedang ditulis oleh staf, belum tampil di publik.
* `PUBLISHED`: Konten resmi tayang di website publik.
* `ARCHIVED`: Konten dinonaktifkan atau dihapus (*soft delete*), tidak tampil di publik.

### 2.2 `LeadStatus` (Alur Penjualan / Sales Pipeline CRM)
* `BARU`: Prospek baru masuk dari form web atau WhatsApp, belum dihubungi staf.
* `DIHUBUNGI`: Staf sedang berkomunikasi aktif menggali kebutuhan klien.
* `PROPOSAL`: Dokumen penawaran dan estimasi biaya resmi sudah dikirimkan ke klien.
* `DEAL`: Klien menyetujui penawaran, uang muka dibayar, resmi jadi proyek aktif.
* `BATAL`: Klien menunda pengerjaan atau membatalkan penawaran.

### 2.3 `ProjectStatus` (Status Pengerjaan Proyek pada Timeline)
* `PERSIAPAN`: Perencanaan aset dan materi awal.
* `AKTIF`: Sedang dalam tahap desain atau pengkodean aktif.
* `REVISI`: Tahap pengujian dan penyesuaian akhir bersama klien.
* `SELESAI`: Proyek berhasil diluncurkan (*Go-Live*).

### 2.4 `UserRole` (Hak Akses Pengguna Internal)
* `STAFF`: Akses penuh dan setara untuk seluruh 3 anggota tim internal Next Karya Digital Solutions.

### 2.5 `EmergencyActionType` (Jenis Aksi Darurat)
* `UNPUBLISH_CONTENT`: Penarikan darurat artikel/portofolio sensitif ke draft.
* `LOCK_CONTACT_FORM`: Penguncian formulir kontak publik dan pengalihan ke WhatsApp.
* `UNLOCK_CONTACT_FORM`: Pembukaan kembali formulir kontak publik.
* `SET_ALERT_BANNER`: Pengaktifan strip banner pengumuman darurat di situs publik.
* `REMOVE_ALERT_BANNER`: Penonaktifan strip banner darurat.
* `REASSIGN_STAFF`: Pengalihan penanggung jawab prospek/proyek saat staf berhalangan.
* `REVOKE_SESSION`: Pencabutan darurat seluruh sesi aktif pengguna saat perangkat HP hilang atau tertinggal (menaikkan `tokenVersion` pada tabel `users` dan mencatat log audit darurat dengan target entitas `USER`).

### 2.6 `ActivityActionType` (Jenis Jejak Aktivitas CRM & CMS)
* `LEAD_STATUS_CHANGED`: Perubahan status pada sales pipeline.
* `LEAD_DEAL_VALUE_UPDATED`: Pembaruan estimasi nilai proyek.
* `LEAD_REASSIGNED`: Pengalihan penanggung jawab prospek.
* `SCHEDULE_SHIFTED`: Penggeseran tanggal mulai atau target selesai proyek.
* `CONTENT_STATUS_CHANGED`: Publikasi atau pengarsipan konten.

---

## 3. Rincian Struktur Tabel

### Kelompok 1: Multi-Tenancy & Autentikasi Pengguna

#### Tabel 1: `sites` (Master Multi-Tenant)
Menampung identitas situs web yang dikelola sistem.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id` | Tidak | - | ID unik situs (contoh: `nextkarya-main`) |
| `name` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama situs (contoh: `Next Karya Digital Solutions`) |
| `domain` | `VARCHAR(255)` | `String` | `@unique` | Tidak | - | Domain resmi (contoh: `nextkarya.web.id`) |
| `isActive` | `BOOLEAN` | `Boolean` | - | Tidak | `true` | Status keaktifan situs |
| `isFormLocked` | `BOOLEAN` | `Boolean` | - | Tidak | `false` | Sakelar darurat penguncian form kontak |
| `alertBanner` | `TEXT` | `String?` | - | Ya | `null` | Teks banner pengumuman darurat situs |
| `isAlertActive` | `BOOLEAN` | `Boolean` | - | Tidak | `false` | Status keaktifan banner darurat |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan entri (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Waktu pembaruan terakhir (UTC) |

*Indeks:*
* Primary Key: `[id]`
* Unique Index: `[domain]`

---

#### Tabel 2: `users` (3 Akun Tim Internal Next Karya)
Menampung kredensial login bagi Staf A (Programmer), Staf B (Desainer), dan Staf C (Lead) dengan hak akses setara (`STAFF`).

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik staf |
| `email` | `VARCHAR(255)` | `String` | `@unique` | Tidak | - | Email resmi staf (contoh: `nama@nextkarya.web.id`) |
| `passwordHash` | `VARCHAR(255)` | `String` | - | Tidak | - | Hash sandi aman (bcrypt / argon2) |
| `fullName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama lengkap staf |
| `role` | `VARCHAR(32)` | `UserRole` | - | Tidak | `STAFF` | Hak akses operasional tunggal yang setara |
| `jobTitle` | `VARCHAR(100)` | `String` | - | Tidak | - | Jabatan (Programmer, Desainer, Lead) |
| `avatarUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | URL foto profil staf |
| `isActive` | `BOOLEAN` | `Boolean` | - | Tidak | `true` | Status keaktifan akun |
| `tokenVersion` | `INTEGER` | `Int` | - | Tidak | `0` | Versi token untuk pemutusan sesi cepat HP hilang |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan akun (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Waktu pembaruan akun (UTC) |

*Indeks:*
* Primary Key: `[id]`
* Unique Index: `[email]`
* Index: `[role, isActive]`

---

### Kelompok 2: Manajemen Konten CMS & Portofolio

#### Tabel 3: `categories` (Kategori Artikel CMS)
| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik kategori |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik |
| `name` | `VARCHAR(100)` | `String` | - | Tidak | - | Nama kategori (contoh: Tren Teknologi) |
| `slug` | `VARCHAR(150)` | `String` | - | Tidak | - | Slug URL ramah SEO |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Waktu pembaruan (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Unique Index: `[site_id, slug]`
* Index: `[site_id]`

---

#### Tabel 4: `posts` (Artikel Blog & Edukasi CMS)
Menampung materi artikel publik lengkap dengan tag dinamis, estimasi waktu baca, artikel terkait, *Optimistic Locking*, dan *Soft Delete*.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik artikel |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul artikel |
| `slug` | `VARCHAR(255)` | `String` | - | Tidak | - | Slug URL artikel |
| `excerpt` | `TEXT` | `String` | - | Tidak | - | Ringkasan singkat artikel |
| `content` | `JSONB` | `Json` | - | Tidak | - | Isi dokumen kaya (struktur JSON dijelaskan di Bab 3.1) |
| `coverUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | URL gambar sampul |
| `coverAlt` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Teks alternatif aksesibilitas gambar |
| `tags` | `TEXT[]` | `String[]` | - | Tidak | `{}` | Tag dinamis artikel (contoh: `["nextjs", "cms"]`) |
| `readingTimeMinutes` | `INTEGER` | `Int` | - | Tidak | `1` | Estimasi waktu baca (menit) |
| `relatedPostIds` | `VARCHAR(64)[]` | `String[]` | - | Tidak | `{}` | Daftar ID artikel terkait yang direkomendasikan |
| `status` | `VARCHAR(32)` | `ContentStatus` | - | Tidak | `DRAFT` | DRAFT, PUBLISHED, ARCHIVED |
| `categoryId` | `VARCHAR(64)` | `String` | - | Tidak | - | Relasi ke kategori |
| `authorId` | `VARCHAR(64)` | `String` | - | Tidak | - | Penulis artikel (staf) |
| `lastEditedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf terakhir yang mengubah |
| `seoTitle` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Judul meta untuk mesin pencari |
| `seoDescription` | `TEXT` | `String?` | - | Ya | `null` | Deskripsi meta untuk mesin pencari |
| `publishedAt` | `TIMESTAMPTZ(3)` | `DateTime?` | - | Ya | `null` | Stempel waktu terbit publik (UTC) |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan awal (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `categoryId` merujuk ke `categories(id)` ON DELETE RESTRICT
* Foreign Key: `authorId` merujuk ke `users(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Unique Index: `[site_id, slug]`
* Index: `[site_id, status, publishedAt]` (Kueri artikel publik terbit)
* Index: `[site_id, categoryId, status]`
* Index: `[site_id, updatedAt]`

---

#### Tabel 5: `portfolios` (Studi Kasus Portofolio Digital)
Menampung data portofolio pengerjaan proyek klien lengkap dengan dampak bisnis, metrik terstruktur, dan status featured.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik portofolio |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul studi kasus proyek |
| `slug` | `VARCHAR(255)` | `String` | - | Tidak | - | Slug URL portofolio |
| `clientName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama klien / jenama mitra |
| `serviceCategory` | `VARCHAR(100)` | `String` | - | Tidak | - | Kategori (Web Bisnis, CMS, dll) |
| `summary` | `TEXT` | `String` | - | Tidak | - | Ringkasan solusi & hasil proyek |
| `impactSummary` | `TEXT?` | `String?` | - | Ya | `null` | Penjelasan dampak bisnis nyata |
| `metricResult` | `VARCHAR(100)?` | `String?` | - | Ya | `null` | Metrik keberhasilan terukur (contoh: "+150% konversi") |
| `content` | `JSONB` | `Json` | - | Tidak | - | Rincian pengerjaan teknis (JSON terstruktur) |
| `thumbnailUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Gambar pratinjau kartu |
| `thumbnailAlt` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Teks alt aksesibilitas |
| `technologies` | `TEXT[]` | `String[]` | - | Tidak | `{}` | Daftar teknologi (Next.js, Tailwind, dll) |
| `projectUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Tautan website hasil jadi |
| `isFeatured` | `BOOLEAN` | `Boolean` | - | Tidak | `false` | Ditampilkan di etalase beranda utama |
| `sortOrder` | `INTEGER` | `Int` | - | Tidak | `0` | Urutan penataan kartu portofolio |
| `status` | `VARCHAR(32)` | `ContentStatus` | - | Tidak | `DRAFT` | DRAFT, PUBLISHED, ARCHIVED |
| `lastEditedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf terakhir yang mengubah |
| `publishedAt` | `TIMESTAMPTZ(3)` | `DateTime?` | - | Ya | `null` | Waktu tayang publik (UTC) |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan entri (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Unique Index: `[site_id, slug]`
* Index: `[site_id, status, isFeatured, sortOrder]`

---

#### Tabel 6: `services` (Katalog Layanan & Paket Harga)
Menampung layanan resmi agensi untuk disajikan pada halaman Layanan dan endpoint `GET /api/v1/services`.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik layanan |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama layanan (contoh: Website Bisnis Instan) |
| `slug` | `VARCHAR(255)` | `String` | - | Tidak | - | Slug URL layanan |
| `icon` | `VARCHAR(100)` | `String` | - | Tidak | - | Nama ikon Lucide / identifier ikon 3D |
| `shortDesc` | `TEXT` | `String` | - | Tidak | - | Deskripsi singkat pengantar |
| `features` | `TEXT[]` | `String[]` | - | Tidak | `{}` | Checklist fitur keunggulan |
| `priceLabel` | `VARCHAR(100)` | `String` | - | Tidak | - | Contoh: "Mulai dari Rp 4.500.000" |
| `priceNote` | `VARCHAR(255)?`| `String?` | - | Ya | `null` | Catatan termin / estimasi durasi pengerjaan |
| `badge` | `VARCHAR(100)?`| `String?` | - | Ya | `null` | Label sorotan (contoh: "Paling Populer", "Rekomendasi") |
| `ctaLabel` | `VARCHAR(100)` | `String` | - | Tidak | `Konsultasi Sekarang` | Teks tombol tindakan |
| `ctaHref` | `VARCHAR(255)` | `String` | - | Tidak | `/kontak` | Target tautan tombol |
| `sortOrder` | `INTEGER` | `Int` | - | Tidak | `0` | Urutan tampilan kartu layanan |
| `status` | `VARCHAR(32)` | `ContentStatus` | - | Tidak | `DRAFT` | DRAFT, PUBLISHED, ARCHIVED |
| `lastEditedById`| `VARCHAR(64)` | `String` | - | Tidak | - | Staf pengubah terakhir |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Unique Index: `[site_id, slug]`
* Index: `[site_id, status, sortOrder]`

---

#### Tabel 7: `faqs` (Pertanyaan Umum FAQ)
Menampung daftar pertanyaan sering diajukan untuk disajikan pada halaman publik dan endpoint `GET /api/v1/faqs`.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik FAQ |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `question` | `VARCHAR(500)` | `String` | - | Tidak | - | Kalimat pertanyaan |
| `answer` | `TEXT` | `String` | - | Tidak | - | Jawaban penjelasan lengkap |
| `category` | `VARCHAR(100)` | `String` | - | Tidak | `Umum` | Kategori pertanyaan (Teknis, Biaya, Garansi) |
| `sortOrder` | `INTEGER` | `Int` | - | Tidak | `0` | Urutan tampilan akordion |
| `isActive` | `BOOLEAN` | `Boolean` | - | Tidak | `true` | Toggle keaktifan tampil di publik |
| `lastEditedById`| `VARCHAR(64)` | `String` | - | Tidak | - | Staf pengubah terakhir |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, isActive, sortOrder]`
* Index: `[site_id, category]`

---

#### Tabel 8: `testimonials` (Ulasan & Testimoni Klien)
Menampung ulasan kepuasan klien dengan relasi opsional ke portofolio hasil proyek.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik testimoni |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `clientName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama pemberi ulasan |
| `clientRole` | `VARCHAR(150)?`| `String?` | - | Ya | `null` | Jabatan (contoh: Founder, Manajer IT) |
| `companyName` | `VARCHAR(255)?`| `String?` | - | Ya | `null` | Nama badan usaha / jenama klien |
| `content` | `TEXT` | `String` | - | Tidak | - | Isi kutipan testimoni |
| `avatarUrl` | `VARCHAR(500)?`| `String?` | - | Ya | `null` | Foto profil perwakilan klien |
| `rating` | `INTEGER` | `Int` | - | Tidak | `5` | Nilai bintang (skala 1 - 5) |
| `portfolioId` | `VARCHAR(64)?` | `String?` | - | Ya | `null` | Tautan relasi opsional ke portofolio terkait |
| `sortOrder` | `INTEGER` | `Int` | - | Tidak | `0` | Urutan rotasi kartu |
| `status` | `VARCHAR(32)` | `ContentStatus` | - | Tidak | `PUBLISHED` | Status default `PUBLISHED` karena data testimoni yang diinputkan staf adalah hasil kurasi yang telah disetujui sebelumnya oleh klien untuk langsung tayang di website publik (berbeda dengan draf artikel/halaman yang masih dalam proses penulisan) |
| `lastEditedById`| `VARCHAR(64)` | `String` | - | Tidak | - | Staf pengubah terakhir |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `portfolioId` merujuk ke `portfolios(id)` ON DELETE SET NULL
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, status, sortOrder]`

---

#### Tabel 9: `pages` (Halaman Statis Kustom)
Menampung konten halaman mandiri seperti `/tentang-kami`, `/kebijakan-privasi`, atau `/syarat-ketentuan`.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik halaman |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul halaman statis |
| `slug` | `VARCHAR(255)` | `String` | - | Tidak | - | Slug URL rute halaman |
| `content` | `JSONB` | `Json` | - | Tidak | - | Blok konten kaya terstruktur |
| `seoTitle` | `VARCHAR(255)?`| `String?` | - | Ya | `null` | Judul meta SEO |
| `seoDescription`|`TEXT?` | `String?` | - | Ya | `null` | Deskripsi meta SEO |
| `status` | `VARCHAR(32)` | `ContentStatus` | - | Tidak | `DRAFT` | DRAFT, PUBLISHED, ARCHIVED |
| `lastEditedById`| `VARCHAR(64)` | `String` | - | Tidak | - | Staf pengubah terakhir |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Unique Index: `[site_id, slug]`
* Index: `[site_id, status]`

---

#### Tabel 10: `content_snapshots` (Snapshot Riwayat 5 Versi FIFO)
Menampung salinan cadangan konten sebelum perubahan atau penerbitan.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik snapshot |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `entityType` | `VARCHAR(50)` | `String` | - | Tidak | - | Tipe entitas: `POST`, `PORTFOLIO`, `SERVICE`, `PAGE`, `FAQ`, `TESTIMONIAL` |
| `entityId` | `VARCHAR(64)` | `String` | - | Tidak | - | ID entitas konten asal |
| `version` | `INTEGER` | `Int` | - | Tidak | `1` | Nomor urut versi (otomatis naik) |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul konten pada versi ini |
| `snapshotPayload`| `JSONB` | `Json` | - | Tidak | - | Seluruh data konten dalam bentuk JSON |
| `savedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf yang memicu snapshot |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu penyimpanan snapshot (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Foreign Key: `savedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, entityType, entityId, createdAt, version]` (Kueri daftar versi FIFO)

---

#### Tabel 11: `media` (Pustaka Berkas & Gambar)
Menampung aset gambar dan dokumen lengkap dengan metadata dimensi (lebar & tinggi) dan indeks pencarian.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik media |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik media |
| `fileName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama berkas tersimpan aman di disk/storage |
| `originalName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama berkas asli saat diunggah |
| `mimeType` | `VARCHAR(100)` | `String` | - | Tidak | - | Contoh: `image/webp`, `image/png` |
| `fileSize` | `INTEGER` | `Int` | - | Tidak | - | Ukuran berkas dalam byte |
| `width` | `INTEGER?` | `Int?` | - | Ya | `null` | Lebar gambar dalam piksel (jika gambar) |
| `height` | `INTEGER?` | `Int?` | - | Ya | `null` | Tinggi gambar dalam piksel (jika gambar) |
| `url` | `VARCHAR(500)` | `String` | - | Tidak | - | URL publik berkas |
| `altText` | `VARCHAR(255)?`| `String?` | - | Ya | `null` | Teks alternatif aksesibilitas |
| `uploadedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf pengunggah berkas |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu unggah (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `uploadedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, createdAt]`
* Index: `[site_id, mimeType, createdAt]` (Filter tipe berkas di galeri)
* Index: `[site_id, originalName]` (Pencarian cepat media berdasarkan nama)

---

#### Tabel 12: `redirects` (Pengalihan URL 301 Manual)
| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik aturan |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `sourcePath` | `VARCHAR(255)` | `String` | - | Tidak | - | URL asal (contoh: `/tentang-kami`) |
| `targetPath` | `VARCHAR(255)` | `String` | - | Tidak | - | URL tujuan (contoh: `/about`) |
| `statusCode` | `INTEGER` | `Int` | - | Tidak | `301` | Status HTTP pengalihan |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Unique Index: `[site_id, sourcePath]`

---

### 3.1 Dokumentasi Struktur JSON Konten Kaya (`content` JSONB)
Untuk memastikan keseragaman antara frontend dan backend, kolom `content` pada `posts`, `portfolios`, dan `pages` mematuhi skema terstruktur:

```typescript
// Antarmuka TypeScript Resmi untuk Kolom content JSONB
interface StructuredDocumentContent {
  blocks: Array<
    | { type: 'paragraph'; text: string }
    | { type: 'heading'; level: 2 | 3 | 4; text: string }
    | { type: 'image'; url: string; altText: string; caption?: string; width?: number; height?: number }
    | { type: 'code'; language: string; code: string }
    | { type: 'bulletList'; items: string[] }
    | { type: 'quote'; quote: string; author?: string }
    | { type: 'callout'; variant: 'info' | 'warning' | 'tip'; text: string }
  >;
}
```

---

### Kelompok 3: CRM & Jadwal Beban Kerja Tim

#### Tabel 13: `leads` (Kotak Masuk Prospek & Pipeline CRM)
Menampung prospek klien dengan indeks cepat untuk Agenda Follow-Up (< 150ms). Batasan teks pesan (maksimal 2.000 karakter) dan format nomor WhatsApp divalidasi ketat di lapisan Zod API sebelum masuk ke database.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik prospek |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Asal situs (Next Karya / Klien) |
| `clientName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama perwakilan klien |
| `companyName` | `VARCHAR(255)?`| `String?` | - | Ya | `null` | Nama badan usaha / bisnis klien |
| `whatsappNumber`| `VARCHAR(50)` | `String` | - | Tidak | - | Nomor WhatsApp (format divalidasi via Zod) |
| `email` | `VARCHAR(255)?`| `String?` | - | Ya | `null` | Alamat email resmi klien |
| `serviceRequested`| `VARCHAR(100)`| `String` | - | Tidak | - | Layanan yang diminati |
| `message` | `TEXT` | `String` | - | Tidak | - | Pesan awal (maks 2.000 char via Zod) |
| `dealValue` | `BIGINT` | `BigInt` | - | Tidak | `0` | Estimasi nilai proyek (Rupiah) |
| `status` | `VARCHAR(32)` | `LeadStatus` | - | Tidak | `BARU` | BARU, DIHUBUNGI, PROPOSAL, DEAL, BATAL |
| `assignedToId` | `VARCHAR(64)?` | `String?` | - | Ya | `null` | Penanggung jawab (Staf A, B, atau C) |
| `nextFollowUpDate`| `DATE?` | `DateTime?` | `@db.Date` | Ya | `null` | Jadwal follow-up berikutnya (UTC Date) |
| `warrantyExpiryDate`| `DATE?`| `DateTime?` | `@db.Date` | Ya | `null` | Batas akhir garansi purnajual |
| `stagingUrl` | `VARCHAR(500)?`| `String?` | - | Ya | `null` | Tautan proyek staging |
| `productionUrl` | `VARCHAR(500)?`| `String?` | - | Ya | `null` | Tautan proyek live |
| `lastEditedById`| `VARCHAR(64)?` | `String?` | - | Ya | `null` | Staf terakhir pengubah status |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pesan masuk (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `assignedToId` merujuk ke `users(id)` ON DELETE SET NULL
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE SET NULL
* **Indeks Kritis Kinerja (< 150ms):**  
  `[site_id, nextFollowUpDate, status, assignedToId]` (Mendukung halaman "Agenda Follow-Up Hari Ini")
* Index: `[site_id, status, createdAt]` (Kueri urutan pipeline umum)
* Index: `[site_id, warrantyExpiryDate]` (Pemantauan jatuh tempo garansi)

---

#### Tabel 14: `interaction_logs` (Catatan Kualitatif Diskusi CRM)
Menampung catatan percakapan manual staf dengan klien per tanggal.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik catatan |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `leadId` | `VARCHAR(64)` | `String` | - | Tidak | - | Relasi ke prospek |
| `authorId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf pembuat catatan |
| `note` | `TEXT` | `String` | - | Tidak | - | Hasil obrolan / catatan negosiasi |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pencatatan (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Foreign Key: `leadId` merujuk ke `leads(id)` ON DELETE CASCADE
* Foreign Key: `authorId` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, leadId, createdAt]`

---

#### Tabel 15: `activity_logs` (Jejak Aktivitas Otomatis CRM & CMS)
Mencatat riwayat mutasi otomatis saat status prospek berubah, nilai deal diperbarui, staf dialihkan, atau jadwal bergeser.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik aktivitas |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `actorId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf yang melakukan aksi |
| `action` | `VARCHAR(50)` | `ActivityActionType` | - | Tidak | - | Jenis perubahan |
| `entityType` | `VARCHAR(50)` | `String` | - | Tidak | - | `LEAD`, `PROJECT_SCHEDULE`, `POST` |
| `entityId` | `VARCHAR(64)` | `String` | - | Tidak | - | ID entitas yang berubah |
| `summary` | `VARCHAR(500)` | `String` | - | Tidak | - | Kalimat ringkasan riwayat |
| `metadata` | `JSONB?` | `Json?` | - | Ya | `null` | Nilai lama dan baru `{ oldVal, newVal }` |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu aksi terjadi (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Foreign Key: `actorId` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, entityType, entityId, createdAt]`
* Index: `[site_id, action, createdAt]`

---

#### Tabel 16: `project_schedules` (Timeline Beban Kerja Tim / Gantt)
Menampung alokasi pengerjaan proyek per anggota tim.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik jadwal |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `leadId` | `VARCHAR(64)?` | `String?` | - | Ya | `null` | Relasi opsional ke kartu prospek deal |
| `taskName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama tugas (contoh: Desain UI Portal Web) |
| `assignedToId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf pelaksana (Programmer, Desainer, Lead) |
| `startDate` | `DATE` | `DateTime` | `@db.Date` | Tidak | - | Tanggal mulai pengerjaan |
| `endDate` | `DATE` | `DateTime` | `@db.Date` | Tidak | - | Tanggal target selesai |
| `status` | `VARCHAR(32)` | `ProjectStatus` | - | Tidak | `AKTIF` | PERSIAPAN, AKTIF, REVISI, SELESAI |
| `lastEditedById`|`VARCHAR(64)` | `String` | - | Tidak | - | Staf terakhir pengubah jadwal |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `leadId` merujuk ke `leads(id)` ON DELETE SET NULL
* Foreign Key: `assignedToId` merujuk ke `users(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, assignedToId, startDate, endDate]` (Kueri beban kerja tim Gantt)

---

### Kelompok 4: Dashboard Analitik & Pengaman Anti-Spam

#### Tabel 17: `analytics_events` (Raw Event Kunjungan, TTL 90 Hari)
Menampung sinyal kunjungan mentah yang dikirim via `navigator.sendBeacon`. Bebas PII dan tidak ada kolom kota di Fase 1. Dilengkapi `sessionId` dan `durationSec` untuk menjamin kalkulasi sesi dan rasio pantulan (*bounce*) 100% akurat.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BIGSERIAL` | `BigInt` | `@id @default(autoincrement())` | Tidak | Auto | ID autoincrement efisien |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `sessionId` | `VARCHAR(64)` | `String` | - | Tidak | - | ID sesi peramban (direset jika tidak aktif > 30 menit) |
| `eventName` | `VARCHAR(50)` | `String` | - | Tidak | - | `pageview`, `whatsapp_click`, `form_submit` |
| `path` | `VARCHAR(255)` | `String` | - | Tidak | - | Path URL yang dikunjungi (contoh: `/layanan`) |
| `referrer` | `VARCHAR(500)?`| `String?` | - | Ya | `null` | Rujukan URL asal pengunjung |
| `source` | `VARCHAR(50)` | `String` | - | Tidak | `direct` | `google`, `instagram`, `direct`, `referral` |
| `device` | `VARCHAR(20)` | `String` | - | Tidak | `unknown` | `mobile`, `desktop`, `tablet` |
| `browser` | `VARCHAR(50)?` | `String?` | - | Ya | `null` | Chrome, Safari, Edge, Firefox |
| `os` | `VARCHAR(50)?` | `String?` | - | Ya | `null` | Android, iOS, Windows, macOS |
| `durationSec` | `INTEGER` | `Int` | - | Tidak | `0` | Durasi aktif halaman (detik) dari detak beacon |
| `visitorIdHash` | `VARCHAR(64)` | `String` | - | Tidak | - | Hash anonim (IP + UA + salt harian) |
| `occurredAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu sinyal diterima (UTC) |

*Indeks:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Index: `[site_id, occurredAt]` (Pembersihan harian TTL 90 hari pada pukul 02:00 WIB)
* Index: `[site_id, sessionId, occurredAt]` (Mendukung pengelompokan sesi akurat)
* Index: `[site_id, eventName, occurredAt]`
* Index: `[site_id, visitorIdHash, occurredAt]`
* Index: `[site_id, os, browser, occurredAt]` (Mendukung kueri demografi 30 hari)

---

#### Tabel 18: `analytics_daily` (Agregasi Harian Cepat Dashboard)
Menampung data teragregasi untuk menyajikan kueri grafik 30 hari secara instan (< 100 milidetik). Memuat baris per-halaman untuk analisis konten populer serta baris khusus tingkat situs (`path = '*'`) yang menyimpan angka pengunjung unik dan sesi yang sudah terdeduplikasi murni.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BIGSERIAL` | `BigInt` | `@id @default(autoincrement())` | Tidak | Auto | ID autoincrement |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `date` | `DATE` | `DateTime` | `@db.Date` | Tidak | - | Tanggal agregasi (UTC Date) |
| `path` | `VARCHAR(255)` | `String` | - | Tidak | - | Path halaman atau `'*'` untuk total situs |
| `source` | `VARCHAR(50)` | `String` | - | Tidak | `direct` | Saluran rujukan trafik (atau `'all'` pada ringkasan) |
| `device` | `VARCHAR(20)` | `String` | - | Tidak | `unknown` | Jenis perangkat (atau `'all'` pada ringkasan) |
| `pageviews` | `INTEGER` | `Int` | - | Tidak | `0` | Akumulasi total tayangan halaman |
| `visitors` | `INTEGER` | `Int` | - | Tidak | `0` | Total Daily Unique Visitors pada dimensi tersebut |
| `sessions` | `INTEGER` | `Int` | - | Tidak | `0` | Total sesi aktif (`COUNT(DISTINCT sessionId)`) |
| `bounces` | `INTEGER` | `Int` | - | Tidak | `0` | Sesi 1 tayangan dengan durasi < 10 detik |
| `durationSec` | `INTEGER` | `Int` | - | Tidak | `0` | Akumulasi durasi waktu aktif (detik) |
| `whatsappClicks`| `INTEGER` | `Int` | - | Tidak | `0` | Total klik WhatsApp konsultasi |
| `formSubmits` | `INTEGER` | `Int` | - | Tidak | `0` | Total pengiriman form konsultasi |
| `conversions` | `INTEGER` | `Int` | - | Tidak | `0` | Total aksi konversi (`whatsappClicks + formSubmits`) |

*Indeks:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* **Indeks Unik Agregasi Wajib:**  
  `[site_id, date, path, source, device]`
* Index: `[site_id, date]` (Kueri rentang filter dashboard: 7 hari, 30 hari)
* Index: `[site_id, date, path]` (Kueri instan kartu metrik ringkasan via `path = '*'`)

---

#### Tabel 19: `rate_limits` (Penyimpanan Rate Limit Sliding-Window)
Menampung counter pembatasan akses bot per IP untuk form CRM dan endpoint analitik, lengkap dengan foreign key ke `sites`.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `key` | `VARCHAR(255)` | `String` | `@id` | Tidak | - | Format: `[site_id:action:ipAddress]` |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `count` | `INTEGER` | `Int` | - | Tidak | `1` | Jumlah request dalam jendela aktif |
| `expiresAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | - | Waktu kadaluarsa jendela (UTC) |

*Indeks & Relasi:*
* Primary Key: `[key]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Index: `[site_id, expiresAt]`

---

### Kelompok 5: Keamanan & Tanggap Darurat (*Emergency Toolkit*)

#### Tabel 20: `emergency_audit_logs` (Jejak Audit Aksi Darurat & Rollback)
Mencatat seluruh aksi takedown konten, penguncian form, banner darurat, pengalihan tugas staf, serta pencabutan darurat sesi login mobile staf (`REVOKE_SESSION`).

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik log audit |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs tempat insiden terjadi |
| `actorId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf yang mengeksekusi aksi |
| `actionType` | `VARCHAR(50)` | `EmergencyActionType` | - | Tidak | - | Jenis tindakan darurat |
| `targetEntity` | `VARCHAR(50)` | `String` | - | Tidak | - | Entitas terdampak (`POST`, `FORM`, `LEAD`, `USER`, dll) |
| `targetId` | `VARCHAR(64)?` | `String?` | - | Ya | `null` | ID entitas terkait (misal: ID artikel) |
| `reason` | `TEXT` | `String` | - | Tidak | - | Alasan darurat yang diinputkan staf |
| `previousState` | `JSONB?` | `Json?` | - | Ya | `null` | Status sebelum aksi (untuk kebutuhan rollback) |
| `isRolledBack` | `BOOLEAN` | `Boolean` | - | Tidak | `false` | Status apakah aksi sudah dibatalkan |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu eksekusi aksi darurat (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `actorId` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, actionType, createdAt]`
* Index: `[site_id, targetEntity, targetId]`

---

## 4. Mekanisme Agregasi Harian Analitik (*Analytics Daily Rollup*)

Agar tabel `analytics_daily` terisi secara akurat dan menjaga waktu respon dashboard di bawah 100 milidetik, backend Next.js menjalankan proses rollup berkala dengan aturan kalkulasi yang presisi:

### 4.1 Definisi Perhitungan Metrik Kritis
1. **Sesi Kunjungan (`sessions`):**  
   Dihitung dari `COUNT(DISTINCT "sessionId")`. Sesi dihasilkan oleh skrip pelacak di peramban dan diperbarui dengan ID sesi baru jika pengunjung tidak beraktivitas selama lebih dari 30 menit.
2. **Kunjungan Memantul (`bounces`):**  
   Sebuah sesi diklasifikasikan sebagai *bounce* jika dalam sesi tersebut hanya terjadi tepat 1 event tayangan (`COUNT(*) = 1` dalam sesi) dan `durationSec < 10` detik.
3. **Durasi Kunjungan (`durationSec`):**  
   Akumulasi durasi waktu aktif tab peramban yang dikirimkan melalui sinyal detak (*beacon heartbeat*) setiap 15 detik atau saat tab ditutup (*visibilitychange / pagehide*).
4. **Pencegahan Duplikasi Pengunjung Unik Tingkat Situs (*Site-Wide Deduplication*):**  
   - Jika pengunjung unik V membuka halaman `/`, `/layanan`, dan `/kontak` dalam satu hari, pengunjung V akan tercatat di 3 baris path yang berbeda. Menjumlahkan `SUM(visitors)` dari seluruh baris path akan menghasilkan angka berlebih (*overcount*).
   - Solusi Resmi: Kueri rollup menghasilkan dua kategori data:
     - **Baris per Path (`path != '*'`):** Untuk tabel peringkat Halaman Terpopuler (*Top Pages*).
     - **Baris Ringkasan Situs (`path = '*'`):** Untuk kartu metrik ringkasan atas (*Top-Line Overview Cards*). Pada baris `path = '*'`:
       - `visitors` dihitung dari `COUNT(DISTINCT "visitorIdHash")` murni di seluruh event pada tanggal tersebut.
       - `sessions` dihitung dari `COUNT(DISTINCT "sessionId")` murni di seluruh event pada tanggal tersebut.

### 4.2 Strategi Rollup: Re-Agregasi Kumulatif Hari Berjalan
* **Jadwal Eksekusi Rollup per Jam (Inkremental Kumulatif):**  
  Rollup per jam **selalu mere-agregasi seluruh rentang hari berjalan (*Current Full Day*: dari 00:00:00 UTC sampai waktu berjalan)**. Re-agregasi satu hari penuh untuk situs agensi/klien (berkisar ribuan baris) memakan waktu < 50 milidetik di PostgreSQL. Dengan mere-agregasi satu hari penuh kumulatif, klausul `DO UPDATE SET ... = EXCLUDED...` **selalu mencerminkan total kumulatif riil hari tersebut hingga jam berjalan** tanpa risiko angka terpotong atau tertimpa data parsial.
* **Jadwal Konsolidasi Final (Pukul 01:00 WIB):**  
  Mengagregasi seluruh event hari kemarin secara final dan menguncinya di `analytics_daily` tepat 1 jam sebelum jadwal pembersihan data mentah (*raw purge*) pada pukul 02:00 WIB.

### 4.3 Kueri SQL Rollup Lengkap & Idempotent
```sql
WITH session_summary AS (
  -- 1. Evaluasi karakteristik per sesi (apakah bounce atau bukan)
  SELECT 
    site_id,
    DATE("occurredAt") AS date,
    "sessionId",
    "visitorIdHash",
    source,
    device,
    MIN(path) AS entry_path,
    COUNT(*) AS event_count,
    MAX("durationSec") AS session_duration
  FROM analytics_events
  WHERE "occurredAt" >= $1 AND "occurredAt" < $2
  GROUP BY site_id, DATE("occurredAt"), "sessionId", "visitorIdHash", source, device
),
page_rollup AS (
  -- 2. Agregasi tingkat halaman individual (path != '*')
  SELECT 
    e.site_id,
    DATE(e."occurredAt") AS date,
    e.path,
    e.source,
    e.device,
    COUNT(*) FILTER (WHERE e."eventName" = 'pageview') AS pageviews,
    COUNT(DISTINCT e."visitorIdHash") AS visitors,
    COUNT(DISTINCT e."sessionId") AS sessions,
    COUNT(DISTINCT s."sessionId") FILTER (WHERE s.event_count = 1 AND s.session_duration < 10 AND s.entry_path = e.path) AS bounces,
    COALESCE(SUM(e."durationSec"), 0) AS durationSec,
    COUNT(*) FILTER (WHERE e."eventName" = 'whatsapp_click') AS whatsappClicks,
    COUNT(*) FILTER (WHERE e."eventName" = 'form_submit') AS formSubmits,
    COUNT(*) FILTER (WHERE e."eventName" IN ('whatsapp_click', 'form_submit')) AS conversions
  FROM analytics_events e
  LEFT JOIN session_summary s 
    ON e.site_id = s.site_id AND e."sessionId" = s."sessionId"
  WHERE e."occurredAt" >= $1 AND e."occurredAt" < $2
  GROUP BY e.site_id, DATE(e."occurredAt"), e.path, e.source, e.device
),
site_total_rollup AS (
  -- 3. Agregasi tingkat situs menyeluruh (path = '*', source = 'all', device = 'all')
  SELECT 
    site_id,
    date,
    '*' AS path,
    'all' AS source,
    'all' AS device,
    COUNT(*) FILTER (WHERE "eventName" = 'pageview') AS pageviews,
    COUNT(DISTINCT "visitorIdHash") AS visitors,
    COUNT(DISTINCT "sessionId") AS sessions,
    COUNT(DISTINCT "sessionId") FILTER (WHERE "sessionId" IN (
      SELECT "sessionId" FROM session_summary WHERE event_count = 1 AND session_duration < 10
    )) AS bounces,
    COALESCE(SUM("durationSec"), 0) AS durationSec,
    COUNT(*) FILTER (WHERE "eventName" = 'whatsapp_click') AS whatsappClicks,
    COUNT(*) FILTER (WHERE "eventName" = 'form_submit') AS formSubmits,
    COUNT(*) FILTER (WHERE "eventName" IN ('whatsapp_click', 'form_submit')) AS conversions
  FROM analytics_events
  WHERE "occurredAt" >= $1 AND "occurredAt" < $2
  GROUP BY site_id, date
)
-- 4. Simpan hasil rollup ke tabel analytics_daily dengan klausul penimpaan kumulatif
INSERT INTO analytics_daily (
  site_id, date, path, source, device,
  pageviews, visitors, sessions, bounces, durationSec,
  whatsappClicks, formSubmits, conversions
)
SELECT * FROM page_rollup
UNION ALL
SELECT * FROM site_total_rollup
ON CONFLICT (site_id, date, path, source, device)
DO UPDATE SET
  pageviews = EXCLUDED.pageviews,
  visitors = EXCLUDED.visitors,
  sessions = EXCLUDED.sessions,
  bounces = EXCLUDED.bounces,
  durationSec = EXCLUDED.durationSec,
  whatsappClicks = EXCLUDED.whatsappClicks,
  formSubmits = EXCLUDED.formSubmits,
  conversions = EXCLUDED.conversions;
```

---

## 5. Berkas Skema Lengkap (`prisma/schema.prisma`) & Pendekatan Raw SQL

> [!NOTE]
> **Integrasi Prisma ORM & Raw SQL / Query Builder:**  
> PostgreSQL adalah satu-satunya sumber kebenaran (*Single Source of Truth*) untuk seluruh struktur data, tipe kolom, dan constraint. Definisi model Prisma di bawah ini berfungsi sebagai skema ORM utama untuk seluruh operasi CRUD di backend Express.js. Untuk operasi analitik dan pemeliharaan berkinerja tinggi (seperti kalkulasi CTE `session_summary` pada rollup harian, pembersihan event 90 hari, dan pemangkasan snapshot FIFO 5 versi), backend menggunakan Raw SQL via `prisma.$queryRaw` / `prisma.$executeRaw` atau query builder teroptimasi.

Berikut adalah berkas Prisma Schema lengkap yang merefleksikan seluruh tabel di atas:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 1. DEFINISI ENUM BAKU
// ==========================================

enum ContentStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum LeadStatus {
  BARU
  DIHUBUNGI
  PROPOSAL
  DEAL
  BATAL
}

enum ProjectStatus {
  PERSIAPAN
  AKTIF
  REVISI
  SELESAI
}

enum UserRole {
  STAFF
}

enum EmergencyActionType {
  UNPUBLISH_CONTENT
  LOCK_CONTACT_FORM
  UNLOCK_CONTACT_FORM
  SET_ALERT_BANNER
  REMOVE_ALERT_BANNER
  REASSIGN_STAFF
  REVOKE_SESSION
}

enum ActivityActionType {
  LEAD_STATUS_CHANGED
  LEAD_DEAL_VALUE_UPDATED
  LEAD_REASSIGNED
  SCHEDULE_SHIFTED
  CONTENT_STATUS_CHANGED
}

// ==========================================
// 2. MULTI-TENANT MASTER & PENGGUNA
// ==========================================

model Site {
  id            String    @id @db.VarChar(64)
  name          String    @db.VarChar(255)
  domain        String    @unique @db.VarChar(255)
  isActive      Boolean   @default(true)
  isFormLocked  Boolean   @default(false)
  alertBanner   String?   @db.Text
  isAlertActive Boolean   @default(false)
  createdAt     DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @db.Timestamptz(3)

  categories         Category[]
  posts              Post[]
  portfolios         Portfolio[]
  services           Service[]
  faqs               Faq[]
  testimonials       Testimonial[]
  pages              Page[]
  snapshots          ContentSnapshot[]
  media              Media[]
  redirects          Redirect[]
  leads              Lead[]
  interactionLogs    InteractionLog[]
  activityLogs       ActivityLog[]
  projectSchedules   ProjectSchedule[]
  analyticsEvents    AnalyticsEvent[]
  analyticsDaily     AnalyticsDaily[]
  rateLimits         RateLimit[]
  emergencyAuditLogs EmergencyAuditLog[]

  @@map("sites")
}

model User {
  id           String    @id @default(cuid()) @db.VarChar(64)
  email        String    @unique @db.VarChar(255)
  passwordHash String    @db.VarChar(255)
  fullName     String    @db.VarChar(255)
  role         UserRole  @default(STAFF)
  jobTitle     String    @db.VarChar(100)
  avatarUrl    String?   @db.VarChar(500)
  isActive     Boolean   @default(true)
  tokenVersion Int       @default(0)
  createdAt    DateTime  @default(now()) @db.Timestamptz(3)
  updatedAt    DateTime  @updatedAt @db.Timestamptz(3)

  authoredPosts      Post[]              @relation("PostAuthor")
  editedPosts        Post[]              @relation("PostLastEditor")
  editedPortfolios   Portfolio[]         @relation("PortfolioLastEditor")
  editedServices     Service[]           @relation("ServiceLastEditor")
  editedFaqs         Faq[]               @relation("FaqLastEditor")
  editedTestimonials Testimonial[]       @relation("TestimonialLastEditor")
  editedPages        Page[]              @relation("PageLastEditor")
  savedSnapshots     ContentSnapshot[]   @relation("SnapshotAuthor")
  uploadedMedia      Media[]             @relation("MediaUploader")
  assignedLeads      Lead[]              @relation("LeadAssignee")
  editedLeads        Lead[]              @relation("LeadLastEditor")
  interactionLogs    InteractionLog[]    @relation("LogAuthor")
  activityLogs       ActivityLog[]       @relation("ActivityActor")
  assignedSchedules  ProjectSchedule[]   @relation("ScheduleAssignee")
  editedSchedules    ProjectSchedule[]   @relation("ScheduleLastEditor")
  emergencyActions   EmergencyAuditLog[] @relation("EmergencyActor")

  @@index([role, isActive])
  @@map("users")
}

// ==========================================
// 3. CMS & PORTOFOLIO
// ==========================================

model Category {
  id        String   @id @default(cuid()) @db.VarChar(64)
  site_id   String   @default("nextkarya-main") @db.VarChar(64)
  name      String   @db.VarChar(100)
  slug      String   @db.VarChar(150)
  createdAt DateTime @default(now()) @db.Timestamptz(3)
  updatedAt DateTime @updatedAt @db.Timestamptz(3)

  site  Site   @relation(fields: [site_id], references: [id], onDelete: Restrict)
  posts Post[]

  @@unique([site_id, slug])
  @@index([site_id])
  @@map("categories")
}

model Post {
  id                 String        @id @default(cuid()) @db.VarChar(64)
  site_id            String        @default("nextkarya-main") @db.VarChar(64)
  title              String        @db.VarChar(255)
  slug               String        @db.VarChar(255)
  excerpt            String        @db.Text
  content            Json          @db.JsonB
  coverUrl           String?       @db.VarChar(500)
  coverAlt           String?       @db.VarChar(255)
  tags               String[]      @default([])
  readingTimeMinutes Int           @default(1)
  relatedPostIds     String[]      @default([])
  status             ContentStatus @default(DRAFT)
  categoryId         String        @db.VarChar(64)
  authorId           String        @db.VarChar(64)
  lastEditedById     String        @db.VarChar(64)
  seoTitle           String?       @db.VarChar(255)
  seoDescription     String?       @db.Text
  publishedAt        DateTime?     @db.Timestamptz(3)
  createdAt          DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime      @updatedAt @db.Timestamptz(3)

  site       Site     @relation(fields: [site_id], references: [id], onDelete: Restrict)
  category   Category @relation(fields: [categoryId], references: [id], onDelete: Restrict)
  author     User     @relation("PostAuthor", fields: [authorId], references: [id], onDelete: Restrict)
  lastEditor User     @relation("PostLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@unique([site_id, slug])
  @@index([site_id, status, publishedAt])
  @@index([site_id, categoryId, status])
  @@index([site_id, updatedAt])
  @@map("posts")
}

model Portfolio {
  id              String        @id @default(cuid()) @db.VarChar(64)
  site_id         String        @default("nextkarya-main") @db.VarChar(64)
  title           String        @db.VarChar(255)
  slug            String        @db.VarChar(255)
  clientName      String        @db.VarChar(255)
  serviceCategory String        @db.VarChar(100)
  summary         String        @db.Text
  impactSummary   String?       @db.Text
  metricResult    String?       @db.VarChar(100)
  content         Json          @db.JsonB
  thumbnailUrl    String?       @db.VarChar(500)
  thumbnailAlt    String?       @db.VarChar(255)
  technologies    String[]      @default([])
  projectUrl      String?       @db.VarChar(500)
  isFeatured      Boolean       @default(false)
  sortOrder       Int           @default(0)
  status          ContentStatus @default(DRAFT)
  lastEditedById  String        @db.VarChar(64)
  publishedAt     DateTime?     @db.Timestamptz(3)
  createdAt       DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime      @updatedAt @db.Timestamptz(3)

  site         Site          @relation(fields: [site_id], references: [id], onDelete: Restrict)
  lastEditor   User          @relation("PortfolioLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)
  testimonials Testimonial[]

  @@unique([site_id, slug])
  @@index([site_id, status, isFeatured, sortOrder])
  @@map("portfolios")
}

model Service {
  id             String        @id @default(cuid()) @db.VarChar(64)
  site_id        String        @default("nextkarya-main") @db.VarChar(64)
  title          String        @db.VarChar(255)
  slug           String        @db.VarChar(255)
  icon           String        @db.VarChar(100)
  shortDesc      String        @db.Text
  features       String[]      @default([])
  priceLabel     String        @db.VarChar(100)
  priceNote      String?       @db.VarChar(255)
  badge          String?       @db.VarChar(100)
  ctaLabel       String        @default("Konsultasi Sekarang") @db.VarChar(100)
  ctaHref        String        @default("/kontak") @db.VarChar(255)
  sortOrder      Int           @default(0)
  status         ContentStatus @default(DRAFT)
  lastEditedById String        @db.VarChar(64)
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(3)

  site       Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  lastEditor User @relation("ServiceLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@unique([site_id, slug])
  @@index([site_id, status, sortOrder])
  @@map("services")
}

model Faq {
  id             String   @id @default(cuid()) @db.VarChar(64)
  site_id        String   @default("nextkarya-main") @db.VarChar(64)
  question       String   @db.VarChar(500)
  answer         String   @db.Text
  category       String   @default("Umum") @db.VarChar(100)
  sortOrder      Int      @default(0)
  isActive       Boolean  @default(true)
  lastEditedById String   @db.VarChar(64)
  createdAt      DateTime @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime @updatedAt @db.Timestamptz(3)

  site       Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  lastEditor User @relation("FaqLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@index([site_id, isActive, sortOrder])
  @@index([site_id, category])
  @@map("faqs")
}

model Testimonial {
  id             String        @id @default(cuid()) @db.VarChar(64)
  site_id        String        @default("nextkarya-main") @db.VarChar(64)
  clientName     String        @db.VarChar(255)
  clientRole     String?       @db.VarChar(150)
  companyName    String?       @db.VarChar(255)
  content        String        @db.Text
  avatarUrl      String?       @db.VarChar(500)
  rating         Int           @default(5)
  portfolioId    String?       @db.VarChar(64)
  sortOrder      Int           @default(0)
  status         ContentStatus @default(PUBLISHED)
  lastEditedById String        @db.VarChar(64)
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(3)

  site       Site       @relation(fields: [site_id], references: [id], onDelete: Restrict)
  portfolio  Portfolio? @relation(fields: [portfolioId], references: [id], onDelete: SetNull)
  lastEditor User       @relation("TestimonialLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@index([site_id, status, sortOrder])
  @@map("testimonials")
}

model Page {
  id             String        @id @default(cuid()) @db.VarChar(64)
  site_id        String        @default("nextkarya-main") @db.VarChar(64)
  title          String        @db.VarChar(255)
  slug           String        @db.VarChar(255)
  content        Json          @db.JsonB
  seoTitle       String?       @db.VarChar(255)
  seoDescription String?       @db.Text
  status         ContentStatus @default(DRAFT)
  lastEditedById String        @db.VarChar(64)
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(3)

  site       Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  lastEditor User @relation("PageLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@unique([site_id, slug])
  @@index([site_id, status])
  @@map("pages")
}

model ContentSnapshot {
  id              String   @id @default(cuid()) @db.VarChar(64)
  site_id         String   @default("nextkarya-main") @db.VarChar(64)
  entityType      String   @db.VarChar(50)
  entityId        String   @db.VarChar(64)
  version         Int      @default(1)
  title           String   @db.VarChar(255)
  snapshotPayload Json     @db.JsonB
  savedById       String   @db.VarChar(64)
  createdAt       DateTime @default(now()) @db.Timestamptz(3)

  site   Site @relation(fields: [site_id], references: [id], onDelete: Cascade)
  author User @relation("SnapshotAuthor", fields: [savedById], references: [id], onDelete: Restrict)

  @@index([site_id, entityType, entityId, createdAt, version])
  @@map("content_snapshots")
}

model Media {
  id           String   @id @default(cuid()) @db.VarChar(64)
  site_id      String   @default("nextkarya-main") @db.VarChar(64)
  fileName     String   @db.VarChar(255)
  originalName String   @db.VarChar(255)
  mimeType     String   @db.VarChar(100)
  fileSize     Int
  width        Int?
  height       Int?
  url          String   @db.VarChar(500)
  altText      String?  @db.VarChar(255)
  uploadedById String   @db.VarChar(64)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)

  site       Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  uploadedBy User @relation("MediaUploader", fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([site_id, createdAt])
  @@index([site_id, mimeType, createdAt])
  @@index([site_id, originalName])
  @@map("media")
}

model Redirect {
  id         String   @id @default(cuid()) @db.VarChar(64)
  site_id    String   @default("nextkarya-main") @db.VarChar(64)
  sourcePath String   @db.VarChar(255)
  targetPath String   @db.VarChar(255)
  statusCode Int      @default(301)
  createdAt  DateTime @default(now()) @db.Timestamptz(3)

  site Site @relation(fields: [site_id], references: [id], onDelete: Cascade)

  @@unique([site_id, sourcePath])
  @@map("redirects")
}

// ==========================================
// 4. CRM & BEBAN KERJA TIM
// ==========================================

model Lead {
  id                 String     @id @default(cuid()) @db.VarChar(64)
  site_id            String     @default("nextkarya-main") @db.VarChar(64)
  clientName         String     @db.VarChar(255)
  companyName        String?    @db.VarChar(255)
  whatsappNumber     String     @db.VarChar(50)
  email              String?    @db.VarChar(255)
  serviceRequested   String     @db.VarChar(100)
  message            String     @db.Text
  dealValue          BigInt     @default(0)
  status             LeadStatus @default(BARU)
  assignedToId       String?    @db.VarChar(64)
  nextFollowUpDate   DateTime?  @db.Date
  warrantyExpiryDate DateTime?  @db.Date
  stagingUrl         String?    @db.VarChar(500)
  productionUrl      String?    @db.VarChar(500)
  lastEditedById     String?    @db.VarChar(64)
  createdAt          DateTime   @default(now()) @db.Timestamptz(3)
  updatedAt          DateTime   @updatedAt @db.Timestamptz(3)

  site            Site              @relation(fields: [site_id], references: [id], onDelete: Restrict)
  assignedTo      User?             @relation("LeadAssignee", fields: [assignedToId], references: [id], onDelete: SetNull)
  lastEditor      User?             @relation("LeadLastEditor", fields: [lastEditedById], references: [id], onDelete: SetNull)
  interactionLogs InteractionLog[]
  schedules       ProjectSchedule[]

  @@index([site_id, nextFollowUpDate, status, assignedToId])
  @@index([site_id, status, createdAt])
  @@index([site_id, warrantyExpiryDate])
  @@map("leads")
}

model InteractionLog {
  id        String   @id @default(cuid()) @db.VarChar(64)
  site_id   String   @default("nextkarya-main") @db.VarChar(64)
  leadId    String   @db.VarChar(64)
  authorId  String   @db.VarChar(64)
  note      String   @db.Text
  createdAt DateTime @default(now()) @db.Timestamptz(3)

  site   Site @relation(fields: [site_id], references: [id], onDelete: Cascade)
  lead   Lead @relation(fields: [leadId], references: [id], onDelete: Cascade)
  author User @relation("LogAuthor", fields: [authorId], references: [id], onDelete: Restrict)

  @@index([site_id, leadId, createdAt])
  @@map("interaction_logs")
}

model ActivityLog {
  id         String             @id @default(cuid()) @db.VarChar(64)
  site_id    String             @default("nextkarya-main") @db.VarChar(64)
  actorId    String             @db.VarChar(64)
  action     ActivityActionType
  entityType String             @db.VarChar(50)
  entityId   String             @db.VarChar(64)
  summary    String             @db.VarChar(500)
  metadata   Json?              @db.JsonB
  createdAt  DateTime           @default(now()) @db.Timestamptz(3)

  site  Site @relation(fields: [site_id], references: [id], onDelete: Cascade)
  actor User @relation("ActivityActor", fields: [actorId], references: [id], onDelete: Restrict)

  @@index([site_id, entityType, entityId, createdAt])
  @@index([site_id, action, createdAt])
  @@map("activity_logs")
}

model ProjectSchedule {
  id             String        @id @default(cuid()) @db.VarChar(64)
  site_id        String        @default("nextkarya-main") @db.VarChar(64)
  leadId         String?       @db.VarChar(64)
  taskName       String        @db.VarChar(255)
  assignedToId   String        @db.VarChar(64)
  startDate      DateTime      @db.Date
  endDate        DateTime      @db.Date
  status         ProjectStatus @default(AKTIF)
  lastEditedById String        @db.VarChar(64)
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(3)

  site       Site  @relation(fields: [site_id], references: [id], onDelete: Restrict)
  lead       Lead? @relation(fields: [leadId], references: [id], onDelete: SetNull)
  assignedTo User  @relation("ScheduleAssignee", fields: [assignedToId], references: [id], onDelete: Restrict)
  lastEditor User  @relation("ScheduleLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@index([site_id, assignedToId, startDate, endDate])
  @@map("project_schedules")
}

// ==========================================
// 5. ANALITIK & RATE LIMIT
// ==========================================

model AnalyticsEvent {
  id            BigInt   @id @default(autoincrement())
  site_id       String   @default("nextkarya-main") @db.VarChar(64)
  sessionId     String   @db.VarChar(64)
  eventName     String   @db.VarChar(50)
  path          String   @db.VarChar(255)
  referrer      String?  @db.VarChar(500)
  source        String   @default("direct") @db.VarChar(50)
  device        String   @default("unknown") @db.VarChar(20)
  browser       String?  @db.VarChar(50)
  os            String?  @db.VarChar(50)
  durationSec   Int      @default(0)
  visitorIdHash String   @db.VarChar(64)
  occurredAt    DateTime @default(now()) @db.Timestamptz(3)

  site Site @relation(fields: [site_id], references: [id], onDelete: Cascade)

  @@index([site_id, occurredAt])
  @@index([site_id, sessionId, occurredAt])
  @@index([site_id, eventName, occurredAt])
  @@index([site_id, visitorIdHash, occurredAt])
  @@index([site_id, os, browser, occurredAt])
  @@map("analytics_events")
}

model AnalyticsDaily {
  id             BigInt   @id @default(autoincrement())
  site_id        String   @default("nextkarya-main") @db.VarChar(64)
  date           DateTime @db.Date
  path           String   @db.VarChar(255)
  source         String   @default("direct") @db.VarChar(50)
  device         String   @default("unknown") @db.VarChar(20)
  pageviews      Int      @default(0)
  visitors       Int      @default(0)
  sessions       Int      @default(0)
  bounces        Int      @default(0)
  durationSec    Int      @default(0)
  whatsappClicks Int      @default(0)
  formSubmits    Int      @default(0)
  conversions    Int      @default(0)

  site Site @relation(fields: [site_id], references: [id], onDelete: Cascade)

  @@unique([site_id, date, path, source, device])
  @@index([site_id, date])
  @@map("analytics_daily")
}

model RateLimit {
  key       String   @id @db.VarChar(255)
  site_id   String   @default("nextkarya-main") @db.VarChar(64)
  count     Int      @default(1)
  expiresAt DateTime @db.Timestamptz(3)

  site Site @relation(fields: [site_id], references: [id], onDelete: Cascade)

  @@index([site_id, expiresAt])
  @@map("rate_limits")
}

// ==========================================
// 6. LOG AUDIT AKSI DARURAT
// ==========================================

model EmergencyAuditLog {
  id             String              @id @default(cuid()) @db.VarChar(64)
  site_id        String              @default("nextkarya-main") @db.VarChar(64)
  actorId        String              @db.VarChar(64)
  actionType     EmergencyActionType
  targetEntity   String              @db.VarChar(50)
  targetId       String?             @db.VarChar(64)
  reason         String              @db.Text
  previousState  Json?               @db.JsonB
  isRolledBack   Boolean             @default(false)
  createdAt      DateTime            @default(now()) @db.Timestamptz(3)

  site  Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  actor User @relation("EmergencyActor", fields: [actorId], references: [id], onDelete: Restrict)

  @@index([site_id, actionType, createdAt])
  @@index([site_id, targetEntity, targetId])
  @@map("emergency_audit_logs")
}
```

---

## 6. Rencana Data Awal (*Seed Data*)

Saat inisialisasi basis data pertama kali, sistem akan menyuntikkan data awal wajib:

### 6.1 Situs Master
```json
{
  "id": "nextkarya-main",
  "name": "Next Karya Digital Solutions",
  "domain": "nextkarya.web.id",
  "isActive": true,
  "isFormLocked": false,
  "isAlertActive": false
}
```

### 6.2 Tiga Akun Staf Internal (Seluruhnya Setara: `STAFF`)
Seluruh akun staf internal menggunakan domain resmi `@nextkarya.web.id` dengan peran tunggal `STAFF`:

| Email | Nama Lengkap | Jabatan (*jobTitle*) | Role |
| :--- | :--- | :--- | :--- |
| `programmer@nextkarya.web.id` | Staf A (Programmer) | Full-Stack Developer | `STAFF` |
| `designer@nextkarya.web.id` | Staf B (Desainer) | UI/UX & Visual Designer | `STAFF` |
| `lead@nextkarya.web.id` | Staf C (Project Lead) | Project Lead & Client Relations | `STAFF` |

---

## 7. Prosedur Pembersihan Berkala (*Cron Job Maintenance*)

Untuk menjaga kinerja basis data PostgreSQL tetap optimal:

### 7.1 Pembersihan Raw Analytics (Pukul 02:00 WIB Setiap Hari)
Menghapus rekaman `analytics_events` yang lebih tua dari 90 hari:
```sql
DELETE FROM analytics_events 
WHERE "occurredAt" < NOW() - INTERVAL '90 days';
```

### 7.2 Pemangkasan Snapshot Konten (*Pruning FIFO 5 Versi*)
Setiap kali konten disimpan, fungsi pemicu backend memastikan hanya 5 versi terbaru yang disimpan berdasarkan urutan waktu dan tie-breaker ID:
```sql
DELETE FROM content_snapshots 
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "site_id", "entityType", "entityId" 
      ORDER BY "createdAt" DESC, "version" DESC
    ) AS row_num
    FROM content_snapshots
    WHERE "entityType" = $1 AND "entityId" = $2
  ) ranked
  WHERE ranked.row_num > 5
);
```

---

## 8. Riwayat Perubahan Skema (Changelog)

### Versi 1.1 Kanonik (31 Oktober 2026)
* Penetapan status berkas sebagai Skema Basis Data Kanonik (`schema-database-v1.1.md`) yang menjadi acuan tunggal struktur 20 tabel sistem.
* Menetapkan Prisma ORM sebagai ORM utama backend Express.js (TypeScript), dengan pendekatan hibrida Raw SQL (`prisma.$queryRaw` / `prisma.$executeRaw`) untuk kalkulasi analitik dan maintenance.
* Memperbaiki daftar 20 tabel entitas relasional sebenarnya di sistem:
  - Identitas & Multi-Tenant: `sites`, `users`.
  - CMS Konten: `categories`, `posts`, `portfolios`, `services`, `faqs`, `testimonials`, `pages`, `content_snapshots`.
  - SEO & Redirects: `redirects`.
  - Media: `media`.
  - CRM Prospek & Proyek: `leads`, `interaction_logs`, `activity_logs`, `project_schedules`.
  - Analitik Ringan: `analytics_events`, `analytics_daily`.
  - Keamanan & Tanggap Darurat: `rate_limits`, `emergency_audit_logs`.
* Menegaskan pemisahan tipe waktu: `TIMESTAMPTZ(3)` untuk stempel waktu transaksi UTC, dan `DATE` untuk tanggal kalender (`nextFollowUpDate` dan `warrantyExpiryDate` pada `leads`, serta `startDate` dan `endDate` pada `project_schedules`).
* Menegaskan bahwa 17 dari 20 tabel memuat kolom `site_id` (mengecualikan `sites`, `users`, dan `rate_limits`).
* Menyelaraskan seluruh tautan dan nilai enum dengan kontrak resmi [`docs/api-contracts-v1.0.md`](./api-contracts-v1.0.md) dan [`docs/system-architecture-v1.0.md`](./system-architecture-v1.0.md).

### Versi 1.1 (30 Oktober 2026)
* Penyusunan skema database PostgreSQL dan model Prisma awal sebagai fondasi struktur data.
* Penambahan nilai enum `REVOKE_SESSION` pada `EmergencyActionType` di Bab 2.5 dan model Prisma untuk mendukung endpoint pencabutan darurat sesi staf HP hilang (`POST /api/v1/users/:id/revoke-sessions`) yang menaikkan `tokenVersion` dan mencatat audit log dengan target entitas `USER`.
* Penguncian rollup analitik inkremental harian dengan CTE `session_summary` untuk kalkulasi `sessions`, `bounces`, dan `durationSec` secara presisi 100%.

