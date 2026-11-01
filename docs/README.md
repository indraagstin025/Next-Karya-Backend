# Indeks Dokumentasi Teknis Sistem Internal
**Next Karya Digital Solutions**  
*Pusat Navigasi, Riwayat Pembaruan (*Changelog*), dan Glosarium Istilah Sistem*  
*Versi Master: Kanonik 2026*  
*Tanggal Berlaku: 31 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Daftar Dokumen Kanonik Sistem (*Single Source of Truth*)

Seluruh pengembangan fitur, pemodelan skema database, penulisan API, dan perancangan antarmuka mengacu secara tunggal pada 7 dokumen kanonik di bawah ini:

| Nama Berkas | Versi | Cakupan Sistem | Target Pengguna & Perangkat |
| :--- | :---: | :--- | :--- |
| [system-architecture-v1.0.md](./system-architecture-v1.0.md) | **v1.0 Final** | Cetak Biru Arsitektur Terintegrasi (Backend Express.js, Postgres, Redis, Web Next.js, Mobile Flutter). | Seluruh Tim Rekayasa & Arsitek |
| [schema-database-v1.1.md](./schema-database-v1.1.md) | **v1.1 Kanonik** | Struktur 20 Tabel PostgreSQL, Model Relasional, Indeks Konkurensi, & Model Prisma ORM / Raw SQL. | Pengembang Backend & Database |
| [api-contracts-v1.0.md](./api-contracts-v1.0.md) | **v1.0 Kanonik** | Cetak Biru Kontrak REST API /api/v1, Validasi Zod Express.js, Format Respons Tunggal, & Mobile. | Seluruh Tim Pengembang (Backend, Web & Mobile) |
| [cms-v2.2.md](./cms-v2.2.md) | **v2.2 Kanonik** | Manajemen Konten, Galeri Portofolio, Snapshot Riwayat, Pembersihan Cache Webhook, & Takedown. | Tim Internal (Desktop & Mobile) |
| [analytics-v2.2.md](./analytics-v2.2.md) | **v2.2 Kanonik** | Mesin Pengukur Trafik Ringan (< 2 KB), Proteksi Bot, Konversi WA, Ingesti Redis, & Rollup Jam. | Tim Internal (Desktop & Mobile) |
| [crm-v2.2.md](./crm-v2.2.md) | **v2.2 Kanonik** | Kotak Masuk Prospek (*Leads*), Agenda Follow-Up Harian, Pipeline Penjualan 5 Tahap, & Timeline Tim. | Tim Internal (Desktop & Mobile) |
| [architecture-desktop-vs-mobile-v1.1.md](./architecture-desktop-vs-mobile-v1.1.md) | **v1.1 Kanonik** | Pembagian Peran Desktop Web vs Mobile Flutter (*Action Companion*), Emergency Toolkit Fase 1. | Seluruh Tim Pengembang (Web & Mobile Flutter) |

> [!NOTE]
> Seluruh berkas spesifikasi versi lama (v1.0 dan v2.0) telah dipindahkan ke direktori `docs/archive/` sebagai arsip historis. Tim dilarang melakukan modifikasi pada berkas di dalam folder arsip tersebut.

---

## 2. Ringkasan Perubahan (*Changelog: v2.0 ke v2.2*)

Pembaruan dari versi 2.0 ke 2.2 dilakukan untuk menyelaraskan kebutuhan operasional riil agensi, memperjelas batas implementasi Fase 1, serta menambal celah keamanan dan inkonsistensi antar-dokumen:

### 2.1 Standardisasi Identitas Brand & Domain Resmi
* Seluruh referensi domain lama `naykon.id` dan kontak lama diperbarui seragam menjadi `Next Karya Digital Solutions`, domain resmi `nextkarya.web.id`, dan kontak resmi `nextkarya@gmail.com`.

### 2.2 Penegasan Batas Lingkup: Internal vs Klien
* **Masalah pada v2.0:** Terdapat ambiguitas di mana dokumen menyebutkan sistem hanya untuk internal, tetapi di modul analitik sudah mencantumkan login khusus akun klien di Fase 1.
* **Perbaikan di v2.2:** Ditegaskan secara seragam di seluruh dokumen bahwa **Fase 1 (MVP) 100% khusus untuk 3 anggota tim internal Next Karya Digital Solutions** dengan konfigurasi bawaan `site_id: "nextkarya-main"`. Skema database multi-tenant disiapkan sejak hari pertama, namun panel mandiri dan hak akses login klien resmi dialokasikan untuk Fase 2.

### 2.3 Penyelarasan Fitur yang Menggantung (*Feature Synchronization*)
* **Emergency Toolkit:** Fitur aksi darurat (1-Tap Emergency Unpublish, Kunci Form Kontak, Banner Pengumuman Darurat, dan Alihkan Tugas Staf) kini terintegrasi resmi ke dalam matriks CMS, CRM, dan Arsitektur.
* **Notifikasi Push Ponsel:** Diselaraskan berstatus **Fase 2**. Untuk Fase 1 MVP, tim mengandalkan halaman kerja rutin "Agenda Follow-Up Hari Ini" di peramban desktop maupun ponsel.
* **Ekspor CSV / Excel:** Diselaraskan berstatus **Fase 2** di desktop.
* **Pengalihan 301 Redirect:** Pemetaan manual diimplementasikan pada Fase 1 MVP, sedangkan pelacakan slug otomatis dialokasikan pada Fase 2.

### 2.4 Peningkatan Keamanan & Keandalan Teknis
* **Webhook Secret:** Kunci rahasia webhook pada CMS dipindahkan dari URL query parameter (`?secret=...`) menjadi HTTP Header resmi `x-webhook-secret` untuk mencegah kebocoran kredensial di log akses peramban atau server proksi.
* **Toleransi Kegagalan Webhook:** Ditambahkan mekanisme coba ulang otomatis 3 kali (*exponential backoff*) dengan peringatan antarmuka jika webhook gagal merespons.
* **Pemberitahuan Batasan Origin Check:** Ditegaskan bahwa pemeriksaan Origin/Referer adalah lapisan pertahanan tambahan (*defense-in-depth*). Pertahanan utama tetap mengandalkan Rate Limiting ketat, Honeypot, dan validasi skema Zod.
* **Snapshot Konten Otomatis:** Setiap penerbitan artikel wajib membuat salinan cadangan otomatis (maksimal 5 versi FIFO) dengan kemampuan pemulihan instan di bawah 5 detik.

### 2.5 Kolaborasi 3 Anggota Tim (*Multi-User Concurrency*)
* **Pencegahan Tabrakan Data (*Optimistic Locking*):** Validasi stempel waktu `updatedAt` pada CMS dan CRM mencegah rekan kerja saling menimpa data tanpa sengaja.
* **Distribusi Tugas Jelas (*Lead Assignee*):** Setiap prospek di CRM wajib memiliki label penanggung jawab untuk mencegah calon klien dihubungi dua kali oleh anggota tim yang berbeda.
* **Pembersihan Nama Contoh:** Mengganti nama contoh fiktif (Brayan, Jane, Alice) dengan peran kerja generik tim: Staf A (Programmer), Staf B (Desainer UI/UX), dan Staf C (Project Lead).

---

## 3. Glosarium Istilah Teknis (*System Glossary*)

Untuk mencegah perbedaan penafsiran antar-anggota tim saat proses pengkodean, berikut adalah definisi istilah resmi yang digunakan:

### 1. `site_id`
Pengenal unik string (*String Identifier*) yang disematkan pada setiap baris data CMS, CRM, dan analitik sejak hari pertama. Berfungsi sebagai pondasi arsitektur multi-tenant.
* Pada Fase 1 MVP, seluruh data menggunakan `site_id: "nextkarya-main"`.
* Pada Fase 2, situs milik klien akan memiliki `site_id` mandiri (contoh: `klien-bengkel-jaya`).

### 2. Pengunjung Harian Unik (*Daily Unique Visitors*)
Estimasi jumlah perangkat unik yang mengunjungi situs dalam rentang 1 hari kalender (00:00 hingga 23:59 WIB), dihitung menggunakan enkripsi anonim *daily salted IP hash* tanpa cookie pelacak.
* *Karakteristik Data:* Akumulasi metrik bulanan adalah penjumlahan dari pengunjung unik per hari (**Total Daily Unique Visitors**), bukan angka mutlak individu perorangan dalam 30 hari (*Absolute Monthly Unique Individuals*).

### 3. Rasio Konversi (*Conversion Rate %*)
Persentase keberhasilan situs dalam mengubah pengunjung menjadi prospek bisnis riil.
* *Rumus Resmi:*
  $$\text{Conversion Rate} = \left( \frac{\text{Total Aksi Konversi (Klik WhatsApp + Form Kirim)}}{\text{Total Daily Unique Visitors}} \right) \times 100\%$$

### 4. Penguncian Optimis (*Optimistic Locking*)
Metode pengamanan integritas data saat beberapa anggota tim mengedit catatan yang sama secara paralel. Sistem membandingkan stempel waktu `updatedAt` saat form dikirimkan dengan nilai di basis data. Jika data sudah diubah oleh rekan lain lebih dahulu, sistem menolak penyimpanan dan menampilkan peringatan ramah tanpa menghapus ketikan pengguna.

### 5. Toolkit Darurat (*Emergency Toolkit*)
Kumpulan sakelar pengaman dan aksi cepat pada antarmuka mobile yang dapat dieksekusi dalam hitungan detik untuk merespons kondisi krisis (misal: menurunkan artikel sensitif, mengunci formulir kontak dari serangan spam bot, atau mengalihkan tugas tim).

### 6. Pertahanan Berlapis (*Defense-in-Depth*)
Pendekatan keamanan di mana endpoint publik dilindungi oleh beberapa lapis pengaman. Contoh pada form kontak: Lapisan 1 = Honeypot tersembunyi; Lapisan 2 = Rate Limiting IP (5 req/15 menit); Lapisan 3 = Validasi skema Zod; Lapisan 4 = Verifikasi Origin domain resmi.

### 7. Perangkap Bot (*Honeypot*)
Kolom input tersembunyi pada formulir website (`website_url`) yang tidak tampak oleh manusia normal menggunakan peramban biasa, namun akan diisi secara otomatis oleh skrip bot spam. Pengiriman formulir yang mengisi field ini akan langsung diabaikan secara senyap tanpa mencemari database CRM.

---

## 4. Panduan Eksekusi bagi Tim Pengembang

1. **Pembuatan Skema Prisma:**
   - Gunakan `site_id` di setiap model utama (`Post`, `Category`, `Lead`, `AnalyticsEvent`, `AnalyticsDaily`).
   - Sertakan kolom `updatedAt DateTime @updatedAt` untuk mendukung *Optimistic Locking*.
2. **Implementasi Server Actions & API:**
   - Selalu tempatkan validasi autentikasi, otorisasi, dan skema Zod di sisi server.
   - Gunakan header `x-webhook-secret` untuk seluruh rute komunikasi internal pembersihan cache Next.js.
3. **Kepatuhan Gaya Kode:**
   - Menjunjung tinggi antislop dan format kode bersih.
   - Dilarang keras menggunakan karakter em-dash pada seluruh dokumentasi maupun string antarmuka pengguna.
