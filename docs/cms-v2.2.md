# Spesifikasi Sistem CMS (Headless & Multi-Tenant Ready)
**Next Karya Digital Solutions**  
*Dokumen Arsitektur & Perencanaan Fitur Sistem Manajemen Konten*  
*Dokumen Versi: v2.2 Kanonik (Final)*  
*Tanggal Berlaku: 31 Oktober 2026*

> **Batas Lingkup Fase 1 (Internal vs Klien):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan endpoint API disiapkan memiliki kolom `site_id` sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Ringkasan Eksekutif & Strategi Multi-Tenancy

Sistem CMS (Content Management System) Next Karya Digital Solutions dirancang menggunakan pendekatan **Headless / Decoupled Architecture**. Sistem ini berdiri sebagai **Web Aplikasi Terpisah** yang bertindak sebagai **Pusat Data (Central API Provider)** untuk melayani website publik dan berbagai platform klien (*Multiplatform*).

### Strategi Multi-Tenancy (Dimulai dari Hari Pertama)
Untuk menjawab kebutuhan jangka panjang tanpa migrasi data yang menyulitkan:
1. **Fase Awal (Internal Next Karya):** CMS ini digunakan pertama kali untuk mengelola website Next Karya Digital Solutions sendiri dengan `site_id: "nextkarya-main"`.
2. **Kesiapan Produk untuk Klien (*Multi-Tenant Ready*):** Sejak hari pertama, seluruh skema database (artikel, portofolio, layanan, media) dan endpoint API wajib memiliki partisi **`site_id`**.
3. **Manfaat Bisnis:** Saat modul CMS ini dimasukkan ke dalam paket website klien (misalnya paket Website Sekolah, Komunitas, atau Portal Berita pada Fase 2), sistem backend tidak perlu dirombak ulang. Sistem cukup membuat `site_id` baru (contoh: `site_id: "klien-sekolah-01"`) dengan domain yang terhubung masing-masing.

```
                         ┌────────────────────────────────────────────────────────┐
                         │  WEB CMS & BACKEND API (Next Karya Digital Solutions)  │
                         │  - Database Terpusat dengan Partisi site_id           │
                         │  - Manajemen Konten, Media & Hak Akses Tim            │
                         └───────────────────────────┬────────────────────────────┘
                                                     │
                             RESTful JSON API / Webhook Sinyal
                                                     │
           ┌─────────────────────────────────────────┼─────────────────────────────────────────┐
           ▼                                         ▼                                         ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│  WEBSITE PUBLIK NEXT KARYA           │  │  WEBSITE KLIEN (CMS PORTAL / SEKOLAH)│  │  APLIKASI MOBILE (Android & iOS)     │
│  - site_id: "nextkarya-main"         │  │  - site_id: "klien-portal-01"        │  │  - Konsumsi API per site_id          │
│  - domain: nextkarya.web.id              │  │  - domain: portalberita.com (Fase 2) │  │  - Monitoring & Respon Darurat       │
└──────────────────────────────────────┘  └──────────────────────────────────────┘  └──────────────────────────────────────┘
```

---

## 2. Rincian Modul & Fitur CMS

### Pilar 1: Manajemen Konten Inti (*Core Content Management*)

#### 1.1 Identitas Multi-Tenant per Konten
* Setiap entitas konten (Artikel, Portofolio, Layanan, FAQ, Media) memiliki kolom identitas `site_id` yang terindeks (*indexed*) di database:
  - `site_id: "nextkarya-main"` untuk website resmi Next Karya Digital Solutions.
  - `site_id: "klien-xxx"` untuk situs klien di masa depan.

#### 1.2 Artikel & Blog (*Technology Insights*)
* **Editor Teks Modern:** Mendukung format heading, teks tebal/miring, daftar berpoin/nomor, blok kutipan (*quotes*), penyisipan gambar, dan blok kode pemrograman (*code syntax*).
* **Manajemen Metadata:**
  - Judul artikel dan slug URL yang otomatis terbuat ramah SEO.
  - Ringkasan singkat (*excerpt*) untuk cuplikan kartu artikel.
  - Penandaan Kategori (*misal: Web Development, Mobile Apps, UI/UX, Cloud*).
  - Penandaan Tag dinamis untuk pencarian topik.
  - Gambar Sampul (*Cover Image*) dengan teks alternatif (*alt text*) untuk aksesibilitas.
  - Estimasi waktu baca (*reading time*) yang dihitung otomatis dari jumlah kata.
  - Penulis artikel (*Author*) dan kurasi artikel terkait (*Related Articles*).

#### 1.3 Portofolio & Studi Kasus Proyek (*Case Studies*)
* **Identitas Proyek:** Nama proyek, nama klien, dan sektor industri klien (*misal: FinTech, Kesehatan, E-Commerce, Manufaktur*).
* **Kategori Solusi:** Website Bisnis, Portal CMS, Aplikasi Web Kustom, atau Mobile App.
* **Dampak Bisnis (*Business Impact*):** Pernyataan ringkas dampak nyata solusi digital terhadap bisnis klien (*contoh: "Meningkatkan transaksi online sebesar 150%"*).
* **Metrik Keberhasilan (*Key Metrics*):** Angka capaian kuantitatif (*contoh: 99.9% Uptime, +40k Pengguna Aktif*).
* **Tumpukan Teknologi (*Tech Stack*):** Label teknologi yang dipakai (*contoh: Next.js, Flutter, PostgreSQL, Docker*).
* **Galeri Antarmuka:** Mockup tampilan layar desktop, tablet, dan smartphone dalam resolusi tinggi.
* **Proyek Unggulan (*Featured*):** Tombol sorotan agar proyek terpilih tampil otomatis di halaman depan beranda.
* **Tautan Langsung:** URL demo langsung atau tautan website live klien.

#### 1.4 Katalog Layanan & Paket Harga
* **Katalog Layanan:**
  - Judul layanan, ikon representasi, dan deskripsi manfaat bisnis.
  - Daftar poin keunggulan layanan (*feature checklist*).
  - Urutan prioritas tampil (*sort priority*).
  - Tombol aksi (*Call-to-Action*) kustom per layanan.
* **Paket Harga Website & Aplikasi:**
  - Nama paket, label harga, dan catatan durasi/tipe pembayaran.
  - Daftar fitur yang didapatkan klien pada paket tersebut.
  - Penanda paket rekomendasi (*Most Popular / Recommended Badge*).

#### 1.5 FAQ (*Frequently Asked Questions*)
* **Pengelompokan Topik:** Kategori pertanyaan (Teknis & Hosting, Skema Biaya, Garansi Purnajual, Durasi Pengerjaan).
* **Pertanyaan & Jawaban:** Jawaban lengkap dan mudah dipahami.
* **Kontrol Tampil:** Tombol aktif/nonaktif dan pengurutan posisi pertanyaan secara fleksibel.

#### 1.6 Testimoni Klien (*Social Proof*)
* **Data Klien:** Nama pemberi testimoni, jabatan, nama brand/perusahaan, dan logo perusahaan.
* **Ulasan:** Teks ulasan hasil kerja tim, rating bintang (skala 1 sampai 5).
* **Relasi:** Tautan ke portofolio studi kasus proyek terkait.

#### 1.7 Halaman Statis Kustom (*Pages*)
* Pengelolaan teks dan informasi untuk halaman seperti Kebijakan Privasi (*Privacy Policy*), Syarat Ketentuan (*Terms of Service*), maupun halaman promo khusus.

---

### Pilar 2: Alur Penerbitan Konten & Snapshot Pengaman (Solusi MVP)

Karena pada tahap awal (MVP) diterapkan sistem **1 Role Tunggal** di mana semua anggota tim bisa langsung mempublikasikan konten, sistem wajib dilengkapi pengaman agar konten tidak tertimpa atau hilang tanpa sengaja:

#### 2.1 Snapshot Pengaman Sederhana (*Auto-Snapshot before Publish*)
* **Mekanisme Otomatis:** Setiap kali tombol "Publish" atau "Simpan Perubahan" ditekan pada artikel/portofolio yang sudah ada, sistem secara otomatis menduplikasi data versi sebelumnya ke tabel riwayat sederhana (`content_snapshots`).
* **Kriteria Selesai & Kapasitas Simpan:**
  - Sistem menyimpan maksimal **5 snapshot versi terakhir** per artikel/portofolio secara berputar (*rolling FIFO*). Versi ke-6 yang paling lama akan otomatis dibersihkan untuk mencegah penumpukan kapasitas database.
  - Tombol 1-klik "Pulihkan Versi Sebelumnya" (*Restore Snapshot*). Jika terjadi salah ketik atau data penting terhapus, data lama dapat dipulihkan dalam waktu kurang dari 5 detik.

#### 2.2 Pencegahan Hapus Permanen (*Soft Delete Protection*)
* Tombol hapus konten tidak melakukan *hard delete* (penghapusan fisik dari database).
* Konten yang dihapus otomatis dialihkan statusnya menjadi **Arsip (*Archived*)**, sehingga sewaktu-waktu dapat dipulihkan kembali oleh tim.

#### 2.3 Status Publikasi Konten:
1. **Draf (*Draft*):** Konten masih dalam penulisan dan belum ingin ditampilkan ke publik.
2. **Terbit (*Published*):** Konten aktif secara live dan langsung dapat diakses publik.
3. **Arsip (*Archived*):** Konten disembunyikan dari publik sebagai pengaman soft delete.
4. **Terjadwal (*Scheduled - Fase 2*):** Konten disetel untuk terbit otomatis pada tanggal dan jam tertentu di masa depan.

---

### Pilar 3: Pengelola Media Terpusat (*Media Asset Manager*)

* **Pustaka Media Universal:**
  - Pengunggahan gambar (WebP, PNG, JPG, SVG) dan dokumen digital (PDF brosur, infografis).
  - Filter media berdasarkan `site_id` agar aset Next Karya dan aset klien tidak tercampur.
  - Pencarian file berdasarkan nama dan filter berdasarkan tanggal atau tipe file.
* **Optimasi Gambar Otomatis:**
  - Kompresi ukuran file otomatis saat diunggah untuk menghemat ruang dan mempercepat loading pengunjung.
  - Ekstraksi metadata otomatis (resolusi lebar, tinggi, dan ukuran file).
* **Integrasi Cloud Storage:**
  - Penyimpanan file media terintegrasi ke *Cloud Object Storage* performa tinggi (seperti Cloudflare R2, AWS S3, atau Supabase Storage) dengan CDN global.

---

### Pilar 4: Pengaturan SEO & Pratinjau Media Sosial

* **SEO On-Page per Konten:**
  - Kustomisasi *Meta Title* dan *Meta Description* untuk mengoptimalkan peringkat di Google Search.
  - Gambar pratinjau media sosial (*Open Graph Image*) agar tampilan link di WhatsApp, LinkedIn, dan media sosial terlihat profesional dan rapi.
  - Pengaturan tag kanonikal (*Canonical URL*).
* **Pengalihan URL (*301 Redirects*):**
  - **Fase 1 (MVP):** Pengalihan URL dapat dicatat secara manual jika ada perubahan rute utama.
  - **Fase 2:** Sistem otomatis mencatat aturan pengalihan (*301 Permanent Redirect*) saat slug judul artikel diubah oleh pengguna.
* **Sitemap XML Otomatis:**
  - Memperbarui daftar URL publik secara otomatis untuk diserahkan ke Google Search Console.

---

### Pilar 5: Integrasi Headless API, Webhook & Pengamanan Spam

* **RESTful JSON API Multi-Tenant:**
  - Endpoint publik yang dikonsumsi Next.js dengan filter `site_id`:
    - `GET /api/v1/articles?site_id=nextkarya-main`
    - `GET /api/v1/articles/:slug?site_id=nextkarya-main`
    - `GET /api/v1/portfolios?site_id=nextkarya-main`
    - `GET /api/v1/services?site_id=nextkarya-main`
    - `GET /api/v1/faqs?site_id=nextkarya-main`
* **Keamanan Endpoint Publik & Batasan Origin Check:**
  - **Catatan Keamanan (Security Caveat):** Header `Origin` dan `Referer` dapat dimanipulasi (*spoofed*) oleh penyerang dan tidak selalu tersedia di mobile app. Oleh karena itu, Origin check diperlakukan sebagai **lapisan pertahanan tambahan (*defense-in-depth*)**, sedangkan pertahanan utama tetap bertumpu pada **Rate Limiting** dan **Validasi Skema Zod Ketat**.
  - **Rate Limiting:** Pembatasan frekuensi request per IP (maksimal 120 request per menit untuk API publik).
  - **Validasi Skema Zod:** Memastikan tidak ada injeksi payload karakter berbahaya.
* **Penyegaran Cache Instan via Header Webhook Aman (*On-Demand Revalidation*):**
  - Secret key **TIDAK BOLEH** ditaruh pada query URL (?secret=...) karena rawan tercatat di log server.
  - Secret key dikirimkan melalui HTTP Header resmi:
    ```http
    POST https://nextkarya.web.id/api/revalidate
    Content-Type: application/json
    x-webhook-secret: KUNCI_RAHASIA_KOMUNIKASI
    
    {
      "tag": "articles",
      "action": "update"
    }
    ```
  - **Catatan Penyelarasan Kontrak:** Nilai `"action": "update"` dikunci baku dan selaras 100% dengan kontrak REST API kanonik terbaru ([`./api-contracts-v1.0.md`](./api-contracts-v1.0.md) Bab 5.6).
  - **Kriteria Selesai & Toleransi Kegagalan (Failure Handling):**
    - Cache di website Next.js wajib terhapus dalam waktu maksimal **3 detik** setelah webhook diterima.
    - Jika server Next.js gagal merespons atau timeout, backend CMS secara otomatis melakukan **retry sebanyak 3 kali dengan jeda eksponensial (*exponential backoff: 2s, 4s, 8s*)** dan mencatat status kegagalan di log sistem.

---

### Pilar 6: Sistem Pengguna & Kolaborasi Multi-Akun (*Multi-User Concurrency*)

Dirancang khusus untuk tim Next Karya Digital Solutions (3 akun aktif) agar dapat bekerja bersamaan secara aman tanpa risiko data rusak atau tertimpa:

#### 6.1 Sesi Mandiri (*Isolated User Sessions*)
* Setiap anggota tim memiliki akun login sendiri dengan email kerja masing-masing (`nama@nextkarya.web.id`) dan password terenkripsi.
* Sesi login dikelola secara terisolasi dengan token mandiri. Tidak ada bentrok sesi atau kejadian *ter-logout otomatis* saat ketiga anggota tim membuka dashboard bersamaan di laptop atau ponsel masing-masing.

#### 6.2 Integritas Transaksi Database (ACID Compliance)
* PostgreSQL mengisolasi setiap query pembacaan dan penulisan data secara paralel.
* Jika Anggota Tim 1 sedang mengedit Layanan, Anggota Tim 2 sedang mengunggah gambar portofolio, dan Anggota Tim 3 sedang menulis artikel, database memproses transaksi masing-masing di baris (*row*) terpisah tanpa risiko korupsi data.

#### 6.3 Pencegahan Konflik Pengeditan Bersamaan (*Optimistic Locking*)
Jika dua anggota tim secara kebetulan membuka dan mengedit artikel yang sama di waktu bersamaan:
1. Setiap entitas artikel dan portofolio memuat stempel waktu perubahan `updatedAt`.
2. Saat Anggota Tim A menyimpan perubahan, nilai `updatedAt` diperbarui.
3. Saat Anggota Tim B mencoba menyimpan perubahan dari layar yang belum di-refresh, sistem membandingkan stempel waktu awal dan stempel waktu terkini.
4. Karena data sudah berubah, sistem menolak penimpaan buta dan menampilkan dialog peringatan:
   > *"Perhatian: Konten ini baru saja diperbarui oleh [Nama Rekan] beberapa saat yang lalu. Silakan muat ulang (refresh) halaman untuk melihat perubahan terkini sebelum menyimpan."*
5. Editan Anggota Tim A tidak hilang, dan Anggota Tim B dapat menggabungkan revisinya dengan aman.

#### 6.4 Tindakan Darurat & Jejak Audit (*Emergency Takedown & Audit Log*)
* **1-Tap Emergency Unpublish:**
  - Karena sistem 1 role memungkinkan siapa pun menurunkan konten, aksi takedown darurat wajib melalui **dialog konfirmasi sederhana** (misal: tombol geser atau konfirmasi sekali klik) dan mewajibkan pengisian alasan singkat (misal: *"Revisi NDA Klien"*).
  - Sistem otomatis mencatat log audit: Siapa yang menekan (`userId`), Waktu kejadian (`timestamp`), dan Alasan (`reason`).
  - Disediakan tombol pemulihan (*Undo/Restore*) untuk mengaktifkan kembali artikel dalam satu sentuhan.
* **Jejak Pengubah Terakhir (*Last Edited By*):**
  - Setiap artikel, portofolio, dan layanan mencatat identitas nama staf yang terakhir melakukan pembaruan (`lastEditedById`) dan waktu perubahannya.

---

## 3. Matriks Prioritas Rilis Fitur

| No | Modul / Fitur | Prioritas | Keterangan |
| :--- | :--- | :---: | :--- |
| **1** | Multi-Tenancy Dasar (`site_id` di database) | **Fase 1 (MVP)** | Menjamin sistem siap dipakai internal maupun klien kelak |
| **2** | Kolaborasi Multi-Akun & Optimistic Locking | **Fase 1 (MVP)** | Menjamin keamanan akses paralel bagi 3 anggota tim |
| **3** | Artikel & Blog (Editor, Cover, Kategori, Tag) | **Fase 1 (MVP)** | Pemasaran konten & SEO Google |
| **4** | Portofolio & Studi Kasus Bisnis | **Fase 1 (MVP)** | Etalase karya dan bukti kredibilitas bagi calon klien |
| **5** | Katalog Layanan & Paket Harga | **Fase 1 (MVP)** | Menampilkan penawaran jasa dan struktur harga |
| **6** | FAQ & Testimoni Klien | **Fase 1 (MVP)** | Menjawab pertanyaan umum & bukti sosial |
| **7** | Snapshot Pengaman Sebelum Publish (Maks 5 Versi) | **Fase 1 (MVP)** | Pengaman anti-konten tertimpa pada sistem 1 role |
| **8** | Soft Delete (Arsip Pengaman) | **Fase 1 (MVP)** | Mencegah konten terhapus permanen tanpa sengaja |
| **9** | Emergency Unpublish dengan Konfirmasi & Audit | **Fase 1 (MVP)** | Takedown darurat cepat dengan jejak pencatatan |
| **10** | Pengamanan API (Rate Limit & Origin Defense) | **Fase 1 (MVP)** | Mencegah serangan spam dan request liar |
| **11** | Webhook Revalidation via Header Secret | **Fase 1 (MVP)** | Integrasi cache aman tanpa kebocoran URL log |
| **12** | Pengelola Media (Cloud R2 / S3) | **Fase 1 (MVP)** | Media penyimpanan terpusat gambar dan mockup |
| **13** | Penjadwalan Terbit Otomatis | **Fase 2** | Otomasi tanggal dan jam terbit di masa depan |
| **14** | Riwayat Revisi Lengkap Berjenjang (Visual Diff) | **Fase 2** | Audit trail multi-versi dengan visual diff penuh |
| **15** | Otomatisasi 301 Redirects saat Slug Berubah | **Fase 2** | Otomasi pencatatan tabel redirect URL |
| **16** | Panel Mandiri & Akun Login Khusus Klien | **Fase 2** | Pembukaan akses login mandiri bagi klien luar |

---

## 4. Kesimpulan

Dokumen ini menjadi standar implementasi resmi untuk Sistem CMS Next Karya Digital Solutions:
1. Memastikan seluruh penamaan brand resmi adalah **Next Karya Digital Solutions** dengan domain **`nextkarya.web.id`**.
2. Membatasi lingkup Fase 1 untuk internal tim Next Karya, sembari menyiapkan skema `site_id` untuk perluasan bisnis ke klien di Fase 2.
3. Memberikan kepastian teknis melalui kriteria selesai, perlindungan snapshot rolling FIFO 5 versi, dan pengamanan webhook header.
