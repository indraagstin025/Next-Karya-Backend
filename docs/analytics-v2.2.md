# Spesifikasi & Daftar Fitur Dashboard Analitik (Multi-Tenant & Anti-Overclaim)
**Next Karya Digital Solutions**  
*Dokumen Arsitektur & Perencanaan Fitur Sistem Analitik Kunjungan & Konversi*  
*Versi: 2.2 (Multi-Tenant site_id, Multi-User Concurrent Access, & Transparansi Data)*  
*Tanggal: 30 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Ringkasan Eksekutif & Filosofi Desain

Sistem Dashboard Analitik Next Karya Digital Solutions dibangun untuk memberikan visibilitas performa trafik dan konversi bagi website resmi `nextkarya.web.id` maupun website klien yang sedang dikerjakan, tanpa mengorbankan kecepatan akses maupun privasi pengunjung.

### 1.1 Strategi Multi-Tenancy (Dimulai dari Hari Pertama)
* Setiap event kunjungan dan konversi **wajib menyertakan parameter `site_id`** sejak hari pertama (contoh: `site_id: "nextkarya-main"` untuk website resmi perusahaan, atau `site_id: "klien-xxx"` untuk website klien).
* Mesin analitik ini dapat melayani banyak website sekaligus (*Multi-Tenant Architecture*).
* **Fase 1 (MVP):** Seluruh 3 anggota tim internal Next Karya Digital Solutions dapat memantau website utama maupun situs klien melalui menu pemilih situs (*Site Selector*). Fitur portal mandiri dan login khusus akun klien dialokasikan untuk Fase 2.

### 1.2 Batasan Teknis & Transparansi Data Tren (Prinsip Anti-Overclaim)
Untuk menjaga integritas dan kejujuran data:
1. **Bebas Cookie Pihak Ketiga (*Privacy-First*):**
   - Menggunakan metode anonim *daily salted IP hash* tanpa cookie pelacak, sehingga website tidak memerlukan banner persetujuan cookie yang mengganggu kenyamanan pengunjung.
2. **Karakteristik Data Kunjungan Bulanan:**
   - Karena *salt* diacak secara periodik per hari demi kepatuhan privasi, pengunjung yang sama yang berkunjung di hari Senin dan Rabu akan dihitung sebagai pengunjung unik pada masing-masing hari tersebut.
   - Akumulasi metrik bulanan adalah **Total Daily Unique Visitors**, bukan angka mutlak individu perorangan (*Absolute Monthly Unique Individuals*).
3. **Estimasi Durasi Kunjungan:**
   - Durasi kunjungan yang dicatat dari sinyal *beacon* adalah estimasi heuristik waktu aktif tab peramban, bukan pengukuran tatap mata fisik secara absolut.
4. **Fungsi Utama:**
   - Metrik dashboard diposisikan sebagai **Indikator Tren Pertumbuhan (*Growth Trend Indicator*)** untuk mengevaluasi arah perkembangan bisnis dan efektivitas konten, bukan sebagai instrumen audit legal mutlak.

```
┌───────────────────────────────────────┐
│ WEBSITE PUBLIK (nextkarya.web.id / Klien) │
│ Skrip Pelacak Ringan (< 2 KB)         │
└───────────────────┬───────────────────┘
                    │ Sinyal Event: POST /api/v1/analytics/event
                    │ Payload: { site_id: "nextkarya-main", eventName: "pageview", ... }
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BACKEND ANALITIK & PENGAMAN SPAM (Pertahanan Berlapis)                 │
│ 1. Rate Limiting IP Ketat (Maks 60 req/menit) [Pengaman Utama]         │
│ 2. Validasi site_id Terdaftar & Skema Zod Express (< 2 KB)             │
│ 3. Verifikasi Origin / Referer Header (Lapisan Tambahan)               │
│ 4. Tabel Raw Event (TTL 90 Hari) & Agregasi Harian (Daily Rollup)      │
└───────────────────┬────────────────────────────────────────────────────┘
                    │ Data Siap Tampil per site_id
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ DASHBOARD ANALITIK (3 ANGGOTA TIM AKSES PARALEL)                       │
│ - Tampilan Tren Trafik, Halaman Terpopuler & Saluran Rujukan           │
│ - Sesi Filter Mandiri di Setiap Perangkat Staf                         │
│ - Pelacakan Konversi Riil: Klik Chat WhatsApp & Kirim Formulir         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Rincian Metrik & Fitur Dashboard

### Pilar 1: Metrik Utama Trafik (*Top-Line Overview*)

Kartu indikator tren di bagian atas dashboard dengan perbandingan persentase naik atau turun terhadap periode sebelumnya:

* **Pengunjung Harian Unik (*Daily Unique Visitors*):**
  Estimasi jumlah perangkat unik yang mengunjungi situs per hari dalam rentang waktu yang dipilih.
* **Total Tayangan (*Pageviews*):**
  Akumulasi total berapa kali halaman website dibuka atau dimuat ulang (*refresh*).
* **Sesi Kunjungan (*Sessions*):**
  Kunjungan aktif pengunjung (sesi dianggap selesai jika pengunjung tidak beraktivitas selama 30 menit).
* **Rata-rata Durasi Kunjungan (*Average Visit Duration*):**
  Estimasi durasi rata-rata yang dihabiskan pengunjung untuk membaca konten website (berdasarkan interval detak *beacon* tab aktif).
* **Tingkat Pantulan (*Bounce Rate %*):**
  Persentase pengunjung yang meninggalkan website setelah hanya membuka satu halaman tanpa melakukan interaksi lanjutan.

---

### Pilar 2: Pelacakan Konversi & Sasaran Bisnis (*Goal & Conversion Tracking*)

Mengukur efektivitas website dalam menghasilkan calon klien (*leads*):

* **Klik Chat WhatsApp Konsultasi:**
  Mencatat setiap kali tombol *Chat WhatsApp* atau tombol *Konsultasi* ditekan oleh pengunjung di Beranda, Navbar, Layanan, maupun Footer.
* **Pengiriman Formulir Proyek (*Form Submissions*):**
  Jumlah formulir konsultasi yang berhasil dikirim oleh calon klien dari halaman Beranda dan Kontak.
* **Klik Detail Layanan & Portofolio:**
  Menghitung frekuensi klik pada kartu layanan dan studi kasus portofolio untuk mengukur ketertarikan pasar terhadap portofolio digital tertentu.
* **Rasio Konversi Keseluruhan (*Overall Conversion Rate %*):**
  Kalkulasi persentase perbandingan antara pengunjung yang mengambil tindakan (klik WhatsApp atau pengiriman form) terhadap total pengunjung harian unik:
  $$\text{Conversion Rate} = \left( \frac{\text{Total Aksi Konversi}}{\text{Total Daily Unique Visitors}} \right) \times 100\%$$

---

### Pilar 3: Analisis Perilaku & Konten Populer (*Content & Behavior*)

* **Halaman Terpopuler (*Top Pages*):**
  - Tabel peringkat halaman berdasarkan jumlah tayangan (*views*), persentase kontribusi trafik, dan estimasi waktu baca.
  - Membantu tim melihat artikel blog atau studi kasus portofolio yang paling banyak dibaca.
* **Sumber Rujukan Trafik (*Traffic Sources & Referrers*):**
  - **Pencarian Organik (*Search Engine*):** Pengunjung yang menemukan website dari Google, Bing, atau Yahoo.
  - **Media Sosial (*Social Media*):** Trafik dari Instagram, LinkedIn, TikTok, Facebook, atau WhatsApp Web.
  - **Langsung (*Direct*):** Pengunjung yang mengetik langsung domain resmi (`nextkarya.web.id`) atau membukanya dari bookmark.
  - **Rujukan (*Referral*):** Tautan dari media rilis, direktori bisnis, atau website mitra luar.
* **Pelacakan Kampanye Promosi (*UTM Campaign Tracking - Fase 2*):**
  - Mengurai parameter pelacak URL khusus saat promosi dibagikan (`utm_source`, `utm_medium`, `utm_campaign`).

---

### Pilar 4: Demografi & Spesifikasi Teknologi (*Audience Breakdown*)

* **Proporsi Perangkat (*Device Types*):**
  - Pembagian persentase antara Smartphone (Mobile), Laptop/PC (Desktop), dan Tablet.
  - Berguna untuk memastikan optimalisasi tata letak responsif tepat sasaran.
* **Sistem Operasi & Peramban (*OS & Browsers*):**
  - Android, iOS, Windows, macOS, Linux.
  - Google Chrome, Safari, Microsoft Edge, Mozilla Firefox.
* **Sebaran Wilayah Geografis (*Geographic Location - Fase 2*):**
  - Pemetaan negara dan kota asal pengunjung secara anonim berbasis basis data GeoIP tanpa melacak koordinat GPS pribadi.

---

### Pilar 5: Visualisasi Data, Filter Waktu & Ekspor Laporan

* **Pemilih Situs (*Site Selector* untuk Tim Internal):**
  - Memungkinkan 3 staf internal Next Karya Digital Solutions berpindah antara analitik website utama (`nextkarya-main`) dan website portofolio klien aktif.
* **Filter Rentang Waktu Fleksibel:**
  - Hari Ini (*Today*)
  - 7 Hari Terakhir (*Last 7 Days*)
  - 30 Hari Terakhir (*Last 30 Days*)
  - Rentang tanggal kustom melalui kalender (khusus desktop).
* **Grafik Visual Interaktif:**
  - **Grafik Garis Tren (*Line Chart*):** Fluktuasi pengunjung harian dan pola jam sibuk.
  - **Grafik Batang (*Horizontal Bar Chart*):** Perbandingan halaman populer dan saluran rujukan.
  - **Grafik Donat (*Donut Chart*):** Proporsi perangkat (HP vs Komputer).
* **Ekspor Laporan (*Fase 2*):**
  - Fitur pengunduhan ringkasan metrik dalam format CSV atau Excel untuk pelaporan berkala.

---

### Pilar 6: Akses Kolaborasi Multi-Akun pada Dashboard Analitik (*Multi-User Access*)

Dirancang agar seluruh 3 anggota tim Next Karya Digital Solutions dapat menganalisis data secara paralel tanpa saling mengganggu:

#### 6.1 Sesi Filter Mandiri di Setiap Perangkat (*Client-Side State*)
* Ketiga staf dapat membuka Dashboard Analitik secara bersamaan di perangkat laptop maupun ponsel masing-masing.
* Filter rentang tanggal atau pemilihan situs (*Site Selector*) berjalan di *state* peramban lokal masing-masing staf:
  - Staf A dapat memeriksa performa "7 Hari Terakhir" di ponsel.
  - Staf B dapat menganalisis metrik "30 Hari Terakhir" di laptop.
  - Tampilan kedua staf tetap terisolasi dan tidak saling menimpa tampilan layar rekan kerja.

#### 6.2 Pembacaan Agregasi Ringan (*High Concurrency Read*)
* Dashboard Analitik bersifat *Read-Only* bagi pengguna operasional.
* Kueri visualisasi data tidak memindai jutaan baris data mentah (*raw events*), melainkan membaca data dari tabel agregasi harian (`AnalyticsDaily`).
* Dampak Teknis: Meskipun ketiga anggota tim membuka, memfilter, atau memuat ulang halaman analitik pada detik yang sama, basis data PostgreSQL tetap bekerja optimal di bawah 100 milidetik.

---

## 3. Arsitektur Teknis & Pengamanan Anti-Spam

### 3.1 Skrip Pelacak di Sisi Klien (Next.js & Browser)

Skrip pelacak di Next.js berbobot kurang dari 2 KB dan berjalan di latar belakang tanpa menghambat proses rendering:

```javascript
// Contoh pengiriman sinyal analitik dari website resmi Next Karya Digital Solutions
if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
  navigator.sendBeacon('/api/v1/analytics/event', JSON.stringify({
    site_id: 'nextkarya-main',
    eventName: 'pageview', // atau 'whatsapp_click', 'form_submit'
    path: window.location.pathname,
    referrer: document.referrer || null,
    screenWidth: window.innerWidth
  }));
}
```

### 3.2 Pengamanan Endpoint `POST /api/v1/analytics/event`

Untuk melindungi endpoint dari serangan banjir bot, spam log, dan request palsu:
1. **Rate Limiting IP Ketat (Pertahanan Utama):**
   - Dibatasi maksimal 60 permintaan per IP per menit menggunakan sliding window rate limiter di Redis atau memori server.
   - Permintaan yang melebihi batas langsung dibalas dengan HTTP status 429 Too Many Requests.
2. **Validasi Skema Zod Express & Batas Payload:**
   - Ukuran payload maksimal 2 KB. Permintaan dengan *body* lebih besar langsung ditolak.
   - Tipe data, panjang string, dan format kolom divalidasi ketat menggunakan skema Zod pada runtime Express.js sebelum diproses.
3. **Validasi `site_id` Aktif:**
   - Server memverifikasi apakah `site_id` terdaftar dan berstatus aktif di database. Jika tidak valid, permintaan ditolak (HTTP 404/400).
4. **Verifikasi Origin / Referer (Lapisan Pertahanan Tambahan):**
   - Server mencocokkan header `Origin` atau `Referer` dengan daftar domain terdaftar untuk `site_id` tersebut (misal: `https://nextkarya.web.id` untuk `nextkarya-main`).
   - *Catatan Batasan Teknis:* Header Origin dan Referer dapat tidak terkirim pada beberapa aplikasi mobile webview atau dapat dipalsukan oleh bot tingkat lanjut. Oleh sebab itu, pemeriksaan Origin diposisikan sebagai **lapisan penyaring tambahan**, sedangkan Rate Limiting dan validasi skema tetap menjadi pertahanan utama.

### 3.3 Desain Database & Skema Agregasi (PostgreSQL & Prisma ORM / Raw SQL)

1. **Tabel `AnalyticsEvent` (Data Mentah Transaksional):**
   - Kolom: `id`, `site_id`, `eventName`, `path`, `referrer`, `source`, `device`, `visitorIdHash`, `occurredAt`.
   - Kebijakan Retensi: Raw events dihapus otomatis setelah 90 hari (*TTL 90 days purge*) untuk menjaga ukuran basis data tetap efisien.
2. **Tabel `AnalyticsDaily` (Data Agregasi Harian):**
   - Kolom: `site_id`, `date`, `path`, `source`, `device`, `pageviews`, `visitors`, `sessions`, `bounces`, `conversions`.
   - Diindeks unik pada gabungan `[site_id, date, path, source, device]` agar kueri dashboard berjalan instan.

### 3.4 Kriteria Selesai (*Acceptance Criteria*) Fitur Analitik

| Komponen Fitur | Target Kinerja & Kriteria Selesai | Mekanisme Penanganan Kegagalan |
| :--- | :--- | :--- |
| **Skrip Pelacak Klien** | Ukuran skrip < 2 KB; eksekusi non-blocking via `navigator.sendBeacon`. | Jika browser tidak mendukung beacon, fallback ke `fetch` asynchronous dengan mode `keepalive`. |
| **Latensi Ingestion API** | Respons endpoint `/api/v1/analytics/event` selesai dalam waktu < 50 milidetik. | Pemrosesan asinkron di background queue agar tidak membebani siklus event loop utama. |
| **Penegakan Rate Limit** | Menolak request ke-61 dalam 1 menit dari IP yang sama dengan kode HTTP 429. | Menyediakan header `Retry-After: 60` pada respon HTTP. |
| **Kueri Grafik Dashboard** | Waktu pemuatan data grafik rentang 30 hari selesai dalam waktu < 100 milidetik. | Mengambil data pra-agregasi dari tabel `AnalyticsDaily`, bukan pemindaian baris mentah. |
| **Pembersihan Data Lama** | Cron job harian membersihkan raw event berusia lebih dari 90 hari tanpa mengganggu performa server. | Eksekusi otomatis batch delete di luar jam kerja sibuk (pukul 02:00 WIB). |

---

## 4. Matriks Prioritas Rilis Fitur

| No | Modul / Fitur | Prioritas | Manfaat bagi Tim & Klien |
| :--- | :--- | :---: | :--- |
| **1** | Multi-Tenancy Dasar (`site_id` di setiap event) | **Fase 1 (MVP)** | Menjamin pondasi arsitektur siap melayani banyak situs |
| **2** | Akses Multi-Akun Paralel (Sesi Mandiri 3 Staf) | **Fase 1 (MVP)** | Ketiga anggota tim dapat memantau data tanpa tabrakan sesi |
| **3** | Metrik Trafik Utama (Visitors, Views, Duration) | **Fase 1 (MVP)** | Mengetahui volume tren pertumbuhan pengunjung harian |
| **4** | Pelacakan Klik WhatsApp & Pengiriman Formulir | **Fase 1 (MVP)** | Mengukur konversi riil calon klien yang masuk |
| **5** | Pengamanan Anti-Spam (Rate Limit & Origin Check) | **Fase 1 (MVP)** | Melindungi basis data dari serangan spam bot |
| **6** | Halaman Terpopuler (*Top Pages*) | **Fase 1 (MVP)** | Mengetahui artikel dan portofolio yang paling diminati |
| **7** | Saluran Rujukan (Google, Media Sosial, Direct) | **Fase 1 (MVP)** | Evaluasi saluran pemasaran yang paling produktif |
| **8** | Proporsi Perangkat (Mobile vs Desktop) | **Fase 1 (MVP)** | Memastikan desain responsif tepat sasaran |
| **9** | Filter Rentang Waktu (Hari Ini, 7 & 30 Hari) | **Fase 1 (MVP)** | Analisis perbandingan performa mingguan dan bulanan |
| **10** | Pemilih Situs (*Site Selector* untuk Tim Internal) | **Fase 1 (MVP)** | Navigasi cepat antara situs Next Karya dan proyek aktif |
| **11** | Sebaran Wilayah / Geografis Kota (GeoIP) | **Fase 2** | Pemetaan persebaran lokasi calon klien |
| **12** | Pelacakan UTM Parameters Detail | **Fase 2** | Pengukuran efektivitas kampanye promosi berbayar |
| **13** | Ekspor Laporan CSV / Excel (Desktop) | **Fase 2** | Pelaporan berkala dan arsip evaluasi manajemen |
| **14** | Portal & Login Mandiri Khusus Klien | **Fase 2** | Klien dapat masuk ke dashboard privat situs miliknya |

---

## 5. Kesimpulan

Dengan arsitektur ini, **Dashboard Analitik Next Karya Digital Solutions**:
1. Menjamin 3 anggota tim internal dapat memantau performa situs secara bersamaan tanpa gangguan konflik sesi.
2. Menggunakan identitas domain resmi `nextkarya.web.id` dan skema `site_id` sejak awal.
3. Melindungi infrastruktur dari banjir bot dengan pertahanan berlapis (Rate Limiting 60 req/menit dan validasi skema).
4. Menjunjung transparansi data dengan memposisikan metrik sebagai indikator tren pertumbuhan bisnis riil tanpa *overclaim*.
