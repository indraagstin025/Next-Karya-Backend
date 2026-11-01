# Spesifikasi Kontrak REST API & Integrasi Klien (Web & Mobile Flutter)
**Next Karya Digital Solutions**  
*Cetak Biru Rute REST API Express.js, Skema Validasi Zod TypeScript, Format Respons Standar, dan Pengamanan Endpoint*  
*Versi: 1.0 Kanonik (Express.js TypeScript Backend & Multiplatform Consumer)*  
*Tanggal: 31 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Tujuh Keputusan Beku Arsitektur API (*Frozen Decisions*)

Tujuh prinsip di bawah ini merupakan ketetapan arsitektur yang dikunci untuk rute `/api/v1`. Seluruh tim pengembang backend Express.js (TypeScript) maupun frontend Web Next.js dan mobile Flutter wajib mengikutinya tanpa deviasi:

### 1.1 Base URL & Kebijakan Versi Rute
* Seluruh endpoint pada dokumen ini berada di bawah rute dasar: `/api/v1`.
* **Kebijakan Anti-Breaking:** Modifikasi yang merusak kontrak data (mengubah nama kolom, menghapus field, atau menghapus endpoint) dilarang keras dilakukan pada `/api/v1`. Jika di kemudian hari terdapat perombakan struktur data besar, rute wajib dinaikkan ke `/api/v2`. Pada `/api/v1`, pengembang hanya diperbolehkan menambahkan field opsional baru.

### 1.2 Lingkup Pengguna Fase 1 (Internal Eksklusif)
* Seluruh endpoint terproteksi dikhususkan bagi 3 anggota tim internal Next Karya Digital Solutions dengan identitas bawaan `site_id: "nextkarya-main"`.
* Fitur pendaftaran, login mandiri, atau panel portal untuk akun klien resmi dialokasikan untuk Fase 2. Tidak ada endpoint login klien pada `/api/v1`.

### 1.3 Penamaan Field Bersih & Konsisten
* Mengikuti skema basis data `v1.1` secara presisi:
  - Kolom pengenal situs wajib ditulis menggunakan format snake_case: `site_id` (baik dalam query string, body JSON, maupun header).
  - Seluruh field entitas lainnya wajib ditulis menggunakan camelCase: `lastEditedById`, `visitorIdHash`, `nextFollowUpDate`, `warrantyExpiryDate`, `whatsappClicks`, `formSubmits`, `sessionId`, `durationSec`, `readingTimeMinutes`, `relatedPostIds`.
  - Dilarang keras menuliskan `siteId` pada endpoint apa pun.

### 1.4 Keselarasan Nilai Enum Baku
* Nilai enum dikunci identik 100% dengan skema basis data kanonik [`schema-database-v1.1.md`](./schema-database-v1.1.md) (Bab 2.5, Tabel 20, dan model Prisma):
  - `ContentStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
  - `LeadStatus`: `BARU`, `DIHUBUNGI`, `PROPOSAL`, `DEAL`, `BATAL`
  - `ProjectStatus`: `PERSIAPAN`, `AKTIF`, `REVISI`, `SELESAI`
  - `UserRole`: `STAFF` (satu peran tunggal yang setara)
  - `EmergencyActionType`: `UNPUBLISH_CONTENT`, `LOCK_CONTACT_FORM`, `UNLOCK_CONTACT_FORM`, `SET_ALERT_BANNER`, `REMOVE_ALERT_BANNER`, `REASSIGN_STAFF`, `REVOKE_SESSION` (selaras penuh untuk pencabutan darurat sesi staf HP hilang)
  - `AnalyticsEventName`: `pageview`, `whatsapp_click`, `form_submit`, `heartbeat`

### 1.5 Format Respons Tunggal (*Single Envelope Pattern*)
Seluruh endpoint di sistem mengembalikan amplop data yang seragam. Dilarang mengembalikan array mentah atau format acak.

#### Respons Berhasil (*Success Response*):
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  },
  "error": null
}
```
*Catatan:* Pada respons tunggal (non-list), objek `meta` bernilai `null`.

#### Respons Gagal (*Error Response*):
```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validasi data input gagal diproses.",
    "details": [
      {
        "field": "whatsappNumber",
        "message": "Nomor WhatsApp harus diawali dengan 08 atau +62 dan minimal 10 digit."
      }
    ]
  }
}
```

### 1.6 Standardisasi Kode Status HTTP & Format Error
* `200 OK`: Permintaan berhasil diproses.
* `201 Created`: Entitas baru berhasil dibuat (misal artikel baru, tugas timeline).
* `400 Bad Request`: Validasi skema Zod gagal, disertai rincian array `details: [{ field, message }]`.
* `401 Unauthorized`: Kredensial tidak ada, token JWT kadaluarsa, atau tanda tangan token tidak sah.
* `403 Forbidden`: Token valid, namun versi token telah dicabut (*stale tokenVersion*) atau tidak memiliki izin aksi.
* `404 Not Found`: Parameter `site_id` atau ID catatan data tidak ditemukan di database.
* `409 Conflict`: Terjadi konflik konkurensi stempel `updatedAt` (*Optimistic Locking*). Server mengembalikan data entitas terkini di dalam objek `error.currentData` agar staf dapat membandingkan perubahannya.
* `429 Too Many Requests`: Pembatasan laju (*Rate Limit*) terlampaui. Server wajib menyertakan header HTTP: `Retry-After: <detik>`.
* `500 Internal Server Error`: Kesalahan sistem internal tak terduga. Rincian sensitif stack trace disembunyikan di lingkungan produksi.

### 1.7 Penyeragaman Format Waktu (ISO 8601 UTC)
* Seluruh data tanggal dan stempel waktu yang dikirim atau diterima melalui API wajib berformat string standar ISO 8601 UTC dengan akhiran `Z` (contoh: `"2026-10-30T16:24:00.000Z"`).
* Lapisan antarmuka pengguna (Web Desktop dan Flutter Mobile) bertanggung jawab penuh melakukan konversi waktu ke Waktu Indonesia Barat (WIB / UTC+7) saat disajikan kepada staf.

---

## 2. Aturan Global Kueri & Paginasi

1. **Konvensi Paginasi Default:**
   - Parameter: `?page=1&limit=20`
   - Nilai default: `page = 1`, `limit = 20`.
   - Batas maksimal: `limit = 100` per permintaan. Jika klien mengirimkan `limit > 100`, backend otomatis memotongnya menjadi 100.
2. **Konvensi Pengurutan (*Sorting*):**
   - Parameter: `?sortBy=createdAt&sortOrder=desc`
   - Nilai `sortOrder` hanya menerima `asc` atau `desc`.
3. **Pencarian Teks Bebas (*Search*):**
   - Parameter: `?search=kata_kunci`
   - Melakukan pencarian case-insensitive pada kolom judul, nama klien, atau nama bisnis.

---

## 3. Spesifikasi Endpoint Publik (Tanpa Autentikasi)

Endpoint publik digunakan oleh antarmuka website resmi `nextkarya.web.id` untuk menampilkan katalog konten. Diberlakukan pembatasan laju (*Rate Limiting*) maksimal 120 permintaan per menit per IP.

### 3.1 `GET /api/v1/articles` (Daftar Artikel Publik)
* **Deskripsi:** Mengambil daftar artikel blog yang sudah berstatus terbit.
* **Query Parameters:**
  - `site_id` (Wajib, string): Contoh `"nextkarya-main"`.
  - `status` (Opsional, string): Bawaan `"PUBLISHED"`. Pada endpoint publik, kueri dipaksa hanya mengambil `PUBLISHED`.
  - `category` (Opsional, string): Slug kategori artikel.
  - `tag` (Opsional, string): Filter berdasarkan tag.
  - `page` (Opsional, integer): Halaman aktif.
  - `limit` (Opsional, integer): Jumlah data per halaman.
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxpost01",
      "site_id": "nextkarya-main",
      "title": "Tren Desain Web Modern 2026 untuk Agensi Digital",
      "slug": "tren-desain-web-modern-2026",
      "excerpt": "Panduan lengkap mengenai tata kelola komponen visual dan performa situs.",
      "coverUrl": "https://nextkarya.web.id/uploads/cover-01.webp",
      "coverAlt": "Ilustrasi Tren Desain Web 2026",
      "tags": ["web-design", "technology"],
      "readingTimeMinutes": 4,
      "category": {
        "id": "clxcat01",
        "name": "Tren Teknologi",
        "slug": "tren-teknologi"
      },
      "author": {
        "fullName": "Staf A (Programmer)",
        "jobTitle": "Full-Stack Developer",
        "avatarUrl": null
      },
      "publishedAt": "2026-10-30T10:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "error": null
}
```

### 3.2 `GET /api/v1/articles/:slug` (Detail Artikel Publik)
* **Deskripsi:** Mengambil satu artikel utuh beserta isi konten dokumen kaya dan daftar rekomendasi artikel terkait.
* **Query Parameters:** `site_id` (Wajib).
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "clxpost01",
    "site_id": "nextkarya-main",
    "title": "Tren Desain Web Modern 2026 untuk Agensi Digital",
    "slug": "tren-desain-web-modern-2026",
    "excerpt": "Panduan lengkap mengenai tata kelola komponen visual dan performa situs.",
    "content": {
      "blocks": [
        { "type": "paragraph", "text": "Arsitektur frontend saat ini menitikberatkan pada kemudahan pemuatan data..." }
      ]
    },
    "coverUrl": "https://nextkarya.web.id/uploads/cover-01.webp",
    "coverAlt": "Ilustrasi Tren Desain Web 2026",
    "tags": ["web-design", "technology"],
    "readingTimeMinutes": 4,
    "seoTitle": "Tren Desain Web Modern 2026 | Next Karya",
    "seoDescription": "Pelajari tren desain web terbaru untuk meningkatkan konversi agensi.",
    "category": { "name": "Tren Teknologi", "slug": "tren-teknologi" },
    "author": { "fullName": "Staf A (Programmer)", "jobTitle": "Full-Stack Developer" },
    "publishedAt": "2026-10-30T10:00:00.000Z",
    "relatedPosts": [
      { "id": "clxpost02", "title": "Optimalisasi Kecepatan Website", "slug": "optimalisasi-kecepatan-website" }
    ]
  },
  "meta": null,
  "error": null
}
```

### 3.3 `GET /api/v1/portfolios` & `GET /api/v1/portfolios/:slug` (Portofolio Publik)
* **Filter:** `?site_id=nextkarya-main&isFeatured=true&limit=6`
* **Field Utama:** `title`, `slug`, `clientName`, `serviceCategory`, `summary`, `impactSummary`, `metricResult`, `technologies`, `thumbnailUrl`, `projectUrl`.

### 3.4 `GET /api/v1/services` (Katalog Layanan & Harga)
* **Query Parameters:** `?site_id=nextkarya-main`
* **Field Utama:** `title`, `slug`, `icon`, `shortDesc`, `features`, `priceLabel`, `priceNote`, `badge`, `ctaLabel`, `ctaHref`, `sortOrder`.

### 3.5 `GET /api/v1/faqs` (Daftar FAQ)
* **Query Parameters:** `?site_id=nextkarya-main&category=Umum`
* **Filter Otomatis:** Hanya mengembalikan rekaman dengan `isActive: true`, diurutkan berdasarkan `sortOrder ASC`.

### 3.6 `GET /api/v1/testimonials` (Ulasan Klien)
* **Query Parameters:** `?site_id=nextkarya-main`
* **Filter Otomatis:** Hanya mengembalikan rekaman dengan `status: "PUBLISHED"`, diurutkan berdasarkan `sortOrder ASC`. Memuat relasi opsional `portfolio: { title, slug }`.

### 3.7 `GET /api/v1/pages/:slug` (Halaman Statis)
* **Query Parameters:** `?site_id=nextkarya-main`
* **Field Utama:** `title`, `slug`, `content`, `seoTitle`, `seoDescription`.

---

## 4. Spesifikasi Endpoint Intake Publik (Proteksi Ketat)

Hanya terdapat 2 endpoint intake publik. Kedua endpoint ini tidak memerlukan token Bearer, namun dilindungi oleh mekanisme pertahanan berlapis (*Defense-in-Depth*).

### 4.1 `POST /api/v1/leads` (Kotak Masuk Prospek Form Website)
Ini adalah **satu-satunya pintu intake publik untuk formulir konsultasi website**. Staf internal yang memasukkan data prospek secara manual wajib menggunakan endpoint CRM internal.

* **Pengamanan Berlapis:**
  1. **Rate Limiting:** Maksimal 5 pengiriman pesan per 15 menit per IP. Jika terlampaui, server mengembalikan status 429 Too Many Requests dan header `Retry-After: 900`.
  2. **Perangkap Bot (*Honeypot*):** Field tersembunyi `website_url`. Jika terisi string apa pun, server membalas dengan status palsu `200 OK` tanpa menyimpan data ke PostgreSQL.
  3. **Validasi Panjang Teks:** Pesan dibatasi maksimal 2.000 karakter.
  4. **Validasi Format WhatsApp:** Wajib format angka valid Indonesia (diawali `08` atau `+62` dengan panjang 10 hingga 15 digit).
* **Skema Request Body (Zod TypeScript Schema):**
```typescript
const CreateLeadPublicSchema = z.object({
  site_id: z.string().min(1).default("nextkarya-main"),
  clientName: z.string().trim().min(2, "Nama minimal 2 karakter").max(255),
  companyName: z.string().trim().max(255).optional().nullable(),
  whatsappNumber: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid"),
  email: z.string().email("Format email tidak valid").optional().nullable(),
  serviceRequested: z.string().min(1, "Pilih salah satu layanan"),
  message: z.string().trim().min(5, "Pesan minimal 5 karakter").max(2000, "Pesan maksimal 2.000 karakter"),
  website_url: z.string().max(0, "Honeypot trap").optional() // Wajib kosong untuk manusia
});
```
* **Contoh Request Payload:**
```json
{
  "site_id": "nextkarya-main",
  "clientName": "Budi Santoso",
  "companyName": "PT Sentosa Mandiri",
  "whatsappNumber": "081234567890",
  "email": "budi@sentosamandiri.com",
  "serviceRequested": "Website Bisnis Instan",
  "message": "Halo Next Karya, kami membutuhkan website profil perusahaan baru.",
  "website_url": ""
}
```
* **Format Respons Berhasil (201 Created):**
```json
{
  "success": true,
  "data": {
    "message": "Pesan konsultasi Anda berhasil kami terima. Tim kami akan segera menghubungi Anda."
  },
  "meta": null,
  "error": null
}
```

---

### 4.2 `POST /api/v1/analytics/event` (Pengiriman Sinyal Pelacak Beacon)
Menerima sinyal aktivitas kunjungan dari peramban pengunjung tanpa memblokir rendering halaman (`navigator.sendBeacon`).

* **Pengamanan & Batasan:**
  1. **Rate Limiting:** Maksimal 60 request per menit per IP.
  2. **Batas Ukuran Payload:** Maksimal 2 KB.
  3. **Verifikasi `site_id` Aktif:** Memastikan situs terdaftar di basis data.
  4. **Verifikasi Header Origin:** Memeriksa domain pemanggil sebagai filter tambahan (*defense-in-depth*).
  5. **Nilai `eventName` Dikunci (4 Enum):** `pageview`, `whatsapp_click`, `form_submit`, `heartbeat`.
  6. **Aturan Baku `durationSec`:**
     - Nilai `durationSec` **hanya boleh lebih dari 0 pada event `heartbeat`**.
     - Pada event `pageview`, `whatsapp_click`, dan `form_submit`, nilai `durationSec` **wajib bernilai 0**.
     - Skrip klien mengirim event `heartbeat` setiap 15 detik selama tab aktif dan sekali lagi saat tab ditutup (*visibilitychange / pagehide*) dengan `sessionId` yang sama.
* **Skema Request Body (Zod TypeScript Schema):**
```typescript
const AnalyticsEventSchema = z.object({
  site_id: z.string().min(1),
  sessionId: z.string().min(10).max(64),
  eventName: z.enum(["pageview", "whatsapp_click", "form_submit", "heartbeat"]),
  path: z.string().min(1).max(255),
  referrer: z.string().max(500).optional().nullable(),
  source: z.string().max(50).default("direct"),
  device: z.enum(["mobile", "desktop", "tablet", "unknown"]).default("unknown"),
  browser: z.string().max(50).optional().nullable(),
  os: z.string().max(50).optional().nullable(),
  durationSec: z.number().int().min(0).max(86400).default(0)
}).refine(data => {
  if (data.eventName !== "heartbeat" && data.durationSec > 0) {
    return false;
  }
  return true;
}, {
  message: "durationSec hanya boleh bernilai > 0 pada event heartbeat"
});
```
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": { "status": "recorded" },
  "meta": null,
  "error": null
}
```

---

## 5. Spesifikasi Endpoint Terproteksi (Bearer JWT, Role STAFF)

Seluruh endpoint berikut wajib menyertakan header HTTP:
`Authorization: Bearer <ACCESS_TOKEN>`

Backend memverifikasi keabsahan JWT dan mencocokkan `tokenVersion` di dalam klaim token dengan nilai terkini di tabel `users`. Jika nilai tidak cocok (misal sesi telah dicabut karena insiden HP hilang), request langsung ditolak dengan status **403 Forbidden**.

### 5.1 Autentikasi Staf & Pencabutan Sesi Darurat

#### `POST /api/v1/auth/login`
* **Deskripsi:** Masuk ke sistem untuk 3 staf internal.
* **Masa Berlaku Token:** Token JWT menggunakan masa kedaluwarsa `expiresIn: 86400` (24 jam) tanpa sistem refresh token di Fase 1. Setelah 24 jam token kedaluwarsa dan staf wajib melakukan login ulang. Dilarang mengarang rute refresh token di Fase 1.
* **Body:** `{ "email": "programmer@nextkarya.web.id", "password": "..." }`
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "expiresIn": 86400,
    "user": {
      "id": "clxuser01",
      "email": "programmer@nextkarya.web.id",
      "fullName": "Staf A (Programmer)",
      "jobTitle": "Full-Stack Developer",
      "role": "STAFF",
      "tokenVersion": 0
    }
  },
  "meta": null,
  "error": null
}
```

#### `POST /api/v1/users/:id/revoke-sessions` (Pemutusan Sesi HP Hilang Fase 1)
* **Deskripsi:** Menaikkan nilai `tokenVersion` staf tersebut di database. Seketika seluruh token JWT yang beredar pada perangkat lama staf tersebut menjadi tidak sah pada request berikutnya.
* **Pencatatan Audit Log:** Aksi keamanan ini otomatis dicatat ke dalam tabel `emergency_audit_logs` dengan `actionType: "REVOKE_SESSION"`, `targetEntity: "USER"`, `targetId: id`, dan `reason: "Pencabutan darurat sesi HP hilang/tertinggal"`.
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": {
    "message": "Seluruh sesi perangkat untuk staf ini berhasil dicabut.",
    "newTokenVersion": 1,
    "auditLogged": true
  },
  "meta": null,
  "error": null
}
```

---

### 5.2 Modul CMS (Konten, Optimistic Locking & Pengecualian Entitas)

Mendukung manajemen konten untuk seluruh 6 entitas CMS dengan mekanisme *Optimistic Locking* wajib.

#### Aturan Wajib Optimistic Locking pada Update:
Setiap kali melakukan mutasi pembaruan (`PUT`, `PATCH`, `publish`, `archive`), klien **wajib menyertakan kolom `updatedAt`** yang didapatkan dari pembacaan data terakhir.
* Jika `updatedAt` di request cocok dengan database: Pembaruan berhasil diproses, dan server mengembalikan stempel `updatedAt` yang baru.
* Jika `updatedAt` di request lebih usang daripada database (telah diubah staf lain): Server menolak penyimpanan dengan status **409 Conflict** dan mengembalikan data entitas terkini:
```json
{
  "success": false,
  "data": null,
  "meta": null,
  "error": {
    "code": "CONCURRENT_MODIFICATION_CONFLICT",
    "message": "Data ini baru saja diperbarui oleh rekan kerja Anda. Silakan tinjau perubahan terkini.",
    "currentData": {
      "id": "clxpost01",
      "title": "Judul Baru yang Diedit Rekan Kerja",
      "updatedAt": "2026-10-30T16:20:00.000Z",
      "lastEditor": { "fullName": "Staf B (Desainer)" }
    }
  }
}
```

#### Rincian Rute per Entitas CMS:

1. **Artikel (`posts`), Portofolio (`portfolios`), Layanan (`services`), dan Halaman (`pages`):**
   - Mengikuti siklus hidup konten lengkap: Draf -> Publikasi -> Arsip.
   - `POST /api/v1/{posts|portfolios|services|pages}`: Membuat draf konten baru (`status: DRAFT`).
   - `GET /api/v1/{posts|portfolios|services|pages}`: Mengambil daftar internal dengan filter status `?status=DRAFT|PUBLISHED|ARCHIVED`.
   - `GET /api/v1/{posts|portfolios|services|pages}/:id`: Detail konten internal.
   - `PATCH /api/v1/{posts|portfolios|services|pages}/:id`: Menyimpan perubahan draf (wajib menyertakan `updatedAt`).
   - `POST /api/v1/{posts|portfolios|services|pages}/:id/publish`:
     - Alur Kerja: Menyimpan snapshot otomatis ke `content_snapshots` (maksimal 5 versi FIFO), mengubah status menjadi `PUBLISHED`, memperbarui `publishedAt`, dan otomatis memicu webhook revalidasi cache publik Next.js.
   - `POST /api/v1/{posts|portfolios|services|pages}/:id/archive`: Soft delete konten ke status `ARCHIVED` (tidak tampil di publik, data tetap utuh di database).
   - `POST /api/v1/content-snapshots/:id/restore`: Memulihkan konten ke versi snapshot tersebut.

2. **Pertanyaan Umum (`faqs`) [Pengecualian: Tanpa Publish/Archive]:**
   - FAQ tidak menggunakan alur draf/publish/archive yang berbelit, melainkan menggunakan sakelar boolean `isActive`.
   - `POST /api/v1/faqs`: Membuat pertanyaan FAQ baru (default `isActive: true`, `category: "Umum"`).
   - `GET /api/v1/faqs`: Daftar seluruh FAQ internal (aktif maupun nonaktif).
   - `GET /api/v1/faqs/:id`: Detail FAQ.
   - `PATCH /api/v1/faqs/:id`: Memperbarui teks pertanyaan/jawaban atau mengubah toggle keaktifan (`isActive: boolean`) dengan validasi `updatedAt`.
   - `DELETE /api/v1/faqs/:id`: Melakukan soft toggle dengan mengubah status keaktifan FAQ menjadi nonaktif (`isActive: false`) secara aman tanpa menghapus baris dari database, selaras dengan prinsip soft delete sistem.
   - *Catatan:* Tidak ada endpoint `/publish` atau `/archive` untuk FAQs.

3. **Ulasan Klien (`testimonials`) [Pengecualian: Default PUBLISHED]:**
   - Testimoni secara default berstatus `PUBLISHED` karena merupakan kutipan yang telah dikurasi dan disetujui klien sebelumnya.
   - `POST /api/v1/testimonials`: Membuat ulasan baru (default status `PUBLISHED`, opsional `DRAFT`).
   - `GET /api/v1/testimonials`: Mengambil daftar testimoni internal.
   - `PATCH /api/v1/testimonials/:id`: Memperbarui isi ulasan, rating, atau relasi portofolio dengan validasi `updatedAt`.
   - `POST /api/v1/testimonials/:id/archive`: Mengarsipkan ulasan agar tidak lagi tampil di website publik.

---

### 5.3 Modul Media (Unggah & Galeri Berkas)

#### 1. `GET /api/v1/media` (Pustaka Galeri Berkas)
* **Deskripsi:** Mengambil daftar pustaka media untuk dipilih di editor CMS atau galeri portofolio.
* **Query Parameters:**
  - `site_id` (Wajib, string): Contoh `"nextkarya-main"`.
  - `search` (Opsional, string): Mencari nama berkas (`originalName`) atau teks alt (`altText`).
  - `mimeType` (Opsional, string): Filter tipe berkas (contoh: `image/webp`, `application/pdf`).
  - `page` (Opsional, integer): Default 1.
  - `limit` (Opsional, integer): Default 20, maksimal 100.
  - `sortBy` (Opsional, string): Default `createdAt`.
  - `sortOrder` (Opsional, string): Default `desc`.
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxmed01",
      "site_id": "nextkarya-main",
      "fileName": "sec-thumb-1730304000.webp",
      "originalName": "header-banner.png",
      "mimeType": "image/webp",
      "fileSize": 245000,
      "width": 1920,
      "height": 1080,
      "url": "https://nextkarya.web.id/uploads/sec-thumb-1730304000.webp",
      "altText": "Desain antarmuka Next Karya",
      "uploadedBy": { "fullName": "Staf B (Desainer)" },
      "createdAt": "2026-10-30T16:25:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  },
  "error": null
}
```

#### 2. `POST /api/v1/media` (Unggah Multipart Form Data)
* **Batasan Ukuran & Format Eksplisit:**
  - Gambar: Maksimal **5 MB**. Tipe yang diizinkan: `image/webp`, `image/png`, `image/jpeg`, `image/svg+xml`.
  - Dokumen PDF: Maksimal **10 MB**. Tipe yang diizinkan: `application/pdf`.
  - Berkas di luar tipe di atas langsung ditolak dengan status 400 Bad Request.
* **Header:** `Content-Type: multipart/form-data`
* **Form Fields:** `site_id`, `file` (Binary), `altText` (Opsional).
* **Format Respons Berhasil (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "clxmed01",
    "site_id": "nextkarya-main",
    "fileName": "sec-thumb-1730304000.webp",
    "originalName": "header-banner.png",
    "mimeType": "image/webp",
    "fileSize": 245000,
    "width": 1920,
    "height": 1080,
    "url": "https://nextkarya.web.id/uploads/sec-thumb-1730304000.webp",
    "altText": "Desain antarmuka Next Karya",
    "createdAt": "2026-10-30T16:25:00.000Z"
  },
  "meta": null,
  "error": null
}
```

#### 3. `DELETE /api/v1/media/:id` (Hapus Berkas)
* **Deskripsi:** Menghapus berkas media jika tidak lagi digunakan. Jika media masih terikat pada artikel publik atau portofolio aktif, penghapusan ditolak dengan status 400 Bad Request.

---

### 5.4 Modul CRM & Beban Kerja Tim

#### 1. `POST /api/v1/crm/leads` (Input Manual Internal Staf)
* **Deskripsi:** Endpoint khusus staf internal untuk memasukkan data prospek yang datang dari jalur luar website (misal: telepon langsung, kenalan pribadi, atau temu tatap muka).
* **Perbedaan dari Endpoint Publik:**
  - Terproteksi dengan header Bearer JWT (role `STAFF`).
  - Tidak memerlukan perangkap honeypot `website_url`.
  - Tidak terikat pada rate limit publik (5 req/15 menit).
  - Staf dapat langsung memilih `assignedToId`, memasukkan `dealValue`, status pipeline, dan tanggal `nextFollowUpDate`.
  - Otomatis mencatat entri baru ke tabel `activity_logs`.
* **Skema Request Body (Zod TypeScript Schema):**
```typescript
const CreateLeadInternalSchema = z.object({
  site_id: z.string().min(1).default("nextkarya-main"),
  clientName: z.string().trim().min(2).max(255),
  companyName: z.string().trim().max(255).optional().nullable(),
  whatsappNumber: z.string().regex(/^(\+62|62|0)8[1-9][0-9]{6,11}$/, "Format nomor WhatsApp tidak valid"),
  email: z.string().email().optional().nullable(),
  serviceRequested: z.string().min(1),
  message: z.string().trim().min(5).max(2000),
  dealValue: z.number().int().min(0).default(0),
  status: z.enum(["BARU", "DIHUBUNGI", "PROPOSAL", "DEAL", "BATAL"]).default("BARU"),
  assignedToId: z.string().optional().nullable(),
  nextFollowUpDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format YYYY-MM-DD").optional().nullable() // Format DATE
});
```
* **Format Respons Berhasil (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "clxlead02",
    "site_id": "nextkarya-main",
    "clientName": "Bapak Hendra",
    "companyName": "CV Maju Bersama",
    "whatsappNumber": "081398765432",
    "dealValue": 15000000,
    "status": "BARU",
    "assignedToId": "clxuser01",
    "nextFollowUpDate": "2026-10-31",
    "createdAt": "2026-10-30T16:30:00.000Z"
  },
  "meta": null,
  "error": null
}
```

#### 2. `GET /api/v1/crm/follow-up-today` (Halaman Agenda Kerja Harian)
Ini adalah halaman kerja operasional pagi hari yang dibuka oleh ketiga anggota tim. Menampilkan seluruh prospek yang harus dihubungi hari ini atau yang sudah terlewat.
* **Kueri Database:** Memanfaatkan indeks gabungan `[site_id, nextFollowUpDate, status, assignedToId]`.
* **Kriteria Penyaringan:** `status IN ('BARU', 'DIHUBUNGI', 'PROPOSAL') AND nextFollowUpDate <= CURRENT_DATE`. Diurutkan berdasarkan `nextFollowUpDate ASC`.
* **Aturan Penentuan Kolom `priority`:**
  - Jika `nextFollowUpDate == CURRENT_DATE` (Waktu Indonesia Barat) -> `priority = "DUE_TODAY"`.
  - Jika `nextFollowUpDate < CURRENT_DATE` (Waktu Indonesia Barat) -> `priority = "OVERDUE"`.
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "id": "clxlead01",
      "clientName": "Ibu Ratna",
      "companyName": "Klinik Ratna Medika",
      "whatsappNumber": "081122334455",
      "serviceRequested": "Sistem Informasi & CMS",
      "dealValue": 12000000,
      "status": "DIHUBUNGI",
      "priority": "DUE_TODAY",
      "nextFollowUpDate": "2026-10-30",
      "assignedTo": { "id": "clxuser01", "fullName": "Staf A (Programmer)" },
      "lastInteractionNote": "28 Okt: Menunggu konfirmasi anggaran manajemen klinik."
    },
    {
      "id": "clxlead00",
      "clientName": "Bapak Anton",
      "companyName": "PT Logistik Sentosa",
      "whatsappNumber": "081299887766",
      "serviceRequested": "Website Bisnis Instan",
      "dealValue": 8000000,
      "status": "BARU",
      "priority": "OVERDUE",
      "nextFollowUpDate": "2026-10-28",
      "assignedTo": { "id": "clxuser03", "fullName": "Staf C (Project Lead)" },
      "lastInteractionNote": "Pesan masuk 2 hari lalu, belum sempat dihubungi."
    }
  ],
  "meta": null,
  "error": null
}
```

#### 3. Endpoint CRM Lainnya:
* `GET /api/v1/crm/leads`: Mengambil daftar prospek dengan filter `status`, `assignedToId`, dan pagination. Visual pipeline penjualan di frontend dibentuk dengan memfilter endpoint ini per status (tidak memerlukan endpoint `/crm/pipeline` terpisah).
* `GET /api/v1/crm/leads/:id`: Detail prospek lengkap dengan riwayat `interactionLogs` dan `activityLogs`.
* `PATCH /api/v1/crm/leads/:id`: Pembaruan status pipeline, deal value, penanggung jawab, jadwal follow up, didukung validasi `updatedAt`.
* `POST /api/v1/crm/leads/:id/notes`: Menambahkan catatan interaksi kualitatif hasil diskusi WhatsApp atau telepon.
* `GET /api/v1/crm/schedules`: Daftar timeline beban kerja tim Gantt (`startDate`, `endDate`, `assignedToId`, `status`).
* `POST /api/v1/crm/schedules`: Menambah penugasan proyek baru.
* `PATCH /api/v1/crm/schedules/:id`: Memperbarui jadwal kerja dengan validasi `updatedAt`.

---

### 5.5 Modul Dashboard Analitik (Read-Only Staf)

#### Aturan Pengambilan Data Dashboard:
* **Kartu Indikator Utama (*Top-Line Overview*):** Data total pengunjung unik, total sesi, total tayangan, rata-rata durasi, dan total konversi **wajib dibaca dari baris `analytics_daily` dengan nilai `path = '*'`**. Dilarang menjumlahkan baris-baris per halaman agar tidak terjadi overcount pengunjung unik.
* **Tabel Halaman Terpopuler (*Top Pages Table*):** Dibaca dari baris `analytics_daily` dengan `path != '*'`.
* **Rumus Resmi Turunan:**
  - $\text{Rata-rata Durasi (detik)} = \frac{\text{durationSec}}{\text{sessions}}$
  - $\text{Bounce Rate (\%)} = \left( \frac{\text{bounces}}{\text{sessions}} \right) \times 100\%$
  - $\text{Conversion Rate (\%)} = \left( \frac{\text{whatsappClicks} + \text{formSubmits}}{\text{visitors}} \right) \times 100\%$ (Penyebut: *Total Daily Unique Visitors* dari baris `path = '*'`).

#### 1. `GET /api/v1/analytics/overview` (Ringkasan Tren Utama)
* **Query Parameters:** `?site_id=nextkarya-main&from=2026-10-01&to=2026-10-30`
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": {
    "site_id": "nextkarya-main",
    "period": { "from": "2026-10-01", "to": "2026-10-30" },
    "metrics": {
      "visitors": 4250,
      "visitorsChange": 14.8,
      "sessions": 5120,
      "sessionsChange": 11.2,
      "pageviews": 18450,
      "pageviewsChange": 22.4,
      "averageDurationSec": 145,
      "averageDurationChange": 5.0,
      "bounceRate": 38.2,
      "bounceRateChange": -2.4,
      "whatsappClicks": 210,
      "formSubmits": 85,
      "conversions": 295,
      "conversionsChange": 18.5,
      "conversionRate": 6.94,
      "conversionRateChange": 0.22
    }
  },
  "meta": null,
  "error": null
}
```

#### 2. `GET /api/v1/analytics/pages` (Peringkat Halaman Terpopuler)
* **Query Parameters:** `?site_id=nextkarya-main&from=2026-10-01&to=2026-10-30&limit=10`
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "path": "/",
      "pageviews": 7520,
      "visitors": 3100,
      "bounceRate": 32.1,
      "conversions": 140,
      "conversionRate": 4.52
    },
    {
      "path": "/layanan",
      "pageviews": 3840,
      "visitors": 1950,
      "bounceRate": 28.4,
      "conversions": 95,
      "conversionRate": 4.87
    },
    {
      "path": "/portofolio",
      "pageviews": 2910,
      "visitors": 1420,
      "bounceRate": 35.0,
      "conversions": 42,
      "conversionRate": 2.96
    }
  ],
  "meta": null,
  "error": null
}
```

#### 3. `GET /api/v1/analytics/sources` (Saluran Rujukan Trafik)
* **Query Parameters:** `?site_id=nextkarya-main&from=2026-10-01&to=2026-10-30`
* **Format Respons Berhasil (200 OK):**
```json
{
  "success": true,
  "data": [
    {
      "source": "google",
      "label": "Pencarian Organik (Google)",
      "pageviews": 8200,
      "visitors": 2100,
      "conversions": 125,
      "sharePercentage": 49.4
    },
    {
      "source": "direct",
      "label": "Langsung (Direct)",
      "pageviews": 5100,
      "visitors": 1250,
      "conversions": 90,
      "sharePercentage": 29.4
    },
    {
      "source": "instagram",
      "label": "Media Sosial (Instagram)",
      "pageviews": 3400,
      "visitors": 680,
      "conversions": 62,
      "sharePercentage": 16.0
    },
    {
      "source": "referral",
      "label": "Tautan Rujukan Mitra",
      "pageviews": 1750,
      "visitors": 220,
      "conversions": 18,
      "sharePercentage": 5.2
    }
  ],
  "meta": null,
  "error": null
}
```

---

### 5.6 Webhook Pembersihan Cache Next.js (Server-to-Server)

* **URL Sasaran:** `POST https://nextkarya.web.id/api/revalidate`
* **Keamanan Kredensial:** Kunci rahasia dikirimkan melalui HTTP Header resmi:
  `x-webhook-secret: <SECRET_KEY>`
  *(Dilarang keras menyematkan secret pada query string URL).*
* **Request Body:**
```json
{
  "tag": "articles",
  "action": "update"
}
```
* **Catatan Penyelarasan Spesifikasi:** Nilai `"action": "update"` dikunci baku dan selaras 100% dengan dokumen spesifikasi CMS kanonik ([`docs/cms-v2.2.md`](./cms-v2.2.md) Pilar 5).
* **Kebijakan Percobaan Ulang (*Retry & Backoff*):**
  - Jika webhook mengembalikan status non-2xx atau waktu tunggu habis, sistem otomatis mencoba ulang maksimal 3 kali dengan jeda waktu eksponensial: 2 detik, 4 detik, dan 8 detik.
  - Target batas waktu pembersihan cache website publik: **< 3 detik**.

---

### 5.7 Emergency Toolkit (Aksi Darurat & Log Audit Wajib)

Seluruh endpoint darurat di bawah ini dapat diakses oleh ketiga staf internal (role `STAFF`). Untuk menjamin akuntabilitas tanpa sistem multi-role yang rumit, **setiap aksi darurat wajib menyertakan kolom `reason` (alasan) minimal 5 karakter**. Sistem otomatis merekam entri baru pada tabel `emergency_audit_logs`.

#### Rute Aksi Darurat:
1. `POST /api/v1/emergency/unpublish`
   - **Tindakan:** Menurunkan artikel atau portofolio sensitif secara instan ke status `DRAFT` atau `ARCHIVED`, lalu memicu webhook revalidasi cache.
   - **Body:** `{ "site_id": "nextkarya-main", "targetEntity": "POST", "targetId": "clxpost01", "reason": "Terdapat materi NDA klien yang belum boleh tayang." }`
2. `POST /api/v1/emergency/lock-form`
   - **Tindakan:** Mengunci formulir kontak publik (mengubah `isFormLocked: true` di database). Tampilan website otomatis mengalihkan formulir menjadi tombol langsung menuju WhatsApp resmi.
   - **Body:** `{ "site_id": "nextkarya-main", "reason": "Serangan spam bot membanjiri form kontak." }`
3. `POST /api/v1/emergency/unlock-form`
   - **Tindakan:** Membuka kembali form kontak publik (`isFormLocked: false`).
   - **Body:** `{ "site_id": "nextkarya-main", "reason": "Sistem proteksi rate limit sudah diperketat." }`
4. `POST /api/v1/emergency/banner`
   - **Tindakan:** Mengaktifkan atau menonaktifkan strip banner darurat website.
   - **Pemetaan Log Audit:** Jika `isActive: true` dicatat dengan `actionType: "SET_ALERT_BANNER"`; jika `isActive: false` dicatat dengan `actionType: "REMOVE_ALERT_BANNER"`.
   - **Body:** `{ "site_id": "nextkarya-main", "isActive": true, "alertBanner": "Layanan tatap muka ditutup sementara hingga pukul 13.00 WIB", "reason": "Pemadaman listrik lokal di kantor pusat." }`
5. `POST /api/v1/crm/leads/:id/reassign`
   - **Tindakan:** Mengalihkan penanggung jawab prospek saat staf awal berhalangan/sakit.
   - **Body:** `{ "newAssignedToId": "clxuser02", "reason": "Staf A sedang izin sakit darurat." }`

#### Format Respons Berhasil Emergency (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Aksi darurat berhasil dieksekusi.",
    "auditLogId": "clxaudit01",
    "actionType": "UNPUBLISH_CONTENT",
    "executedAt": "2026-10-30T16:30:00.000Z"
  },
  "meta": null,
  "error": null
}
```

---

## 6. Kriteria Selesai (*Acceptance Criteria*) Layanan API

| Kelompok Endpoint | Target Kinerja / Kriteria Selesai | Mekanisme Penanganan Kegagalan |
| :--- | :--- | :--- |
| **Intake Formulir Leads** | Waktu respons endpoint `POST /leads` selesai dalam **< 100 milidetik**. | Jika database sibuk, request gagal diberi status 503 dengan petunjuk kirim ulang. |
| **Agenda Follow-Up CRM** | Halaman `GET /crm/follow-up-today` memuat daftar lengkap dalam **< 150 milidetik**. | Didukung indeks gabungan `[site_id, nextFollowUpDate, status, assignedToId]`. |
| **Ingestion Beacon Analitik** | Respons endpoint `POST /analytics/event` selesai dalam **< 50 milidetik**. | Mode eksekusi asinkron non-blocking agar tidak membebani loop utama server. |
| **Kueri Grafik Analitik** | Pemuatan data tren grafik 30 hari selesai dalam **< 100 milidetik**. | Membaca data pra-agregasi `analytics_daily` dengan `path = '*'`. |
| **Pembersihan Cache Webhook** | Cache website publik bersih dalam **< 3 detik**. | Toleransi retry 3x dengan backoff eksponensial (2s, 4s, 8s). |
| **Validasi Optimistic Lock** | Konflik stempel `updatedAt` tertolak dengan status HTTP 409 dalam **< 50 milidetik**. | Mengembalikan payload error ramah dan data entitas terkini untuk perbandingan. |

---

## 7. Daftar Fitur yang Resmi Dialokasikan ke Fase 2

Jika selama masa pengerjaan Fase 1 terdapat permintaan untuk fitur-fitur di bawah ini, tim pengembang berpegang pada ketetapan bahwa fitur tersebut adalah **lingkup resmi Fase 2**:

1. **Login & Panel Portal Mandiri untuk Klien:** Antarmuka khusus klien untuk memantau progres situs mereka sendiri.
2. **Penerbitan Konten Otomatis Berjadwal (*Scheduled Publishing*):** Cron job publikasi otomatis di tanggal mendatang.
3. **Visual Diff Riwayat Revisi:** Tampilan visual perbedaan teks kata-per-kata antar-snapshot.
4. **Pencatatan Otomatis 301 Redirect:** Pembuatan aturan redirect otomatis saat staf mengubah slug artikel terbit.
5. **Pelacakan Parameter UTM Mendalam:** Penguraian detail kampanye promosi berbayar.
6. **Deteksi Lokasi Kota GeoIP:** Pemetaan kota pengunjung secara akurat.
7. **Ekspor Laporan CSV / Excel:** Unduhan berkas spreadsheet laporan analitik dan prospek CRM.
8. **Notifikasi Push Ponsel Otomatis:** Pengiriman push notification via Firebase Cloud Messaging (FCM) dan APNs.
9. **Pembuatan Faktur & Tagihan Termin Otomatis:** Sistem billing termin pembayaran proyek klien.
10. **Manajemen Sesi Perangkat Granular Berbasis Redis:** Daftar perangkat aktif yang dapat dicabut satu per satu dari antarmuka.

---

## 8. Riwayat Pembaruan (*Changelog*)

### Versi 1.0 Kanonik (31 Oktober 2026)
* Menyelaraskan seluruh spesifikasi rute, validasi middleware Zod, dan model request body ke arsitektur backend Express.js (Node.js / TypeScript).
* Menegaskan rujukan dokumen kanonik ke [`schema-database-v1.1.md`](./schema-database-v1.1.md), [`cms-v2.2.md`](./cms-v2.2.md), [`architecture-desktop-vs-mobile-v1.1.md`](./architecture-desktop-vs-mobile-v1.1.md), dan [`system-architecture-v1.0.md`](./system-architecture-v1.0.md).
* Mengonfirmasi sinkronisasi penuh enum `REVOKE_SESSION` dan muatan webhook `"action": "update"`.

### Versi 1.0 (30 Oktober 2026)
* Penyusunan cetak biru kontrak REST API resmi untuk rute `/api/v1`.
* Mengunci 7 keputusan arsitektur beku pada halaman pertama.
* Menyediakan kontrak lengkap untuk 8 endpoint publik, 2 endpoint intake publik dengan proteksi berlapis, serta seluruh endpoint terproteksi internal (Auth, CMS, Media, CRM, Analitik, dan Emergency Toolkit).
* Menstandarkan aturan `heartbeat` dan `durationSec` pada analitik untuk menjamin akurasi data agregasi.
* Mengunci batas ukuran berkas media dan MIME types resmi.
* Menegaskan keselarasan enum `REVOKE_SESSION` dengan `docs/schema-database-v1.1.md` Bab 2.5 dan Tabel 20, serta payload webhook `"action": "update"` dengan `docs/cms-v2.2.md` Pilar 5.
* Mengunci daftar fitur Fase 2 dan kriteria selesai kinerja per kelompok endpoint.
