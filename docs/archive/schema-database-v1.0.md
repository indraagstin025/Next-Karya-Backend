# Spesifikasi Skema Basis Data PostgreSQL & Prisma (Single Source of Truth)
**Next Karya Digital Solutions**  
*Cetak Biru Struktur Tabel, Relasi, Indeks, dan Penguncian Konkurensi Sistem*  
*Versi: 1.0 (Multi-Tenant Ready, Concurrency-Safe & Anti-Overclaim)*  
*Tanggal: 30 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Prinsip Utama Desain Basis Data

Dokumen ini merupakan satu-satunya sumber kebenaran (*single source of truth*) untuk seluruh pemodelan data PostgreSQL dan `schema.prisma`. Seluruh pengembang wajib mematuhi aturan berikut:

1. **Keberadaan `site_id` di Setiap Tabel Data:**
   - Kolom `site_id` bertipe `String` wajib hadir dan terindeks di seluruh tabel konten, media, leads CRM, jadwal proyek, event analitik, hingga log audit.
   - Pada Fase 1 (MVP), seluruh baris data menggunakan nilai `site_id: "nextkarya-main"`.
   - Skema ini menjamin isolasi data siap pakai saat situs klien ditambahkan pada Fase 2 tanpa perlu mengubah struktur tabel (*zero breaking migration*).
2. **Standar Zona Waktu (UTC di Database, WIB di Tampilan):**
   - Seluruh kolom stempel waktu disimpan dalam format UTC menggunakan tipe PostgreSQL `TIMESTAMPTZ` (`DateTime @default(now())`).
   - Lapisan antarmuka pengguna (Next.js Desktop Web dan Flutter Mobile) bertugas mengonversi waktu UTC menjadi Waktu Indonesia Barat (WIB / UTC+7) saat ditampilkan kepada staf.
   - Berlaku mutlak untuk `nextFollowUpDate`, `warrantyExpiryDate`, `occurredAt`, `createdAt`, dan `updatedAt`.
3. **Mekanisme Kolaborasi 3 Staf (*Optimistic Locking*):**
   - Setiap tabel CMS (`posts`, `portfolios`) dan CRM (`leads`, `project_schedules`) wajib memiliki kolom `updatedAt` bertipe `DateTime @updatedAt` dan `lastEditedById` bertipe `String` yang merujuk ke tabel `users`.
   - Saat pembaruan data dikirimkan, backend memeriksa kesesuaian stempel `updatedAt`. Jika data sudah diubah oleh rekan kerja lain lebih dulu, mutasi ditolak dengan HTTP 409 Conflict.
4. **Penghapusan Konten Aman (*Soft Delete*):**
   - CMS tidak menerapkan *hard delete* (penghapusan baris permanen dari disk).
   - Penghapusan artikel atau portofolio dilakukan dengan mengubah statusnya menjadi `ARCHIVED`. Data arsip tidak akan ditampilkan pada website publik, namun tetap tersimpan untuk kebutuhan jejak riwayat.
5. **Snapshot Riwayat Konten (*Rolling FIFO 5 Versi*):**
   - Tabel `content_snapshots` menampung salinan konten sebelum proses penerbitan (*pre-publish snapshot*).
   - Maksimal 5 rekaman snapshot tersimpan per artikel atau portofolio. Snapshot tertua otomatis dihapus saat snapshot ke-6 masuk (*First-In, First-Out*).
6. **Pemisahan Mesin Analitik & Privasi Pengunjung:**
   - **Tabel Raw Event (`analytics_events`):** Menampung data mentah per kunjungan dengan masa simpan 90 hari (*TTL 90 days*). Dibersihkan otomatis oleh cron job harian pada pukul 02:00 WIB. Tidak menyimpan data pribadi (*No PII*), hanya menyimpan `visitorIdHash` (hasil enkripsi IP + User Agent + salt harian). Kolom geografis kota ditiadakan pada tabel mentah karena pelacakan GeoIP dialokasikan untuk Fase 2.
   - **Tabel Agregasi Harian (`analytics_daily`):** Menampung rangkuman statistik harian dengan indeks unik `[site_id, date, path, source, device]`. Menjadi sumber kueri utama grafik dashboard agar pemuatan data selesai di bawah 100 milidetik.
7. **Indeks Kinerja CRM (< 150 milidetik):**
   - Halaman kerja "Agenda Follow-Up Hari Ini" wajib didukung oleh *composite index* `[nextFollowUpDate, status, assignedTo]` pada tabel `leads` agar kueri pagi hari berjalan instan.

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
* `SUPER_ADMIN`: Akses penuh konfigurasi sistem dan manajemen pengguna.
* `STAFF`: Akses operasional CMS, CRM, Analitik, dan Emergency Toolkit (peran default 3 anggota tim internal).

### 2.5 `EmergencyActionType` (Jenis Aksi Darurat)
* `UNPUBLISH_CONTENT`: Penarikan darurat artikel/portofolio sensitif ke draft.
* `LOCK_CONTACT_FORM`: Penguncian formulir kontak publik dan pengalihan ke WhatsApp.
* `UNLOCK_CONTACT_FORM`: Pembukaan kembali formulir kontak publik.
* `SET_ALERT_BANNER`: Pengaktifan strip banner pengumuman darurat di situs publik.
* `REMOVE_ALERT_BANNER`: Penonaktifan strip banner darurat.
* `REASSIGN_STAFF`: Pengalihan penanggung jawab prospek/proyek saat staf berhalangan.

---

## 3. Rincian Struktur Tabel

### Kelompok 1: Multi-Tenancy & Autentikasi Pengguna

#### Tabel 1: `sites` (Master Multi-Tenant)
Menampung identitas situs web yang dikelola sistem.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id` | Tidak | - | ID unik situs (contoh: `nextkarya-main`) |
| `name` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama situs (contoh: `Next Karya Digital Solutions`) |
| `domain` | `VARCHAR(255)` | `String` | `@unique` | Tidak | - | Domain resmi (contoh: `nextkarya.id`) |
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
Menampung kredensial login bagi Staf A (Programmer), Staf B (Desainer), dan Staf C (Lead).

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik staf |
| `email` | `VARCHAR(255)` | `String` | `@unique` | Tidak | - | Email resmi staf (contoh: `nama@nextkarya.id`) |
| `passwordHash` | `VARCHAR(255)` | `String` | - | Tidak | - | Hash sandi aman (bcrypt / argon2) |
| `fullName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama lengkap staf |
| `role` | `VARCHAR(32)` | `UserRole` | - | Tidak | `STAFF` | Hak akses operasional |
| `jobTitle` | `VARCHAR(100)` | `String` | - | Tidak | - | Jabatan (Programmer, Desainer, Lead) |
| `avatarUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | URL foto profil staf |
| `isActive` | `BOOLEAN` | `Boolean` | - | Tidak | `true` | Status keaktifan akun |
| `tokenVersion` | `INTEGER` | `Int` | - | Tidak | `0` | Versi token untuk revocasi sesi HP hilang |
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
* Unique Index: `[site_id, slug]` (Mencegah bentrok slug di situs yang sama)
* Index: `[site_id]`

---

#### Tabel 4: `posts` (Artikel Blog & Edukasi CMS)
Menampung materi artikel publik lengkap dengan mekanisme *Optimistic Locking* dan *Soft Delete*.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik artikel |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul artikel |
| `slug` | `VARCHAR(255)` | `String` | - | Tidak | - | Slug URL artikel |
| `excerpt` | `TEXT` | `String` | - | Tidak | - | Ringkasan singkat artikel |
| `content` | `JSONB` | `Json` | - | Tidak | - | Isi dokumen kaya (Rich Text JSON) |
| `coverUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | URL gambar sampul |
| `coverAlt` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Teks alternatif aksesibilitas gambar |
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
Menampung data portofolio pengerjaan proyek klien Next Karya Digital Solutions.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik portofolio |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul studi kasus proyek |
| `slug` | `VARCHAR(255)` | `String` | - | Tidak | - | Slug URL portofolio |
| `clientName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama klien / jenama mitra |
| `serviceCategory` | `VARCHAR(100)` | `String` | - | Tidak | - | Kategori (Web Bisnis, CMS, dll) |
| `summary` | `TEXT` | `String` | - | Tidak | - | Ringkasan solusi & hasil proyek |
| `content` | `JSONB` | `Json` | - | Tidak | - | Rincian pengerjaan teknis (JSON) |
| `thumbnailUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Gambar pratinjau kartu |
| `thumbnailAlt` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Teks alt aksesibilitas |
| `technologies` | `TEXT[]` | `String[]` | - | Tidak | `{}` | Daftar teknologi (Next.js, Tailwind, dll) |
| `projectUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Tautan website hasil jadi |
| `status` | `VARCHAR(32)` | `ContentStatus` | - | Tidak | `DRAFT` | DRAFT, PUBLISHED, ARCHIVED |
| `lastEditedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf terakhir yang mengubah |
| `sortOrder` | `INTEGER` | `Int` | - | Tidak | `0` | Urutan penataan kartu portofolio |
| `publishedAt` | `TIMESTAMPTZ(3)` | `DateTime?` | - | Ya | `null` | Waktu tayang publik (UTC) |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pembuatan entri (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Unique Index: `[site_id, slug]`
* Index: `[site_id, status, sortOrder]`

---

#### Tabel 6: `content_snapshots` (Snapshot Riwayat 5 Versi FIFO)
Menampung salinan cadangan artikel dan portofolio sebelum perubahan atau penerbitan.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik snapshot |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `entityType` | `VARCHAR(50)` | `String` | - | Tidak | - | Tipe entitas: `POST` atau `PORTFOLIO` |
| `entityId` | `VARCHAR(64)` | `String` | - | Tidak | - | ID artikel atau portofolio asal |
| `version` | `INTEGER` | `Int` | - | Tidak | `1` | Nomor urut versi snapshot |
| `title` | `VARCHAR(255)` | `String` | - | Tidak | - | Judul konten pada versi ini |
| `snapshotPayload`| `JSONB` | `Json` | - | Tidak | - | Seluruh data konten dalam bentuk JSON |
| `savedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf yang memicu snapshot |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu penyimpanan snapshot (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Foreign Key: `savedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, entityType, entityId, createdAt]` (Kueri daftar versi FIFO)

---

#### Tabel 7: `media` (Pustaka Berkas & Gambar)
Menampung berkas yang diunggah ke penyimpanan cloud atau server lokal.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik media |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs pemilik media |
| `fileName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama berkas tersimpan aman |
| `originalName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama berkas saat diunggah |
| `mimeType` | `VARCHAR(100)` | `String` | - | Tidak | - | Contoh: `image/webp`, `image/png` |
| `fileSize` | `INTEGER` | `Int` | - | Tidak | - | Ukuran berkas dalam byte |
| `url` | `VARCHAR(500)` | `String` | - | Tidak | - | URL publik berkas gambar |
| `altText` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Teks alternatif aksesibilitas |
| `uploadedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf pengunggah berkas |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu unggah (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `uploadedById` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, createdAt]`

---

#### Tabel 8: `redirects` (Pengalihan URL 301 Manual)
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

### Kelompok 3: CRM & Jadwal Beban Kerja Tim

#### Tabel 9: `leads` (Kotak Masuk Prospek & Pipeline CRM)
Menampung prospek klien dengan proteksi spam dan indeks cepat untuk Agenda Follow-Up.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik prospek |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Asal situs (Next Karya / Klien) |
| `clientName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama perwakilan klien |
| `companyName` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Nama badan usaha / bisnis klien |
| `whatsappNumber`| `VARCHAR(50)` | `String` | - | Tidak | - | Nomor WhatsApp aktif (format baku) |
| `email` | `VARCHAR(255)` | `String?` | - | Ya | `null` | Alamat email resmi klien |
| `serviceRequested`| `VARCHAR(100)`| `String` | - | Tidak | - | Layanan yang diminati |
| `message` | `TEXT` | `String` | - | Tidak | - | Kebutuhan awal proyek dari klien |
| `dealValue` | `BIGINT` | `BigInt` | - | Tidak | `0` | Estimasi nilai proyek (Rupiah) |
| `status` | `VARCHAR(32)` | `LeadStatus` | - | Tidak | `BARU` | BARU, DIHUBUNGI, PROPOSAL, DEAL, BATAL |
| `assignedToId` | `VARCHAR(64)` | `String?` | - | Ya | `null` | Penanggung jawab (Staf A, B, atau C) |
| `nextFollowUpDate`| `DATE` | `DateTime?` | `@db.Date` | Ya | `null` | Jadwal follow-up berikutnya (UTC Date) |
| `warrantyExpiryDate`| `DATE` | `DateTime?` | `@db.Date` | Ya | `null` | Batas akhir garansi purnajual |
| `stagingUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Tautan proyek staging |
| `productionUrl` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Tautan proyek live |
| `lastEditedById` | `VARCHAR(64)` | `String?` | - | Ya | `null` | Staf terakhir pengubah status |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu pesan masuk (UTC) |
| `updatedAt` | `TIMESTAMPTZ(3)` | `DateTime` | `@updatedAt` | Tidak | - | Kunci Optimistic Locking (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `assignedToId` merujuk ke `users(id)` ON DELETE SET NULL
* Foreign Key: `lastEditedById` merujuk ke `users(id)` ON DELETE SET NULL
* **Indeks Wajib Kinerja Kritis (< 150ms):**  
  `[site_id, nextFollowUpDate, status, assignedToId]` (Mendukung halaman "Agenda Follow-Up Hari Ini")
* Index: `[site_id, status, createdAt]` (Kueri urutan pipeline umum)
* Index: `[site_id, warrantyExpiryDate]` (Pemantauan jatuh tempo garansi)

---

#### Tabel 10: `interaction_logs` (Catatan Riwayat Diskusi CRM)
Menampung riwayat percakapan staf dengan klien per tanggal.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik catatan |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `leadId` | `VARCHAR(64)` | `String` | - | Tidak | - | Relasi ke prospek |
| `authorId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf pembuat catatan |
| `note` | `TEXT` | `String` | - | Tidak | - | Hasil percakapan / catatan tindak lanjut |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Stempel waktu catatan dibuat (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE CASCADE
* Foreign Key: `leadId` merujuk ke `leads(id)` ON DELETE CASCADE
* Foreign Key: `authorId` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, leadId, createdAt]`

---

#### Tabel 11: `project_schedules` (Timeline Beban Kerja Tim / Gantt)
Menampung alokasi pengerjaan proyek per anggota tim.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik jadwal |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `leadId` | `VARCHAR(64)` | `String?` | - | Ya | `null` | Relasi opsional ke kartu prospek deal |
| `taskName` | `VARCHAR(255)` | `String` | - | Tidak | - | Nama tugas (contoh: Desain UI Portal Web) |
| `assignedToId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf pelaksana (Programmer, Desainer, Lead) |
| `startDate` | `DATE` | `DateTime` | `@db.Date` | Tidak | - | Tanggal mulai pengerjaan |
| `endDate` | `DATE` | `DateTime` | `@db.Date` | Tidak | - | Tanggal target selesai |
| `status` | `VARCHAR(32)` | `ProjectStatus` | - | Tidak | `AKTIF` | PERSIAPAN, AKTIF, REVISI, SELESAI |
| `lastEditedById` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf terakhir pengubah jadwal |
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

#### Tabel 12: `analytics_events` (Raw Event Kunjungan, TTL 90 Hari)
Menampung sinyal kunjungan mentah yang dikirim via `navigator.sendBeacon`. Tidak menyimpan PII dan tidak ada kolom kota di Fase 1.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BIGSERIAL` | `BigInt` | `@id @default(autoincrement())` | Tidak | Auto | ID autoincrement efisien |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `eventName` | `VARCHAR(50)` | `String` | - | Tidak | - | `pageview`, `whatsapp_click`, `form_submit` |
| `path` | `VARCHAR(255)` | `String` | - | Tidak | - | Path URL yang dikunjungi (contoh: `/layanan`) |
| `referrer` | `VARCHAR(500)` | `String?` | - | Ya | `null` | Rujukan URL asal pengunjung |
| `source` | `VARCHAR(50)` | `String` | - | Tidak | `direct` | `google`, `instagram`, `direct`, `referral` |
| `device` | `VARCHAR(20)` | `String` | - | Tidak | `unknown` | `mobile`, `desktop`, `tablet` |
| `browser` | `VARCHAR(50)` | `String?` | - | Ya | `null` | Chrome, Safari, Edge, Firefox |
| `os` | `VARCHAR(50)` | `String?` | - | Ya | `null` | Android, iOS, Windows, macOS |
| `visitorIdHash` | `VARCHAR(64)` | `String` | - | Tidak | - | Hash anonim (IP + UA + salt harian) |
| `occurredAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu sinyal diterima (UTC) |

*Indeks:*
* Primary Key: `[id]`
* Index: `[site_id, occurredAt]` (Pembersihan harian TTL 90 hari pada pukul 02:00 WIB)
* Index: `[site_id, eventName, occurredAt]`
* Index: `[site_id, visitorIdHash, occurredAt]`

---

#### Tabel 13: `analytics_daily` (Agregasi Harian Cepat Dashboard)
Menampung data teragregasi untuk menyajikan kueri grafik 30 hari secara instan (< 100 milidetik).

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `BIGSERIAL` | `BigInt` | `@id @default(autoincrement())` | Tidak | Auto | ID autoincrement |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `date` | `DATE` | `DateTime` | `@db.Date` | Tidak | - | Tanggal agregasi (UTC Date) |
| `path` | `VARCHAR(255)` | `String` | - | Tidak | - | Path halaman |
| `source` | `VARCHAR(50)` | `String` | - | Tidak | `direct` | Saluran rujukan trafik |
| `device` | `VARCHAR(20)` | `String` | - | Tidak | `unknown` | Jenis perangkat |
| `pageviews` | `INTEGER` | `Int` | - | Tidak | `0` | Akumulasi total tayangan halaman |
| `visitors` | `INTEGER` | `Int` | - | Tidak | `0` | Total Daily Unique Visitors pada hari tersebut |
| `sessions` | `INTEGER` | `Int` | - | Tidak | `0` | Total sesi aktif |
| `bounces` | `INTEGER` | `Int` | - | Tidak | `0` | Jumlah kunjungan 1 halaman saja |
| `durationSec` | `INTEGER` | `Int` | - | Tidak | `0` | Akumulasi durasi waktu aktif (detik) |
| `conversions` | `INTEGER` | `Int` | - | Tidak | `0` | Total aksi konversi (klik WA + submit form) |

*Indeks:*
* Primary Key: `[id]`
* **Indeks Unik Agregasi Wajib:**  
  `[site_id, date, path, source, device]`
* Index: `[site_id, date]` (Kueri rentang filter dashboard: 7 hari, 30 hari)

---

#### Tabel 14: `rate_limits` (Penyimpanan Rate Limit Sliding-Window)
Menampung counter pembatasan akses bot per IP untuk form CRM dan endpoint analitik.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `key` | `VARCHAR(255)` | `String` | `@id` | Tidak | - | Gabungan `[action:ipAddress]` |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs |
| `count` | `INTEGER` | `Int` | - | Tidak | `1` | Jumlah request dalam jendela aktif |
| `expiresAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | - | Waktu kadaluarsa jendela (UTC) |

*Indeks:*
* Primary Key: `[key]`
* Index: `[expiresAt]` (Pembersihan rekaman kadaluarsa otomatis)

---

### Kelompok 5: Keamanan & Tanggap Darurat (*Emergency Toolkit*)

#### Tabel 15: `emergency_audit_logs` (Jejak Audit Aksi Darurat & Rollback)
Mencatat seluruh aksi takedown konten, penguncian form, banner darurat, dan pengalihan tugas staf.

| Nama Kolom | Tipe PostgreSQL | Tipe Prisma | Atribut | Nullable | Default | Keterangan |
| :--- | :--- | :--- | :--- | :---: | :--- | :--- |
| `id` | `VARCHAR(64)` | `String` | `@id @default(cuid())` | Tidak | CUID | ID unik log audit |
| `site_id` | `VARCHAR(64)` | `String` | - | Tidak | `nextkarya-main` | Identitas situs tempat insiden terjadi |
| `actorId` | `VARCHAR(64)` | `String` | - | Tidak | - | Staf yang mengeksekusi aksi |
| `actionType` | `VARCHAR(50)` | `EmergencyActionType` | - | Tidak | - | Jenis tindakan darurat |
| `targetEntity` | `VARCHAR(50)` | `String` | - | Tidak | - | Entitas terdampak (`POST`, `FORM`, `LEAD`) |
| `targetId` | `VARCHAR(64)` | `String?` | - | Ya | `null` | ID entitas terkait (misal: ID artikel) |
| `reason` | `TEXT` | `String` | - | Tidak | - | Alasan darurat yang diinputkan staf |
| `previousState` | `JSONB` | `Json?` | - | Ya | `null` | Status sebelum aksi (untuk kebutuhan rollback) |
| `isRolledBack` | `BOOLEAN` | `Boolean` | - | Tidak | `false` | Status apakah aksi sudah dibatalkan |
| `createdAt` | `TIMESTAMPTZ(3)` | `DateTime` | - | Tidak | `now()` | Waktu eksekusi aksi darurat (UTC) |

*Indeks & Relasi:*
* Primary Key: `[id]`
* Foreign Key: `site_id` merujuk ke `sites(id)` ON DELETE RESTRICT
* Foreign Key: `actorId` merujuk ke `users(id)` ON DELETE RESTRICT
* Index: `[site_id, actionType, createdAt]`
* Index: `[site_id, targetEntity, targetId]`

---

## 4. Berkas Skema Lengkap (`prisma/schema.prisma`)

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
  SUPER_ADMIN
  STAFF
}

enum EmergencyActionType {
  UNPUBLISH_CONTENT
  LOCK_CONTACT_FORM
  UNLOCK_CONTACT_FORM
  SET_ALERT_BANNER
  REMOVE_ALERT_BANNER
  REASSIGN_STAFF
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
  snapshots          ContentSnapshot[]
  media              Media[]
  redirects          Redirect[]
  leads              Lead[]
  interactionLogs    InteractionLog[]
  projectSchedules   ProjectSchedule[]
  analyticsEvents    AnalyticsEvent[]
  analyticsDaily     AnalyticsDaily[]
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
  savedSnapshots     ContentSnapshot[]   @relation("SnapshotAuthor")
  uploadedMedia      Media[]             @relation("MediaUploader")
  assignedLeads      Lead[]              @relation("LeadAssignee")
  editedLeads        Lead[]              @relation("LeadLastEditor")
  interactionLogs    InteractionLog[]    @relation("LogAuthor")
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
  id             String        @id @default(cuid()) @db.VarChar(64)
  site_id        String        @default("nextkarya-main") @db.VarChar(64)
  title          String        @db.VarChar(255)
  slug           String        @db.VarChar(255)
  excerpt        String        @db.Text
  content        Json          @db.JsonB
  coverUrl       String?       @db.VarChar(500)
  coverAlt       String?       @db.VarChar(255)
  status         ContentStatus @default(DRAFT)
  categoryId     String        @db.VarChar(64)
  authorId       String        @db.VarChar(64)
  lastEditedById String        @db.VarChar(64)
  seoTitle       String?       @db.VarChar(255)
  seoDescription String?       @db.Text
  publishedAt    DateTime?     @db.Timestamptz(3)
  createdAt      DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt      DateTime      @updatedAt @db.Timestamptz(3)

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
  content         Json          @db.JsonB
  thumbnailUrl    String?       @db.VarChar(500)
  thumbnailAlt    String?       @db.VarChar(255)
  technologies    String[]      @default([])
  projectUrl      String?       @db.VarChar(500)
  status          ContentStatus @default(DRAFT)
  lastEditedById  String        @db.VarChar(64)
  sortOrder       Int           @default(0)
  publishedAt     DateTime?     @db.Timestamptz(3)
  createdAt       DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt       DateTime      @updatedAt @db.Timestamptz(3)

  site       Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  lastEditor User @relation("PortfolioLastEditor", fields: [lastEditedById], references: [id], onDelete: Restrict)

  @@unique([site_id, slug])
  @@index([site_id, status, sortOrder])
  @@map("portfolios")
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

  @@index([site_id, entityType, entityId, createdAt])
  @@map("content_snapshots")
}

model Media {
  id           String   @id @default(cuid()) @db.VarChar(64)
  site_id      String   @default("nextkarya-main") @db.VarChar(64)
  fileName     String   @db.VarChar(255)
  originalName String   @db.VarChar(255)
  mimeType     String   @db.VarChar(100)
  fileSize     Int
  url          String   @db.VarChar(500)
  altText      String?  @db.VarChar(255)
  uploadedById String   @db.VarChar(64)
  createdAt    DateTime @default(now()) @db.Timestamptz(3)

  site       Site @relation(fields: [site_id], references: [id], onDelete: Restrict)
  uploadedBy User @relation("MediaUploader", fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([site_id, createdAt])
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
  eventName     String   @db.VarChar(50)
  path          String   @db.VarChar(255)
  referrer      String?  @db.VarChar(500)
  source        String   @default("direct") @db.VarChar(50)
  device        String   @default("unknown") @db.VarChar(20)
  browser       String?  @db.VarChar(50)
  os            String?  @db.VarChar(50)
  visitorIdHash String   @db.VarChar(64)
  occurredAt    DateTime @default(now()) @db.Timestamptz(3)

  site Site @relation(fields: [site_id], references: [id], onDelete: Cascade)

  @@index([site_id, occurredAt])
  @@index([site_id, eventName, occurredAt])
  @@index([site_id, visitorIdHash, occurredAt])
  @@map("analytics_events")
}

model AnalyticsDaily {
  id          BigInt   @id @default(autoincrement())
  site_id     String   @default("nextkarya-main") @db.VarChar(64)
  date        DateTime @db.Date
  path        String   @db.VarChar(255)
  source      String   @default("direct") @db.VarChar(50)
  device      String   @default("unknown") @db.VarChar(20)
  pageviews   Int      @default(0)
  visitors    Int      @default(0)
  sessions    Int      @default(0)
  bounces     Int      @default(0)
  durationSec Int      @default(0)
  conversions Int      @default(0)

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

  @@index([expiresAt])
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

## 5. Rencana Data Awal (*Seed Data*)

Saat inisialisasi basis data pertama kali, sistem akan menyuntikkan data awal wajib:

### 5.1 Situs Master
```json
{
  "id": "nextkarya-main",
  "name": "Next Karya Digital Solutions",
  "domain": "nextkarya.id",
  "isActive": true,
  "isFormLocked": false,
  "isAlertActive": false
}
```

### 5.2 Tiga Akun Staf Internal
Seluruh akun staf internal menggunakan domain resmi `@nextkarya.id`:

| Email | Nama Lengkap | Jabatan (*jobTitle*) | Role |
| :--- | :--- | :--- | :--- |
| `programmer@nextkarya.id` | Staf A (Programmer) | Full-Stack Developer | `STAFF` |
| `designer@nextkarya.id` | Staf B (Desainer) | UI/UX & Visual Designer | `STAFF` |
| `lead@nextkarya.id` | Staf C (Project Lead) | Project Lead & Client Relations | `SUPER_ADMIN` |

---

## 6. Prosedur Pembersihan Berkala (*Cron Job Maintenance*)

Untuk menjaga kinerja basis data PostgreSQL tetap optimal:

### 6.1 Pembersihan Raw Analytics (Pukul 02:00 WIB Setiap Hari)
Menghapus rekaman `analytics_events` yang lebih tua dari 90 hari:
```sql
DELETE FROM analytics_events 
WHERE "occurredAt" < NOW() - INTERVAL '90 days';
```

### 6.2 Pemangkasan Snapshot Konten (*Pruning FIFO 5 Versi*)
Setiap kali artikel atau portofolio disimpan, fungsi pemicu backend memastikan hanya 5 versi terbaru yang disimpan:
```sql
DELETE FROM content_snapshots 
WHERE "id" IN (
  SELECT "id" FROM (
    SELECT "id", ROW_NUMBER() OVER (
      PARTITION BY "site_id", "entityType", "entityId" 
      ORDER BY "createdAt" DESC
    ) AS row_num
    FROM content_snapshots
    WHERE "entityType" = $1 AND "entityId" = $2
  ) ranked
  WHERE ranked.row_num > 5
);
```
