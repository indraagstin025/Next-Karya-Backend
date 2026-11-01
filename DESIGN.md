# Arah Desain NAIKON Digital Solution (DESIGN.md)

Dokumen ini menjadi sumber identitas visual untuk antarmuka publik dan ruang kerja internal CMS/Analitik NAIKON.

## Identitas & Karakter

- **Produk:** Situs resmi, CMS internal, dan Dashboard Analitik NAIKON Digital Solution (software house B2B & institusi di Indonesia).
- **Kepribadian:** Lugas, teknis tanpa jargon kosong, terstruktur, dan berorientasi kejelasan operasional.
- **Bahasa Antarmuka:** Bahasa Indonesia yang wajar, aktif, dan langsung ke pokok informasi.

## Dials Liveliness

- **Situs Publik:** `Dial: ENERGY 2 / RHYTHM 2 / MOTION 2`
- **Ruang Kerja Internal (CMS, Bar Akses, & Analitik):** `Dial: ENERGY 1 / RHYTHM 1 / MOTION 1`
  - Ruang kerja internal mengutamakan keterbacaan tabel, kepadatan informasi yang tenang, dan kecepatan kerja dengan transisi minimal (hanya umpan balik hover/fokus <= 200 ms).

## Palet Warna

### Situs Publik (Terang Default, Mendukung `.theme-dark`)

- **Latar Halaman:** `#F7F9FD`
- **Permukaan Kartu:** `#FFFFFF` (sekunder `#EEF4FC`)
- **Teks Utama (Ink):** `#041E42` / `#102651`
- **Teks Sekunder:** `#425776`
- **Garis Pembatas:** `#D5E1EF`
- **Aksen Utama:** `#0066FF` (hover `#0052CC`)

### Ruang Kerja Internal & Bar Akses Portal (Tema Gelap Tetap)

Alasan tema gelap tetap: membedakan ruang kerja pengelolaan dari situs publik secara instan dan menjaga konsistensi makna warna pada grafik analitik.

- **Latar Halaman:** `#030711`
- **Permukaan Kontainer / Sidebar / Tabel:** `#0B1730`
- **Permukaan Naik (Input / Hover / Dropdown):** `#12213F`
- **Garis Pembatas Dekoratif:** `#1E3358`
- **Garis Batas Kontrol Interaktif (Input / Tombol Sekunder):** `#4E6E9E` (memenuhi rasio kontras non-teks >= 3:1 terhadap `#0B1730`)
- **Teks Utama:** `#F1F5FB` (rasio > 14:1)
- **Teks Sekunder:** `#94A7C4` (rasio > 6.5:1)
- **Aksen Tombol Utama:** `#2563EB` dengan teks `#FFFFFF` (hover `#1D4ED8`, rasio >= 5.1:1)
- **Indikator Fokus Keyboard:** `#38BDF8` (`outline: 2px solid #38BDF8`, `outline-offset: 2px`)
- **Status Semantik (selalu dipasangkan dengan teks/ikon):**
  - Sukses / Terbit: `#34D399`
  - Peringatan / Draf: `#FBBF24`
  - Bahaya / Galat: `#FCA5A5` (teks) dan `#F87171` (ikon/aksen)

## Tipografi, Radius, & Spasi

- **Font:** System UI sans-serif (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) untuk pemuatan nol-latensi dan keterbacaan angka/tabel yang tajam; `tabular-nums` wajib untuk metrik dan waktu.
- **Radius:** Berjenjang sesuai fungsi elemen, bukan seragam berbentuk pil:
  - Kontainer panel / kartu kerja: `16px` (`rounded-2xl`)
  - Input formulir & tombol kerja internal: `10px` - `12px` (`rounded-xl`)
  - Label status fungsional: `6px` (`rounded-md`)
- **Target Sentuh & Keyboard:** Seluruh kontrol interaktif memiliki tinggi minimum `44px` (`min-h-11`) dengan jarak antar kontrol minimal `8px`.
