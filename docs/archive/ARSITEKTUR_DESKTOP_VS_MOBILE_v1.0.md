# Panduan & Arsitektur Peran: Desktop Web vs Aplikasi Mobile
**Next Karya Digital Solutions**  
*Cetak Biru Pembagian Fitur Antara Pusat Komando Desktop dan Pendamping Mobile*  
*Versi: 1.0 (Action-First Companion & Emergency Toolkit)*  
*Tanggal: 30 Oktober 2026*

---

## 1. Filosofi Utama Pembagian Platform

Untuk mencegah aplikasi mobile menjadi lambat, rumit, dan tidak nyaman digunakan (*overcrowded UI*), Next Karya Digital Solutions menerapkan prinsip pemisahan peran yang tegas:

1. **Desktop Web (Laptop / PC Monitor Lebar):**
   **"Pusat Komando & Kreasi Lengkap (*Deep Work & Command Center*)"**
   - Dioperasikan saat anggota tim duduk di meja kerja.
   - Dikhususkan untuk tugas-tugas berat: penulisan artikel panjang, tata letak portofolio resolusi tinggi, pengaturan jadwal Gantt chart multi-minggu di layar lebar, dan analisis data bisnis mendalam.
2. **Aplikasi Mobile (Smartphone Android & iOS):**
   **"Pendamping Reaksi Cepat & Alat Darurat (*Action Companion & Emergency Toolkit*)"**
   - Dioperasikan saat anggota tim sedang bergerak (*on-the-go*), di luar kantor, atau di akhir pekan.
   - Dikhususkan untuk respon cepat: merespons prospek klien seketika, membuka agenda follow-up harian, memantau angka ringkas hari ini, dan mengeksekusi penyelamatan darurat dalam 15 detik.

```
┌────────────────────────────────────────────────────────┐
│ DESKTOP WEB (COMMAND CENTER)                           │
│ - Studio Konten CMS Lengkap                            │
│ - Timeline Gantt Chart Horizontal Lebar                │
│ - Analitik Tren Multi-Minggu & Ekspor Excel            │
│ - Manajemen Kontrak & Pipeline CRM Mendalam            │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ Database PostgreSQL & API Backend
                            │ (site_id: "nextkarya-main")
                            │
┌───────────────────────────┴────────────────────────────┐
│ APLIKASI MOBILE (ACTION COMPANION & EMERGENCY)         │
│ - Notifikasi Instan Prospek Baru (Chat WhatsApp 1-Klik)│
│ - Agenda Follow-up Hari Ini (Due Today / Overdue)      │
│ - Tampilan Agenda Proyek Vertikal Harian               │
│ - Sekilas 4 Angka Analitik Hari Ini (Pulse Check)      │
│ - Emergency Toolkit: Takedown Konten & Kunci Spam Form │
└────────────────────────────────────────────────────────┘
```

---

## 2. Matriks Perbandingan Fitur Lengkap

| Modul | Desktop Web (Pusat Komando) | Aplikasi Mobile (Respon Cepat & Darurat) |
| :--- | :--- | :--- |
| **1. CRM (Prospek Klien)** | • Manajemen pipeline penjualan visual lengkap.<br>• Input data klien, draf proposal, & nilai kontrak.<br>• Riwayat interaksi detail seluruh klien.<br>• Filter dan pencarian data mendalam. | • **Notifikasi instan** saat ada leads baru masuk.<br>• **Halaman "Agenda Follow-Up Hari Ini"**.<br>• **Tombol 1-klik** langsung chat WhatsApp ke klien.<br>• Ubah status prospek cepat (*Dihubungi, Proposal, Deal*).<br>• Catatan singkat hasil obrolan suara/chat. |
| **2. Timeline Proyek & Tim** | • **Tampilan Gantt Chart Horizontal Lebar:**<br>Melihat balok durasi proyek melintasi banyak hari dan banyak anggota tim sekaligus.<br>• Menata jadwal dan menggeser alokasi staf. | • **Tampilan Agenda Vertikal Harian (*Card List*):**<br>Daftar tugas harian ringkas: *"Hari ini Brayan pegang proyek apa, Jane pegang apa"* (tanpa tabel horizontal yang sempit dan harus digeser-geser). |
| **3. CMS (Konten & Media)** | • **Studio Konten Lengkap:**<br>Editor artikel kaya (*rich text & code*), unggah galeri gambar resolusi tinggi, kurasi portofolio, dan optimasi SEO on-page. | • **Pemantauan Status & Tindakan Darurat:**<br>Melihat daftar artikel yang sudah tayang.<br>• **1-Tap Emergency Unpublish:** Menurunkan konten bermasalah/NDA detik itu juga.<br>• Edit cepat typo teks sensitif (misal: nomor WhatsApp/harga). |
| **4. Dashboard Analitik** | • **Analisis Bisnis Mendalam:**<br>Grafik tren multi-minggu, tabel top pages panjang, analisis saluran rujukan (Google/Medsos/UTM), dan ekspor file Excel/CSV. | • **Sekilas Angka Hari Ini (*Quick Pulse Check*):**<br>Cukup 4 angka ringkas di layar utama HP:<br>1. Pengunjung unik hari ini.<br>2. Klik WhatsApp hari ini.<br>3. Leads baru hari ini.<br>4. Estimasi omset deal bulan ini. |
| **5. Tindakan Darurat (*Emergency*)** | • Konfigurasi teknis mendalam dan audit log sistem lengkap. | • **Sakelar Darurat "Kunci Form Kontak"** jika web diserang bot spam (alihkan form ke WA).<br>• **Sakelar Banner Darurat Website** (*Announcement*).<br>• **Putus Sesi HP Hilang** jika ponsel staf tertinggal/hilang.<br>• **Alihkan Tugas Staf** jika rekan kerja sedang sakit/darurat. |

---

## 3. Toolkit Tindakan Darurat di Mobile (*Emergency Toolkit*)

Aplikasi mobile dirancang untuk merespons 3 skenario krisis dalam waktu kurang dari 15 detik:

### 3.1 Krisis Konten Publik (CMS Emergency)
* **1-Tap Emergency Unpublish / Takedown:**
  - Menurunkan artikel atau portofolio seketika dari website publik jika ada materi rahasia (NDA), logo salah, atau informasi sensitif yang bocor.
  - Sekali sentuh mengubah status konten ke *Draf* atau *Arsip*, dan webhook otomatis menghapus cache di website publik dalam 2 detik.
* **Perbaikan Typo Kritis Cepat (*Quick Emergency Text Fix*):**
  - Mengubah teks krusial langsung dari HP: nomor WhatsApp darurat yang ganti, nomor rekening pembayaran, atau harga promo yang keliru.
* **Sakelar Banner Darurat Website (*Site-Wide Alert Banner*):**
  - Mengaktifkan strip banner darurat di website publik Next.js *(contoh: "Layanan konsultasi offline sementara hingga pukul 13.00 WIB" atau "Website sedang pemeliharaan sistem kilat")*.

### 3.2 Krisis Pelayanan & Klien (CRM Emergency)
* **Hubungi Klien Seketika (1-Tap Direct WhatsApp / Phone Call):**
  - Dari notifikasi push HP yang berbunyi, sekali tap langsung membuka obrolan WhatsApp atau panggilan telepon ke calon klien tanpa perlu mencatat nomor secara manual.
* **Pengalihan Penanggung Jawab Cepat (*Reassign Staff*):**
  - Jika staf yang ditugaskan mendadak sakit atau tidak bisa dihubungi, staf lain lewat HP dapat langsung mengalihkan penanggung jawab prospek/proyek tersebut ke dirinya sendiri.
* **Akses Cepat Tautan Proyek (*Emergency Quick Links*):**
  - Tombol cepat untuk membuka website *Staging* atau *Live Production* klien guna mengecek apakah website klien benar-benar mengalami kendala teknis.

### 3.3 Krisis Keamanan & Serangan Spam
* **Sakelar Darurat "Kunci Formulir Kontak" (*Pause Form to WhatsApp*):**
  - Jika website publik tiba-tiba dibanjiri ratusan spam bot dalam beberapa menit, tombol ini mematikan sementara pengiriman formulir web dan mengalihkan seluruh tombol konsultasi langsung ke chat WhatsApp resmi tim.
* **Putus Sesi HP Hilang atau Dicuri (*Emergency Revoke Session*):**
  - Jika salah satu ponsel anggota tim tertinggal atau dicuri, rekan tim lainnya melalui HP masing-masing dapat langsung memutus sesi login ponsel tersebut demi melindungi data rahasia klien.

---

## 4. Simulasi Alur Kerja Harian Tim 3 Orang

1. **Pagi Hari di HP (Aplikasi Mobile):**
   - Anggota tim membuka aplikasi mobile saat sarapan atau perjalanan.
   - Melihat 4 kartu metrik utama di beranda HP (*Pengunjung, Leads Baru, Klik WA*).
   - Membuka tab **"Agenda Follow-Up Hari Ini"**, lalu tap tombol WhatsApp untuk menyapa 2 calon klien yang sudah jatuh tempo.
2. **Siang Hari di Laptop (Desktop Web):**
   - Anggota tim bekerja di meja kerja laptop.
   - Menulis artikel edukasi teknologi baru di editor CMS lengkap dengan gambar dan blok kode.
   - Menata portofolio studi kasus klien yang baru selesai diluncurkan.
   - Membuka tampilan kalender Gantt horizontal untuk mengatur jadwal pengerjaan proyek klien minggu depan.
3. **Malam Hari / Akhir Pekan di HP (Aplikasi Mobile):**
   - Tim sedang berada di luar kantor, notifikasi HP berbunyi ada calon klien baru masuk dari formulir website.
   - Dalam 10 detik, anggota tim membaca ringkasan kebutuhan proyek dan langsung membalas sapaan melalui WhatsApp.
   - Jika ada kabar darurat dari klien, status dapat diperbarui dalam satu ketukan jari.

---

## 5. Kesimpulan & Manfaat bagi Pengembang

Dengan menerapkan arsitektur pemisahan ini:
1. **Pengembangan Mobile Menjadi 3x Lebih Cepat:** Tim pengembang mobile (Flutter / React Native) tidak perlu membuang waktu berminggu-minggu membuat komponen kompleks seperti Gantt chart horizontal atau rich-text editor di HP.
2. **Kinerja Aplikasi Ponsel Maksimal:** Aplikasi mobile sangat ringan, responsif, hemat kuota data, dan hemat baterai.
3. **Produktivitas Tim Maksimal:** Anggota tim Next Karya Digital Solutions memiliki alat yang tepat untuk konteks kerja yang tepat (Desktop untuk pekerjaan mendalam, Mobile untuk respon instan dan tindakan darurat).
