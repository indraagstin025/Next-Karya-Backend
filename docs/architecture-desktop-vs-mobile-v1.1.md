# Panduan & Arsitektur Peran: Desktop Web vs Aplikasi Mobile
**Next Karya Digital Solutions**  
*Cetak Biru Pembagian Fitur Antara Pusat Komando Desktop dan Pendamping Mobile*  
*Versi: 1.1 Kanonik (Action-First Companion & Emergency Toolkit)*  
*Tanggal: 31 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Filosofi Utama Pembagian Platform

Untuk mencegah antarmuka mobile menjadi lambat, rumit, dan tidak nyaman digunakan (*overcrowded UI*), Next Karya Digital Solutions menerapkan prinsip pemisahan peran yang tegas antara perangkat komputer dan ponsel:

1. **Desktop Web (Laptop / PC Monitor Lebar):**
   **"Pusat Komando & Kreasi Lengkap (*Deep Work & Command Center*)"**
   - Dioperasikan saat anggota tim duduk di meja kerja.
   - Dikhususkan untuk tugas mendalam: penulisan artikel panjang, tata letak portofolio resolusi tinggi, penataan jadwal Gantt chart multi-minggu di layar lebar, dan analisis data bisnis komprehensif.
2. **Aplikasi Mobile (Flutter untuk Android & iOS):**
   **"Pendamping Reaksi Cepat & Alat Darurat (*Action Companion & Emergency Toolkit*)"**
   - Dibangun menggunakan framework **Flutter** (satu basis kode untuk Android & iOS) yang berkomunikasi dengan backend Express.js (TypeScript) melalui rute RESTful JSON.
   - Dioperasikan saat anggota tim sedang bergerak (*on-the-go*), di luar kantor, atau di akhir pekan.
   - Dikhususkan untuk respon cepat: merespons prospek klien seketika (integrasi `url_launcher` WhatsApp), membuka agenda follow-up harian, memantau angka ringkas hari ini, dan mengeksekusi penyelamatan darurat dalam hitungan detik.

### 1.1 Spesifikasi Teknologi Aplikasi Mobile (Flutter)

* **Framework & Bahasa:** Flutter (Dart), mendukung kompilasi native untuk Android dan iOS dari satu basis kode (*Single Codebase*).
* **Integrasi Backend:** Mengonsumsi REST API JSON dari layanan backend Express.js (TypeScript) (`/api/v1/...`).
* **Autentikasi & Keamanan:** Token sesi terenkripsi menggunakan Secure Storage pada perangkat mobile dengan header `Authorization: Bearer <token>` dan validasi parameter `site_id: "nextkarya-main"`.
* **Keunggulan untuk Tim Next Karya:**
  - Performa render UI native 60 fps yang ringan dan hemat baterai di seluruh tipe smartphone.
  - Integrasi native cepat: membuka obrolan WhatsApp via package `url_launcher` tanpa jeda.
  - Haptic feedback dan dialog konfirmasi instan saat mengeksekusi aksi darurat (*Emergency Toolkit*).
  - Kesiapan integrasi push notification di Fase 2 via Firebase Cloud Messaging (FCM).

```
┌────────────────────────────────────────────────────────┐
│ DESKTOP WEB (COMMAND CENTER)                           │
│ - Studio Konten CMS Lengkap & Pratinjau Desktop/Mobile │
│ - Timeline Gantt Chart Horizontal Lebar                │
│ - Analitik Tren Multi-Minggu & Analisis Saluran        │
│ - Manajemen Kontrak & Pipeline CRM Komprehensif        │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Database PostgreSQL, Cache Redis & API Express.js (TypeScript)
                            │ (site_id: "nextkarya-main")
                            │
┌───────────────────────────┴────────────────────────────┐
│ APLIKASI MOBILE (ACTION COMPANION & EMERGENCY)         │
│ - Akses Cepat Agenda Follow-up Hari Ini (Due / Overdue)│
│ - Tombol 1-Klik Chat WhatsApp ke Calon Klien           │
│ - Tampilan Agenda Tugas Harian Vertikal                │
│ - Sekilas 4 Angka Analitik Hari Ini (Pulse Check)      │
│ - Emergency Toolkit: Takedown Konten & Kunci Form Spam │
└────────────────────────────────────────────────────────┘
```

---

## 2. Matriks Perbandingan Fitur Lengkap

| Modul | Desktop Web (Pusat Komando) | Aplikasi Mobile (Respon Cepat & Darurat) | Status Rilis |
| :--- | :--- | :--- | :---: |
| **1. CRM (Prospek Klien)** | • Manajemen pipeline penjualan visual lengkap.<br>• Input data klien, draf proposal, & nilai kontrak.<br>• Riwayat interaksi detail seluruh klien.<br>• Filter dan pencarian data mendalam. | • **Halaman Agenda Follow-Up Hari Ini**.<br>• **Tombol 1-klik** chat WhatsApp ke klien.<br>• Pembaruan status prospek cepat (*Dihubungi, Proposal, Deal*).<br>• Catatan singkat hasil diskusi.<br>• *Notifikasi Push Ponsel (Fase 2)*. | **Fase 1 (MVP)**<br>*(Push: Fase 2)* |
| **2. Timeline Proyek & Tim** | • **Tampilan Gantt Chart Horizontal Lebar:**<br>Melihat balok durasi proyek melintasi banyak hari dan banyak anggota tim sekaligus.<br>• Menata jadwal dan alokasi tugas tim. | • **Tampilan Agenda Vertikal Harian (*Card List*):**<br>Daftar tugas harian ringkas: tugas harian Staf A (Programmer), Staf B (Desainer), dan Staf C (Lead) tanpa tabel horizontal sempit. | **Fase 1 (MVP)** |
| **3. CMS (Konten & Media)** | • **Studio Konten Lengkap:**<br>Editor artikel kaya (*rich text*), unggah galeri gambar resolusi tinggi, kurasi portofolio, dan snapshot otomatis 5 versi. | • **Pemantauan Status & Tindakan Darurat:**<br>Melihat daftar artikel yang sudah tayang.<br>• **1-Tap Emergency Unpublish:** Menurunkan konten bermasalah seketika.<br>• Koreksi cepat teks krusial (nomor WA/harga). | **Fase 1 (MVP)** |
| **4. Dashboard Analitik** | • **Analisis Bisnis Mendalam:**<br>Grafik tren multi-minggu, tabel halaman terpopuler, analisis saluran rujukan (Google/Medsos), dan *Ekspor CSV/Excel (Fase 2)*. | • **Sekilas Angka Hari Ini (*Quick Pulse Check*):**<br>4 angka ringkas di layar utama HP:<br>1. Pengunjung unik hari ini.<br>2. Klik WhatsApp hari ini.<br>3. Leads baru hari ini.<br>4. Estimasi nilai proyek bulan ini. | **Fase 1 (MVP)**<br>*(Ekspor: Fase 2)* |
| **5. Tindakan Darurat (*Emergency*)** | • Konfigurasi teknis mendalam dan pemeriksaan audit log sistem lengkap. | • **Sakelar Darurat Kunci Form Kontak** jika web diserang bot spam (alihkan form ke WA).<br>• **Sakelar Banner Darurat Website** (*Announcement*).<br>• **Alihkan Tugas Staf** jika rekan kerja sakit/darurat.<br>• **Putus Sesi HP Hilang (`REVOKE_SESSION`)** via kenaikan tokenVersion & Redis. | **Fase 1 (MVP)** |

---

## 3. Toolkit Tindakan Darurat di Mobile (*Emergency Toolkit*)

Aplikasi mobile dirancang untuk merespons skenario krisis operasional dalam waktu singkat tanpa harus menunggu staf membuka laptop:

### 3.1 Krisis Konten Publik (CMS Emergency)

* **1-Tap Emergency Unpublish / Takedown (Fase 1 MVP):**
  - Menurunkan artikel atau portofolio seketika dari website publik jika ditemukan materi rahasia (NDA), logo keliru, atau informasi sensitif yang belum boleh tayang.
  - Alur Keamanan:
    1. Pengguna menekan tombol "Takedown Darurat".
    2. Muncul dialog konfirmasi wajib berisi kolom alasan penarikan (*Reason*).
    3. Status konten langsung dialihkan ke `DRAFT` atau `ARCHIVED`.
    4. Webhook Next.js otomatis dipicu via HTTP Header `x-webhook-secret` untuk membersihkan cache publik dalam waktu < 3 detik (dengan toleransi *retry* 3x *exponential backoff*).
    5. Setiap aksi dicatat dalam Audit Log: `userId`, `articleId`, `timestamp`, `reason`, serta tombol "Batalkan / Terbitkan Ulang".
* **Koreksi Teks Krusial Cepat (*Quick Emergency Text Fix - Fase 1 MVP*):**
  - Mengubah teks krusial langsung dari HP: nomor WhatsApp darurat yang berganti, nomor rekening pembayaran, atau informasi promo yang salah ketik.
* **Sakelar Banner Darurat Website (*Site-Wide Alert Banner - Fase 1 MVP*):**
  - Mengaktifkan strip banner darurat di website publik Next.js melalui sakelar sederhana di HP (contoh: "Layanan konsultasi tatap muka ditutup sementara hingga pukul 13.00 WIB" atau "Website sedang menjalani pemeliharaan sistem kilat").

### 3.2 Krisis Pelayanan & Alokasi Tim (CRM Emergency)

* **Hubungi Klien Seketika (1-Tap Direct WhatsApp / Phone Call - Fase 1 MVP):**
  - Sekali ketuk langsung membuka obrolan WhatsApp atau panggilan telepon ke nomor calon klien tanpa perlu menyalin nomor secara manual.
* **Pengalihan Penanggung Jawab Cepat (*Emergency Task Reassignment - Fase 1 MVP*):**
  - Jika staf yang ditugaskan mendadak sakit atau mengalami kendala darurat, anggota tim lain dapat mengalihkan penanggung jawab prospek atau tugas proyek ke dirinya sendiri atau rekan lain melalui dialog konfirmasi berizin.
  - Aksi pengalihan dicatat di log aktivitas: nama pengalih, penanggung jawab lama, penanggung jawab baru, stempel waktu, dan alasan pengalihan.
* **Akses Cepat Tautan Proyek (*Emergency Quick Links - Fase 1 MVP*):**
  - Tombol cepat untuk membuka website *Staging* atau *Production* klien guna memverifikasi laporan kendala teknis dari klien seketika.

### 3.3 Krisis Keamanan & Serangan Spam

* **Sakelar Darurat "Kunci Formulir Kontak" (*Pause Form to WhatsApp - Fase 1 MVP*):**
  - Jika website publik tiba-tiba diserang banjir spam bot yang melewati batas wajar, sakelar ini langsung menonaktifkan pengiriman formulir web dan mengubah tampilan formulir menjadi tombol langsung menuju WhatsApp resmi tim.
  - Mencegah basis data CRM tercemar oleh ribuan entri sampah saat tim sedang mencari solusi pengetatan firewall.
* **Pemutusan Sesi Login HP Hilang (*Emergency Revoke Session - Fase 1 MVP*):**
  - Jika salah satu ponsel anggota tim tertinggal atau hilang, rekan staf lain dapat memicu endpoint darurat `POST /api/v1/users/:id/revoke-sessions`.
  - Sistem seketika menaikkan `tokenVersion` staf tersebut di Redis dan database PostgreSQL, serta mencatat log audit darurat dengan `actionType: "REVOKE_SESSION"` dan target entitas `USER`. Seluruh token JWT yang beredar pada perangkat lama seketika ditolak dengan status HTTP `403 Forbidden`.

---

## 4. Kriteria Selesai (*Acceptance Criteria*) Emergency Toolkit

| Fitur Darurat | Target Kinerja & Kriteria Selesai | Mekanisme Jejak Audit & Rollback |
| :--- | :--- | :--- |
| **Emergency Unpublish** | Status artikel berubah ke `DRAFT` dalam < 1 detik; pembersihan cache Next.js selesai dalam < 3 detik via webhook header. | Mencatat `userId`, `articleId`, `timestamp`, `reason`. Tersedia tombol "Terbitkan Ulang" di riwayat audit. |
| **Kunci Form Kontak** | Sakelar mengubah status form secara instan di database; form di web publik beralih ke tombol WA dalam < 2 detik. | Mencatat siapa yang mengunci form dan alasan penguncian. Sakelar dapat dinonaktifkan kapan saja untuk membuka kembali form. |
| **Banner Darurat Web** | Banner pengumuman muncul di puncak halaman website publik dalam < 3 detik setelah sakelar diaktifkan. | Menampilkan teks pengumuman, nama pembuat banner, dan tombol matikan banner sekali sentuh. |
| **Alihkan Tugas Staf** | Penanggung jawab prospek/proyek beralih dalam waktu < 500 milidetik; daftar agenda otomatis terbarui. | Mencatat pengalih, staf awal, staf pengganti, dan stempel waktu pengalihan. |

---

## 5. Simulasi Alur Kerja Harian Tim 3 Orang

1. **Pagi Hari di HP (Web Mobile Responsif / Companion):**
   - Anggota tim membuka antarmuka mobile saat sarapan atau dalam perjalanan.
   - Melihat 4 metrik tren utama di beranda (*Pengunjung, Leads Baru, Klik WA, Estimasi Omset*).
   - Membuka halaman **"Agenda Follow-Up Hari Ini"**, lalu menekan tombol WhatsApp untuk menyapa 2 calon klien yang jatuh tempo hari ini.
2. **Siang Hari di Laptop (Desktop Web):**
   - Anggota tim bekerja di meja kerja laptop.
   - Menulis artikel edukasi teknologi baru di editor CMS lengkap dengan gambar, formatting teks, dan blok kode.
   - Menata portofolio studi kasus klien yang baru selesai diluncurkan.
   - Membuka tampilan kalender Gantt horizontal untuk mengatur jadwal pengerjaan proyek klien minggu depan bersama Staf A (Programmer), Staf B (Desainer), dan Staf C (Lead).
3. **Malam Hari / Akhir Pekan di HP (Mobile Companion):**
   - Tim sedang berada di luar kantor, calon klien baru masuk dari formulir website.
   - Dalam hitungan detik, anggota tim membaca ringkasan kebutuhan proyek dan langsung membalas sapaan melalui WhatsApp.
   - Jika terjadi kendala darurat (misal ada materi konten yang perlu ditakedown), tim dapat mengeksekusi penarikan dalam 1 ketukan jari langsung dari ponsel.

---

## 6. Kesimpulan & Manfaat bagi Pengembang

Dengan menerapkan arsitektur pemisahan ini:
1. **Pengembangan Mobile Lebih Terfokus & Efisien:** Tim pengembang tidak perlu memaksakan pembuatan komponen layar lebar yang tidak ergonomis di ponsel (seperti tabel Gantt horizontal dan editor konten kaya).
2. **Kinerja Antarmuka Ponsel Maksimal:** Antarmuka mobile sangat ringan, responsif, hemat kuota data, dan cepat dimuat di jaringan seluler.
3. **Kesiapsiagaan Operasional Tinggi:** Anggota tim Next Karya Digital Solutions memiliki perlindungan darurat (*Emergency Toolkit*) di genggaman tangan untuk merespons insiden konten atau serangan spam kapan saja.

---

## 7. Riwayat Pembaruan Dokumen (*Changelog*)

### Versi 1.1 Kanonik (31 Oktober 2026)
* Menyelaraskan status pemutusan sesi darurat HP hilang (`REVOKE_SESSION`) menjadi cakupan resmi Fase 1 (MVP) berbasis `tokenVersion` dan cache Redis.
* Memutakhirkan rujukan arsitektur backend ke layanan Express.js (TypeScript) dengan Prisma ORM & Raw SQL, database PostgreSQL, dan partisi `site_id: "nextkarya-main"`.
* Menyatakan berkas ini sebagai dokumen arsitektur komparatif kanonik (`architecture-desktop-vs-mobile-v1.1.md`).

