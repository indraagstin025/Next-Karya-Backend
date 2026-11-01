# Spesifikasi & Daftar Fitur Dashboard Analitik (Multi-Tenant & Anti-Overclaim)
**Next Karya Digital Solutions**  
*Dokumen Arsitektur & Perencanaan Fitur Sistem Analitik Kunjungan & Konversi*  
*Versi: 2.2 (Multi-Tenant site_id, Multi-User Concurrent Access, & Transparansi Data)*  
*Tanggal: 30 Oktober 2026*

---

## 1. Ringkasan Eksekutif & Filosofi Desain

Sistem Dashboard Analitik Next Karya Digital Solutions dibangun untuk memberikan visibilitas performa trafik dan konversi bagi website resmi `nextkarya.id` maupun website klien yang membeli paket digital, tanpa mengorbankan kecepatan akses maupun privasi pengunjung.

### 1.1 Strategi Multi-Tenancy (Dimulai dari Hari Pertama)
* Setiap event kunjungan dan konversi **wajib menyertakan parameter `site_id`** sejak hari pertama (misal: `site_id: "nextkarya-main"` untuk website resmi, atau `site_id: "klien-xxx"` untuk website klien).
* Mesin analitik ini dapat melayani banyak website sekaligus (*Multi-Tenant Architecture*). 
* Tim Next Karya Digital Solutions dapat memantau seluruh performa situs klien melalui pemilih situs (*Site Selector*), sedangkan klien hanya dapat melihat dashboard yang terkunci ke `site_id` milik mereka.

### 1.2 Batasan Teknis & Transparansi Data Tren (Prinsip Anti-Overclaim)
Untuk menjaga integritas dan kejujuran data di hadapan klien:
1. **Bebas Cookie Pihak Ketiga (*Privacy-First*):**
   - Menggunakan metode anonim *daily salted IP hash* tanpa cookie pelacak, sehingga website tidak memerlukan popup banner persetujuan cookie yang mengganggu.
2. **Karakteristik Data Kunjungan Bulanan:**
   - Karena salt diacak per hari demi privasi, pengunjung yang sama yang datang di hari Senin dan Rabu akan terhitung sebagai pengunjung unik pada masing-masing hari tersebut.
   - Akumulasi metrik bulanan adalah **Total Daily Unique Visitors**, bukan angka mutlak individu perorangan (*Absolute Monthly Unique Individuals*).
3. **Estimasi Durasi Kunjungan:**
   - Durasi kunjungan yang dicatat dari sinyal *beacon* adalah estimasi heuristik waktu aktif tab browser, bukan pengukuran waktu tatap mata mutlak.
4. **Fungsi Utama:**
   - Metrik dashboard diposisikan sebagai **Indikator Tren Pertumbuhan (*Growth Trend Indicator*)** untuk melihat arah perkembangan bisnis dan perbandingan performa konten, bukan sebagai alat audit legal atau janji angka mutlak kepada klien.

```
┌───────────────────────────────────────┐
│ WEBSITE PUBLIK (nextkarya.id / Klien) │
│ Skrip Pelacak Ringan (< 2 KB)         │
└───────────────────┬───────────────────┘
                    │ Sinyal Event: POST /api/v1/analytics/event
                    │ Payload: { site_id: "nextkarya-main", eventName: "pageview", ... }
                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ BACKEND ANALITIK & PENGAMAN SPAM                                       │
│ 1. Rate Limiting per IP (Maks 60 req/menit)                            │
│ 2. Validasi site_id & Allowlist Origin Domain                          │
│ 3. Tabel Raw Event (TTL 90 Hari) & Agregasi Harian (Daily Rollup)      │
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

Kartu indikator tren di bagian atas dashboard dengan perbandingan persentase naik/turun dibanding periode sebelumnya:

* **Pengunjung Harian Unik (*Daily Unique Visitors*):**
  Estimasi jumlah perangkat unik yang mengunjungi situs per hari dalam rentang waktu yang dipilih.
* **Total Tayangan (*Pageviews*):**
  Akumulasi total berapa kali halaman website dibuka atau disegarkan (*refresh*).
* **Sesi Kunjungan (*Sessions*):**
  Kunjungan aktif pengunjung (sesi dianggap selesai jika pengunjung tidak beraktivitas selama 30 menit).
* **Rata-rata Durasi Kunjungan (*Average Visit Duration*):**
  Estimasi durasi rata-rata yang dihabiskan pengunjung untuk membaca konten website.
* **Tingkat Pantulan (*Bounce Rate %*):**
  Persentase pengunjung yang meninggalkan website setelah hanya membuka satu halaman saja.

---

### Pilar 2: Pelacakan Konversi & Sasaran Bisnis (*Goal & Conversion Tracking*)

Mengukur efektivitas website dalam menghasilkan calon klien (*leads*):

* **Klik Chat WhatsApp Konsultasi:**
  Mencatat setiap kali tombol *Chat WhatsApp* atau tombol *Konsultasi* ditekan oleh pengunjung di Beranda, Navbar, Layanan, maupun Footer.
* **Pengiriman Formulir Proyek (*Form Submissions*):**
  Jumlah formulir konsultasi yang berhasil dikirim oleh calon klien dari halaman Beranda dan halaman Kontak.
* **Klik Detail Layanan & Portofolio:**
  Menghitung frekuensi klik pada kartu layanan dan studi kasus portofolio untuk mengukur minat pasar terhadap jenis solusi digital tertentu.
* **Rasio Konversi Keseluruhan (*Overall Conversion Rate %*):**
  Kalkulasi persentase perbandingan antara pengunjung yang mengambil tindakan (klik WhatsApp / isi form) terhadap total pengunjung unik:
  $$\text{Conversion Rate} = \left( \frac{\text{Total Aksi Konversi}}{\text{Total Pengunjung Unik}} \right) \times 100\%$$

---

### Pilar 3: Analisis Perilaku & Konten Populer (*Content & Behavior*)

* **Halaman Terpopuler (*Top Pages*):**
  - Tabel peringkat halaman berdasarkan jumlah tayangan (*views*), persentase kontribusi trafik, dan estimasi waktu baca.
  - Membantu tim melihat artikel blog apa atau studi kasus portofolio mana yang paling diminati pembaca.
* **Sumber Rujukan Trafik (*Traffic Sources & Referrers*):**
  - **Pencarian Organik (*Search Engine*):** Pengunjung yang menemukan website dari Google, Bing, atau Yahoo.
  - **Media Sosial (*Social Media*):** Trafik dari Instagram, LinkedIn, TikTok, Facebook, atau WhatsApp Web.
  - **Langsung (*Direct*):** Pengunjung yang mengetik langsung domain resmi (seperti `nextkarya.id`) atau membuka dari bookmark browser.
  - **Rujukan (*Referral*):** Tautan dari portal berita, direktori bisnis, atau website mitra luar.
* **Pelacakan Kampanye Promosi (*UTM Campaign Tracking*):**
  - Mendeteksi parameter pelacak URL khusus saat tim membagikan link promosi:
    - `utm_source` (misal: *instagram_bio, newsletter, linkedin_post*)
    - `utm_medium` (misal: *cpc, social, email*)
    - `utm_campaign` (misal: *promo_ramadhan, relaunch_website*)

---

### Pilar 4: Demografi & Spesifikasi Teknologi (*Audience Breakdown*)

* **Proporsi Perangkat (*Device Types*):**
  - Pembagian persentase antara Smartphone (Mobile), Laptop/PC (Desktop), dan Tablet.
  - Sangat berguna untuk memastikan desain antarmuka responsif sudah tepat sasaran.
* **Sistem Operasi & Peramban (*OS & Browsers*):**
  - Android, iOS, Windows, macOS, Linux.
  - Google Chrome, Safari, Microsoft Edge, Mozilla Firefox.
* **Sebaran Wilayah Geografis (*Geographic Location*):**
  - Negara dan kota asal pengunjung (misal: Bandung, Jakarta, Surabaya, Medan, Semarang, dll).
  - Ditentukan secara anonim berbasis database GeoIP tanpa melacak titik koordinat GPS pribadi pengunjung.

---

### Pilar 5: Visualisasi Data, Filter Waktu & Ekspor Laporan

* **Pemilih Situs (*Site Selector*):**
  - Untuk akun Next Karya Digital Solutions: dapat berpindah melihat analitik website utama maupun website milik klien.
  - Untuk akun Klien: terkunci otomatis hanya dapat melihat `site_id` miliknya.
* **Filter Rentang Waktu Fleksibel:**
  - Hari Ini (*Today*)
  - 7 Hari Terakhir (*Last 7 Days*)
  - 30 Hari Terakhir (*Last 30 Days*)
  - Bulan Ini / Bulan Lalu
  - Kustom rentang tanggal (*Custom Date Range*) melalui pemilih kalender.
* **Grafik Visual Interaktif:**
  - **Grafik Garis Tren (*Line Chart*):** Memvisualisasikan fluktuasi pengunjung harian dan jam sibuk kunjungan.
  - **Grafik Batang (*Horizontal Bar Chart*):** Membandingkan halaman terpopuler dan sumber trafik rujukan.
  - **Grafik Donat (*Donut Chart*):** Memperlihatkan proporsi perangkat (HP vs Desktop).
* **Ekspor Laporan Ringkas:**
  - Tombol unduh data ringkasan ke format **CSV** dan **Excel** untuk bahan evaluasi mingguan atau laporan bulanan manajemen.

---

### Pilar 6: Akses Kolaborasi Multi-Akun pada Dashboard Analitik (*Multi-User Access*)

Dirancang agar seluruh 3 anggota tim Next Karya Digital Solutions dapat menganalisis data secara paralel tanpa hambatan:

#### 6.1 Sesi Filter Mandiri di Setiap Perangkat (*Client-Side State*)
* Ketiga staf dapat membuka Dashboard Analitik secara bersamaan di perangkat masing-masing.
* Filter rentang tanggal atau pemilihan situs (*Site Selector*) berjalan di sisi peramban masing-masing staf:
  - Jika Staf 1 sedang menganalisis trafik *"7 Hari Terakhir"* di ponsel,
  - Dan Staf 2 sedang memeriksa metrik *"Bulan Lalu"* di laptop,
  - Tampilan kedua staf tidak akan saling memengaruhi atau mengubah layar satu sama lain.

#### 6.2 Pembacaan Agregasi Ringan (*High Concurrency Read*)
* Dashboard Analitik bersifat *Read-Only* bagi pengguna biasa.
* Query grafik tidak memindai jutaan baris data mentah, melainkan membaca data dari tabel agregasi harian (`AnalyticsDaily`).
* Dampak Teknis: Meskipun ketiga anggota tim membuka, memfilter, atau mengunduh laporan analitik pada detik yang sama, server database tetap dingin, cepat, dan tidak mengalami penurunan performa.

---

## 3. Arsitektur Teknis & Pengamanan Anti-Spam

### 3.1 Skrip Pelacak di Sisi Klien (Next.js & Mobile)

Skrip pelacak di Next.js berjalan di latar belakang tanpa memblokir proses rendering:

```javascript
// Contoh pengiriman event analitik dari website resmi Next Karya Digital Solutions
navigator.sendBeacon('/api/v1/analytics/event', JSON.stringify({
  site_id: 'nextkarya-main',
  eventName: 'pageview', // atau 'whatsapp_click', 'form_submit'
  path: window.location.pathname,
  referrer: document.referrer || null,
  screenWidth: window.innerWidth,
  utmSource: 'linkedin',
  utmCampaign: 'branding_q4'
}));
```

### 3.2 Pengamanan Endpoint `POST /api/v1/analytics/event`
Untuk mencegah serangan bot, spam log, dan request palsu:
1. **Rate Limiting Ketat:** Dibatasi maksimal 60 request per IP per menit.
2. **Validasi `site_id`:** Request ditolak jika `site_id` tidak terdaftar aktif di database.
3. **Validasi Origin / Referrer Header:**
   - Server mencocokkan header `Origin` atau `Referer` dengan daftar domain resmi yang diizinkan untuk `site_id` tersebut (misal: `https://nextkarya.id` untuk `nextkarya-main`).
   - Request dari domain asing atau tanpa header valid langsung di-drop dengan status 403 Forbidden.
4. **Validasi Payload Zod:** Payload dibatasi maksimal 2 KB dan dilarang mengandung karakter kontrol anomali.

### 3.3 Desain Database & Skema Agregasi (PostgreSQL)

1. **Tabel `AnalyticsEvent` (Data Mentah / Transaksional):**
   - Kolom: `id`, `site_id`, `eventName`, `path`, `referrer`, `source`, `device`, `city`, `visitorIdHash`, `occurredAt`.
   - Dilengkapi *TTL / Retention Policy* 90 hari untuk menghemat storage.
2. **Tabel `AnalyticsDaily` (Data Agregasi Harian):**
   - Kolom: `site_id`, `date`, `path`, `source`, `device`, `pageviews`, `visitors`, `sessions`, `bounces`, `conversions`.
   - Diindeks unik pada `[site_id, date, path, source, device]` agar proses agregasi dan query dashboard berlangsung dalam hitungan milidetik.

---

## 4. Matriks Prioritas Rilis Fitur

| No | Modul / Fitur | Prioritas | Manfaat bagi Bisnis |
| :--- | :--- | :---: | :--- |
| **1** | Multi-Tenancy Dasar (`site_id` di setiap event) | **Fase 1 (MVP)** | Siap dipakai website sendiri & website klien |
| **2** | Akses Multi-Akun Paralel (Sesi Mandiri 3 Staf) | **Fase 1 (MVP)** | Memastikan 3 staf dapat melihat metrik bersamaan |
| **3** | Metrik Trafik Utama (Visitors, Views, Duration) | **Fase 1 (MVP)** | Mengetahui volume tren pengunjung harian |
| **4** | Pelacakan Klik WhatsApp & Form Submit | **Fase 1 (MVP)** | Mengetahui konversi prospek klien riil |
| **5** | Pengamanan Anti-Spam (Rate Limit & Origin) | **Fase 1 (MVP)** | Melindungi endpoint dari bot dan request sampah |
| **6** | Halaman Terpopuler (*Top Pages*) | **Fase 1 (MVP)** | Melihat artikel dan portofolio paling diminati |
| **7** | Sumber Kunjungan (Google, Media Sosial, Direct) | **Fase 1 (MVP)** | Evaluasi saluran pemasaran yang paling efektif |
| **8** | Proporsi Perangkat (Mobile vs Desktop) | **Fase 1 (MVP)** | Memastikan kenyamanan tampilan antarmuka |
| **9** | Filter Rentang Waktu (Hari Ini, 7 & 30 Hari) | **Fase 1 (MVP)** | Analisis perbandingan performa berkala |
| **10** | Pemilih Situs (*Site Selector* untuk Tim) | **Fase 1 (MVP)** | Kemudahan berpindah antara situs Next Karya dan klien |
| **11** | Sebaran Wilayah / Geografis Kota | **Fase 2** | Pemetaan persebaran lokasi calon klien |
| **12** | Pelacakan UTM Parameters Detail | **Fase 2** | Pengukuran efektivitas kampanye promosi berbayar |
| **13** | Ekspor Laporan CSV / Excel | **Fase 2** | Pelaporan berkala ke manajemen internal |

---

## 5. Kesimpulan

Dengan spesifikasi ini, **Dashboard Analitik Next Karya Digital Solutions**:
1. Beroperasi penuh menggunakan domain resmi `nextkarya.id`.
2. Menjamin seluruh 3 anggota tim dapat mengakses, memfilter, dan mengevaluasi data secara bersamaan tanpa gangguan sesi.
3. Menerapkan arsitektur multi-tenant `site_id` sejak hari pertama.
4. Terlindungi dari spam bot melalui Rate Limiting dan verifikasi Origin domain.
5. Menjunjung transparansi teknis dengan memposisikan data sebagai indikator tren pertumbuhan bisnis riil tanpa *overclaim*.
