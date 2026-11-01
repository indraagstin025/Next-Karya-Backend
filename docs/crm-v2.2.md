# Spesifikasi & Daftar Fitur CRM (Tahap Awal & Multiplatform)
**Next Karya Digital Solutions**  
*Dokumen Arsitektur & Perencanaan Fitur Sistem Manajemen Hubungan Klien & Jadwal Proyek*  
*Versi: 2.2 Kanonik (Multi-User Concurrency, Anti-Collision, & Resource Timeline)*  
*Tanggal Berlaku: 31 Oktober 2026*

> [!IMPORTANT]
> **Batasan Lingkup & Hak Akses (Fase 1 vs Fase Berikutnya):**  
> Fase 1 (MVP) dibangun khusus untuk operasional tim internal Next Karya Digital Solutions dengan `site_id: "nextkarya-main"`. Skema database dan API `site_id` disiapkan sejak hari pertama untuk kesiapan multi-tenant jangka panjang, namun fitur login mandiri dan panel mandiri untuk akun klien adalah lingkup Fase berikutnya (Fase 2).

---

## 1. Ringkasan Eksekutif & Filosofi Desain

Sistem CRM (Customer Relationship Management) Next Karya Digital Solutions dirancang khusus untuk **tahap awal agensi digital yang bergerak lincah (*Lean & Agile Agency*)**. 

Fokus utamanya bukan birokrasi penjualan yang rumit, melainkan:
1. **Menutup Kesepakatan Lebih Cepat (*Fast Deal Closing*):** Merespons calon klien dari website resmi `nextkarya.web.id` dan WhatsApp dengan cepat tanpa ada prospek yang terlewat.
2. **Kolaborasi Multi-Akun Tanpa Bentrok (*Safe Multi-User Concurrency*):** Memastikan 3 orang anggota tim dapat membuka data prospek, mencatat hasil diskusi, dan mengatur jadwal proyek secara bersamaan di perangkat masing-masing dengan aman.
3. **Agenda Follow-Up Harian Terpantau (*Daily Follow-Up Discipline*):** Menyediakan halaman kerja khusus setiap pagi agar tim langsung tahu siapa calon klien yang harus dihubungi hari ini.
4. **Visibilitas Beban Kerja Tim (*Team Resource Timeline*):** Mengetahui ketersediaan jadwal tim pengembang dan desainer secara visual agar estimasi waktu ke klien selalu akurat dan tidak terjadi bentrok pengerjaan.
5. **Penyimpanan Riwayat Klien Terpusat (*Single Client Profile*):** Menampung data kontak, catatan diskusi, nilai proyek, status pengerjaan, hingga batas akhir garansi purnajual dalam satu kartu klien.

```
                         ┌────────────────────────────────────────────────────────┐
                         │  LEADS MASUK (Website nextkarya.web.id, WhatsApp, Rujukan) │
                         │  - Dilindungi Honeypot & Rate Limiter Anti-Spam        │
                         └───────────────────────────┬────────────────────────────┘
                                                     │
                                                     ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  AGENDA FOLLOW-UP HARI INI (DIBUKA 3 ANGGOTA TIM SETIAP PAGI)                                    │
│  - Daftar Prospek Jatuh Tempo Hari Ini (Due Today) & Terlewat (Overdue)                          │
│  - Penanda Penanggung Jawab (Assignee) Mencegah Duplikasi Follow-Up                              │
│  - Tombol 1-Klik: Chat WhatsApp / Kirim Email / Jadwalkan Ulang                                  │
└────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                             │
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  ALUR STATUS PENJUALAN (SALES PIPELINE)                                                          │
│  [ 1. BARU ] ──▶ [ 2. DIHUBUNGI ] ──▶ [ 3. PROPOSAL ] ──▶ [ 4. DEAL / MENANG ]                  │
│                                                     └──▶ [ 5. BATAL ]                           │
│  - Dilengkapi Optimistic Locking agar Status Pipeline Tidak Tertimpa Saat Diedit Bersamaan       │
└────────────────────────────────────────────┬─────────────────────────────────────────────────────┘
                                             │ Prospek Deal / Resmi Jadi Proyek
                                             ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│  TIMELINE BEBAN KERJA & JADWAL TIM (GANTT SCHEDULE VIEW)                                         │
│  - Baris per Anggota Tim: Staf A (Programmer), Staf B (Desainer), Staf C (Project Lead)          │
│  - Balok Durasi Proyek Klien (Tanggal Mulai hingga Tanggal Selesai)                              │
│  - Pemantauan Garansi Purnajual & Tautan Proyek (Staging / Live)                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Rincian Modul & Fitur CRM

### Pilar 1: Kotak Masuk Prospek (*Leads Inbox*) & Anti-Spam

Menampung seluruh calon klien yang masuk secara otomatis dari formulir website, klik WhatsApp, maupun input manual oleh tim:

* **Informasi Kontak Lengkap:**
  - Nama Calon Klien (*Contact Person*).
  - Nomor WhatsApp atau Telepon aktif.
  - Alamat Email resmi.
  - Nama Bisnis, Usaha, atau Perusahaan Klien.
  - Identitas Asal Situs (`site_id: "nextkarya-main"`).
* **Kebutuhan Layanan & Estimasi Anggaran:**
  - Kategori Layanan yang diminati (Website Bisnis, Portal Berita CMS, Redesign, Aplikasi Mobile, atau Sistem Kustom).
  - Ringkasan Kebutuhan Proyek (pesan awal mengenai kendala atau fitur yang diinginkan).
  - Estimasi Nilai Proyek (*Deal Value*, misal: Rp 5.000.000 atau Rp 15.000.000) untuk memantau potensi omset.
* **Pengamanan Anti-Spam pada Endpoint `POST /api/v1/leads`:**
  - **Honeypot Protection:** Menyediakan field tersembunyi `website_url` yang tidak terlihat oleh pengunjung biasa. Jika bot spam mengisi field ini, pengiriman formulir langsung diabaikan secara otomatis tanpa memicu error di klien.
  - **Rate Limiting Ketat (Pertahanan Utama):** Maksimal 5 pengiriman pesan per IP per 15 menit untuk mencegah serangan spam banjir formulir.
  - **Validasi Origin / Referer (Lapisan Pertahanan Tambahan):** Server memeriksa apakah pengiriman berasal dari domain resmi (`https://nextkarya.web.id`). Karena header Origin dapat hilang pada webview atau dimanipulasi, perlindungan utama tetap berpegang pada Honeypot dan Rate Limiting.
  - **Validasi Skema Zod Express & Sanitasi Teks:** Mencegah injeksi kode berbahaya, memotong spasi berlebih, dan membatasi panjang teks pesan maksimal 2.000 karakter.

---

### Pilar 2: Halaman "Agenda Follow-Up Hari Ini" (Fitur Unggulan MVP)

Untuk memastikan tanggal pengingat tidak terlewat meskipun fitur push notification ponsel dialokasikan untuk Fase 2:

* **Halaman Kerja Rutin Pagi Hari:**
  - Halaman kerja khusus di dashboard CRM yang dibuka oleh tim setiap pagi saat memulai jam kerja operasional.
* **Penyaringan Otomatis (*Smart Filtering*):**
  - Menampilkan semua prospek yang memiliki jadwal follow-up pada hari ini atau tanggal sebelumnya yang belum sempat dihubungi, dengan status masih aktif (*Baru*, *Dihubungi*, atau *Kirim Proposal*).
* **Indikator Visual Prioritas:**
  - Kuning: **Jatuh Tempo Hari Ini (*Due Today*)**, prospek yang dijadwalkan untuk dihubungi hari ini.
  - Merah: **Terlewat (*Overdue*)**, prospek yang tanggal jadwalnya sudah terlewat lebih dari 1 hari dan belum ada catatan perkembangan baru.
* **Tindakan Cepat 1-Klik:**
  - Tombol 1-klik "Chat WhatsApp" langsung membuka obrolan ke nomor klien dengan template pembuka ramah.
  - Tombol "Tandai Sudah Dihubungi" untuk memperbarui status dan memasukkan catatan hasil obrolan.
  - Tombol "Jadwalkan Ulang (*Reschedule*)" jika klien meminta dihubungi kembali di hari lain.

---

### Pilar 3: Alur Status Penjualan Sederhana (*5-Stage Sales Pipeline*)

Alur kerja prospek dibuat sangat jelas dan tanpa tahapan birokrasi yang berbelit:

1. **Baru (*New Lead*):**
   Pesan baru masuk dari website atau chat WhatsApp, belum direspons atau ditindaklanjuti oleh tim.
2. **Dihubungi (*In Discussion / Contacted*):**
   Tim sudah menghubungi calon klien dan sedang menggali kebutuhan teknis atau proses bisnis mereka.
3. **Kirim Proposal (*Proposal Sent*):**
   Rancangan lingkup kerja (*scope of work*) dan rincian estimasi biaya resmi sudah dikirimkan ke klien.
4. **Deal / Menang (*Won & Active*):**
   Klien menyetujui penawaran, uang muka (DP) dibayarkan, dan proyek resmi masuk ke antrean pengerjaan tim.
5. **Batal (*Lost*):**
   Klien belum jadi mengambil layanan, anggaran belum sesuai, atau menunda pengerjaan proyek.

---

### Pilar 4: Catatan Riwayat Klien & Tindak Lanjut (*Interaction Log*)

* **Catatan Internal Tim (*Interaction Notes*):**
  - Kolom catatan singkat untuk mencatat hasil pembicaraan per tanggal.
  - Contoh format: "30 Okt: Diskusi via WhatsApp lancar, klien minta revisi fitur pembayaran online, proposal final dikirim besok siang".
* **Aksi Cepat 1-Klik (*One-Click Actions*):**
  - **Tombol "Chat di WhatsApp":** Langsung membuka WhatsApp Web atau aplikasi WhatsApp di HP menuju nomor klien dengan template sapaan pembuka otomatis dari Next Karya Digital Solutions.
  - **Tombol "Kirim Email":** Membuka aplikasi email dengan subjek resmi konsultasi (`nextkarya@gmail.com`).

---

### Pilar 5: Timeline Jadwal Proyek & Alokasi Tim (*Team Resource Timeline*)

Fitur visual kalender horizontal yang menampilkan alokasi jadwal pengerjaan proyek per anggota tim:

* **Tampilan Baris per Anggota Tim (*Group by: Team Member*):**
  - Setiap baris mewakili satu anggota tim:
    - **Staf A:** Programmer / Pengembang Sistem
    - **Staf B:** Desainer UI/UX & Aset Visual
    - **Staf C:** Project Lead / Operasional & Klien
* **Balok Jadwal Proyek (*Task Duration Bar*):**
  - Balok memanjang secara visual dari Tanggal Mulai (*Start Date*) hingga Tanggal Selesai (*End Date*) melintasi kolom hari dan tanggal kalender.
  - Setiap balok memuat nama proyek klien dan tahapan kerja aktif (contoh: "Desain UI Web Portal Klien", "Koding Toko Online").
* **Kode Warna Status Proyek:**
  - **Biru:** Draf / Persiapan materi konten.
  - **Kuning:** Sedang dalam proses desain atau pengerjaan aktif.
  - **Hijau:** Selesai dikerjakan dan sudah diuji coba.
  - **Ungu:** Tahap uji coba atau revisi akhir bersama klien.
* **Manfaat Operasional:**
  - Mengetahui secara instan siapa anggota tim yang sedang memiliki jadwal kosong saat ada penawaran proyek baru.
  - Menghindari risiko salah satu staf mengalami kelebihan beban kerja (*overload*).

---

### Pilar 6: Informasi Purnajual & Garansi Proyek (*Post-Sales & Warranty*)

Setelah proyek klien berhasil diluncurkan (*Go-Live*), data tetap dipantau untuk menjaga kepuasan klien:

* **Tautan Penting Proyek:**
  - Tautan Lingkungan Percobaan (*Staging URL*).
  - Tautan Website Resmi yang Sudah Live (*Production URL*).
  - Tautan File Desain Figma atau Repositori Dokumentasi Teknis.
* **Pelacak Masa Garansi Purnajual (*Warranty Expiry*):**
  - Mencatat tanggal berakhirnya garansi perbaikan bug teknis (misal: 30 hingga 45 hari pasca-peluncuran).
  - Memberikan indikator pada dashboard saat masa garansi mendekati akhir, sehingga tim dapat menawarkan paket perpanjangan pemeliharaan website berkala (*maintenance contract*).

---

### Pilar 7: Kolaborasi Multi-Akun & Penanganan Akses Bersamaan (*Multi-User Concurrency*)

Dirancang khusus agar 3 orang anggota tim dapat bekerja bersamaan di CRM secara aman dan sinkron:

#### 7.1 Sesi Mandiri Tanpa Konflik (*Isolated Sessions*)
* Ketiga anggota tim memiliki akun masing-masing dengan email resmi (`nama@nextkarya.web.id`).
* Masing-masing staf dapat membuka CRM di laptop maupun HP secara bersamaan tanpa saling memutuskan sesi login.

#### 7.2 Penanda Penanggung Jawab (*Lead Assignee*)
* Setiap prospek yang masuk dapat diberikan label penanggung jawab utama (*Assigned To: Staf A / Staf B / Staf C*).
* Menghindari duplikasi komunikasi: Rekan tim lain dapat langsung melihat bahwa prospek tersebut sudah dipegang oleh rekan kerjanya, sehingga klien tidak dihubungi dua kali oleh orang yang berbeda.

#### 7.3 Pencegahan Konflik Status Pipeline (*Optimistic Locking*)
* Jika dua anggota tim membuka kartu prospek yang sama pada detik yang sama, sistem menggunakan stempel waktu `updatedAt`.
* Jika Staf A sudah mengubah status prospek menjadi "Kirim Proposal", dan Staf B mencoba mengubahnya menjadi "Batal" tanpa memuat ulang layar, sistem menampilkan pemberitahuan ramah:
  > "Perhatian: Data prospek ini baru saja diperbarui oleh rekan kerja Anda. Silakan muat ulang halaman untuk melihat status terkini."

#### 7.4 Jejak Riwayat Tindakan (*Activity Log*) & Pengalihan Tugas Darurat
* Setiap perubahan status prospek, penambahan catatan follow-up, pengubahan nominal nilai proyek, atau penggeseran alokasi tugas di timeline otomatis mencatat nama staf yang melakukan tindakan tersebut.
* **Pengalihan Tugas Darurat (*Emergency Re-assignment*):**
  - Jika ada staf yang mendadak berhalangan atau sakit, anggota tim lain dapat mengalihkan penanggung jawab prospek atau tugas proyek secara instan melalui dialog konfirmasi khusus.
  - Tindakan pengalihan ini dicatat dalam log audit: siapa yang mengalihkan, staf lama, staf baru, stempel waktu, dan alasan pengalihan.

---

## 3. Kriteria Selesai (*Acceptance Criteria*) Fitur CRM

| Komponen Fitur | Target Kinerja & Kriteria Selesai | Mekanisme Penanganan Kegagalan |
| :--- | :--- | :--- |
| **Penerimaan Formulir Leads** | Endpoint `/api/v1/leads` merespons dalam waktu < 100 milidetik; data tersimpan di database. | Jika database sibuk, antrean pesan disimpan sementara dan dicoba ulang. |
| **Perlindungan Honeypot** | Jika field `website_url` terisi, sistem mengembalikan status sukses semu (HTTP 200) tanpa menyimpan data. | Mencegah bot spam mengetahui bahwa pengiriman mereka ditolak. |
| **Penegakan Rate Limit** | Menolak pengiriman formulir ke-6 dalam rentang 15 menit dari IP yang sama dengan HTTP 429. | Menampilkan pesan ramah: "Mohon tunggu beberapa menit sebelum mengirim pesan kembali." |
| **Aksi 1-Klik WhatsApp** | Tautan `https://wa.me/` terbuka dengan teks sapaan otomatis dalam waktu < 1 detik. | Jika peramban memblokir popup, fallback dengan membuka tautan di tab peramban baru secara langsung. |
| **Pencegahan Konflik Status** | Validasi `updatedAt` menolak perubahan status basi dengan HTTP status 409 Conflict. | Antarmuka memunculkan pop-up pemberitahuan dan tombol "Muat Ulang Data Terkini". |
| **Agenda Follow-Up Hari Ini** | Halaman memuat daftar prospek jatuh tempo hari ini dalam waktu < 150 milidetik. | Kueri diindeks pada kolom `[nextFollowUpDate, status, assignedTo]`. |

---

## 4. Matriks Prioritas Rilis Fitur CRM

| No | Modul / Fitur | Prioritas | Manfaat bagi Bisnis & Tim |
| :--- | :--- | :---: | :--- |
| **1** | Kotak Masuk Prospek (*Leads Inbox*) | **Fase 1 (MVP)** | Menampung calon klien dari website publik |
| **2** | Kolaborasi Multi-Akun & Anti-Bentrok | **Fase 1 (MVP)** | Menjamin akses paralel aman bagi 3 anggota tim |
| **3** | Pengamanan Anti-Spam (Honeypot & Rate Limit) | **Fase 1 (MVP)** | Mencegah form website dibanjiri pesan spam bot |
| **4** | Agenda Follow-Up Hari Ini (*Due Today*) | **Fase 1 (MVP)** | Menjamin tidak ada calon klien yang lupa dihubungi |
| **5** | 5 Tahapan Alur Status (*Pipeline*) | **Fase 1 (MVP)** | Memantau posisi negosiasi dengan klien |
| **6** | Tombol Chat WhatsApp 1-Klik | **Fase 1 (MVP)** | Mempercepat waktu respons tim ke calon klien |
| **7** | Catatan Singkat & Nilai Proyek (*Deal Value*) | **Fase 1 (MVP)** | Mencatat hasil diskusi dan estimasi omset |
| **8** | Timeline Beban Kerja Tim (*Schedule View*) | **Fase 1 (MVP)** | Mengetahui alokasi jadwal tim pengembang |
| **9** | Pelacak Masa Garansi Purnajual | **Fase 1 (MVP)** | Menjaga kepuasan klien dan peluang perpanjangan |
| **10** | Filter & Pencarian Cepat Kontak | **Fase 1 (MVP)** | Menemukan data kontak klien seketika |
| **11** | Pengalihan Tugas Darurat (*Emergency Re-assignment*) | **Fase 1 (MVP)** | Mengalihkan tugas staf yang berhalangan dengan jejak audit |
| **12** | Notifikasi Pengingat Otomatis via HP/Email | **Fase 2** | Pengiriman push notification ke ponsel masing-masing staf |
| **13** | Pembuatan Invoice & Faktur Otomatis | **Fase 2** | Otomasi tagihan termin pembayaran proyek |

---

## 5. Kesimpulan

Dengan spesifikasi ini, **Sistem CRM Next Karya Digital Solutions**:
1. Menggunakan identitas resmi brand `nextkarya.web.id` dan alamat kontak `nextkarya@gmail.com`.
2. Menjamin kolaborasi 3 orang anggota tim berjalan aman, sinkron, dan bebas bentrok data (*concurrency-safe* via Optimistic Locking).
3. Menghadirkan halaman kerja harian **"Agenda Follow-Up Hari Ini"** di MVP, sehingga tidak ada prospek yang terlewat meskipun notifikasi push HP dialokasikan untuk Fase 2.
4. Terlindungi dari serangan bot melalui Honeypot, validasi Origin bertingkat, dan Rate Limiting.
5. Memberikan visibilitas alokasi jadwal pengerjaan proyek yang jelas dan adil bagi seluruh staf melalui **Timeline Beban Kerja Tim**.
