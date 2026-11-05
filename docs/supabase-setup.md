# Setup Supabase untuk CMS Next Karya

Panduan ini mencakup **Supabase Postgres** dan **Supabase Storage** untuk media CMS.
Supabase Auth tidak dipakai; login staf tetap memakai JWT backend.

## 1. Buat project Supabase

1. Buat project baru di Supabase.
2. Pilih region **Southeast Asia (Singapore)** agar latensi ke Jakarta rendah.
3. Simpan password database yang dibuat Supabase.

## 2. Ambil connection string

Buka **Project Settings > Database > Connection string**.

Untuk backend Express + Prisma, gunakan **Session Pooler** dengan port `5432`.
Salin URI-nya, lalu ganti password dengan password project.

Contoh bentuknya:

```text
postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require
```

Jangan menebak host atau region. Salin nilai asli dari dashboard Supabase.
Jika password mengandung karakter khusus, URL-encode password tersebut.

## 3. Buat bucket media

1. Buka **Storage > New bucket**.
2. Nama bucket: `nextkarya-media`.
3. Aktifkan **Public bucket** agar URL gambar bisa dipakai website.
4. Buat bucket sebelum mengunggah media pertama.

Tidak perlu membuat policy RLS untuk upload dari CMS. Backend memakai
`SUPABASE_SERVICE_ROLE_KEY` untuk membuat signed upload URL, dan service role
melewati RLS. Jangan pernah mengirim service role key ke browser.

Jika browser menolak upload karena CORS, periksa **Storage > Settings > CORS**
dan tambahkan origin website, misalnya `http://localhost:3000` untuk development
dan domain produksi setelah deploy.

## 4. Isi environment backend

1. Salin template:

```powershell
Copy-Item .env.supabase.example .env
```

2. Isi nilai berikut di `backend/.env`:
   - `DATABASE_URL` dari Session Pooler Supabase.
   - `JWT_SECRET` baru, minimal 32 karakter.
   - `WEBHOOK_SECRET` baru, minimal 16 karakter.
   - `REDIS_URL` jika memakai Redis lokal atau Redis hosted.
   - `STORAGE_DRIVER="supabase"`.
   - `SUPABASE_URL` dari **Project Settings > API > Project URL**. Gunakan alamat
     dasar project, misalnya `https://<PROJECT_REF>.supabase.co`, bukan alamat
     yang berakhiran `/rest/v1/`.
   - `SUPABASE_SERVICE_ROLE_KEY` dari **Project Settings > API > service_role**.
   - `SUPABASE_STORAGE_BUCKET="nextkarya-media"`.
   - `SUPABASE_STORAGE_PUBLIC_URL` harus berupa URL public object, misalnya
     `https://<PROJECT_REF>.supabase.co/storage/v1/object/public/nextkarya-media`.
     Jangan memakai endpoint S3 `...storage.supabase.co/storage/v1/s3`.
   - `SUPABASE_SIGNED_UPLOAD_TTL_SECONDS="900"` untuk masa berlaku tiket upload.

3. Setelah nilai terisi, buat bucket (jika belum ada) sekaligus uji alur
   upload langsung, metadata, baca publik, dan hapus objek:

```powershell
npm run storage:check -- --create-bucket
```

Skrip ini hanya membuat bucket publik `nextkarya-media` bila belum ada. Jika
bucket sudah ada, skrip hanya menguji tanpa mengubah konfigurasi bucket.

Frontend **tidak perlu** kredensial Supabase. Frontend hanya memanggil backend
melalui `NEXT_PUBLIC_API_URL` dan `BACKEND_API_URL`, lalu mengunggah byte langsung
ke signed URL yang diberikan backend.

## 5. Siapkan database

Untuk percobaan cepat dengan database Supabase yang masih kosong:

```powershell
npx prisma generate
npx prisma db push
npm run db:seed
```

`prisma db push` dipakai karena repo belum memiliki folder `prisma/migrations`.
Untuk produksi, baseline migration harus dibuat terlebih dahulu, lalu gunakan
`prisma migrate deploy`.

Jika ingin memindahkan data dari Neon ke Supabase:

```powershell
pg_dump "<NEON_DATABASE_URL>" --no-owner --no-privileges -f backup.sql
psql "<SUPABASE_DATABASE_URL>" -f backup.sql
```

Jika data yang ada hanya data kanonik dari seed, cara paling cepat adalah
`prisma db push` lalu `npm run db:seed`.

Untuk produksi, isi `SEED_DEFAULT_PASSWORD` (minimal 8 karakter) sebelum
menjalankan seed. Seed tidak mengubah kata sandi akun yang sudah ada, jadi
ganti kata sandi staf setelah login pertama. Jangan memakai kata sandi contoh
di produksi.

## 6. Jalankan dan cek

Uji konfigurasi storage sebelum menjalankan aplikasi:

```powershell
npm run storage:check
```

Untuk memakai berkas environment lain, misalnya staging:

```powershell
npm run storage:check -- --env .env.staging
```

Lalu jalankan backend:

```powershell
npm run dev
```

Cek endpoint publik:

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/api/v1/articles?site_id=nextkarya-main&limit=5"
```

Lalu buka CMS dan lakukan uji:

1. Login staf.
2. Buat artikel draf.
3. Publish artikel dan pastikan muncul di `/blog`.
4. Buka **CMS > Media**, unggah gambar.
5. Pastikan gambar tampil, URL mengarah ke
   `https://<PROJECT_REF>.supabase.co/storage/v1/object/public/nextkarya-media/...`,
   dan objek muncul di bucket Supabase.
6. Ubah teks alternatif, lalu hapus media yang tidak dipakai.

## 7. Alur upload langsung

1. Browser meminta `POST /api/v1/media/upload-url` dengan metadata berkas.
2. Backend memvalidasi jenis dan ukuran, membuat object path
   `site_id/YYYY/MM/<uuid>.<ext>`, lalu mengembalikan signed upload URL.
3. Browser mengirim byte berkas langsung ke Supabase Storage dengan `PUT`.
4. Browser memanggil `POST /api/v1/media/confirm` dengan `ticketId`.
5. Backend memeriksa metadata objek (ukuran dan MIME) melalui Supabase Storage,
   lalu menyimpan baris `Media`. Byte berkas tidak pernah melewati server backend.

Endpoint CRUD media:

- `GET /api/v1/media` — daftar media.
- `POST /api/v1/media/upload-url` — buat signed upload URL.
- `POST /api/v1/media/confirm` — verifikasi objek dan simpan metadata.
- `PATCH /api/v1/media/:id` — ubah teks alternatif.
- `DELETE /api/v1/media/:id` — hapus objek dan metadata jika tidak dipakai konten.

Endpoint multipart lama `POST /api/v1/media` tetap tersedia hanya saat
`STORAGE_DRIVER="local"`. Saat driver Supabase aktif, endpoint itu ditolak agar
byte berkas tidak diproses server.

## 8. Catatan penting

- **Supabase Auth tidak dipakai.** Login staf tetap memakai JWT backend.
- **Bucket harus publik** agar `url` media bisa dipakai website. Signed upload URL
  tetap diperlukan untuk menulis objek.
- **Service role key hanya di backend.** Jangan expose ke frontend atau repositori.
- **RLS database tidak diaktifkan** karena akses database hanya lewat backend Prisma.
  Jangan memberi akses langsung ke database dari browser.
- **Redis bukan bagian dari Supabase.** Backend memiliki fallback in-memory,
  tetapi Redis tetap disarankan untuk produksi.
- **Tiket upload kedaluwarsa** setelah `SUPABASE_SIGNED_UPLOAD_TTL_SECONDS`.
  Jika objek sudah terunggah tetapi konfirmasi gagal, objek bisa menjadi orphan.
  Bersihkan objek orphan secara berkala atau gunakan lifecycle policy di Supabase.
- **Free tier Supabase dapat pause** setelah periode tidak aktif. Untuk produksi,
  gunakan paket berbayar atau pastikan project tetap aktif.
- Setelah mengganti `DATABASE_URL` atau variabel storage, restart backend.
