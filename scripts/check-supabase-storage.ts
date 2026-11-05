import crypto from "crypto";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import {
  buildSupabasePublicBaseUrl,
  normalizeSupabaseProjectUrl,
} from "../src/services/storage.service";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z1xkAAAAASUVORK5CYII=",
  "base64"
);

function fail(message: string): never {
  console.error(`GAGAL: ${message}`);
  process.exit(1);
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function resolveEnvFile(): string {
  const inlineArg = process.argv.find((arg) => arg.startsWith("--env="));
  const flagIndex = process.argv.indexOf("--env");
  const value =
    inlineArg?.slice("--env=".length) ??
    (flagIndex >= 0 ? process.argv[flagIndex + 1] : undefined) ??
    ".env";

  return path.resolve(process.cwd(), value);
}

function loadEnvValues(): {
  source: string;
  values: Record<string, string | undefined>;
} {
  const envPath = resolveEnvFile();
  if (fs.existsSync(envPath)) {
    return { source: envPath, values: dotenv.parse(fs.readFileSync(envPath)) };
  }

  if (process.env.SUPABASE_URL || process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { source: "process.env", values: process.env };
  }

  fail(`Berkas environment tidak ditemukan: ${envPath}`);
}

async function main() {
  const { source: envSource, values: parsed } = loadEnvValues();
  const projectUrl = parsed.SUPABASE_URL?.trim();
  const serviceKey = parsed.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = parsed.SUPABASE_STORAGE_BUCKET?.trim() || "nextkarya-media";
  const configuredPublicUrl = parsed.SUPABASE_STORAGE_PUBLIC_URL?.trim().replace(/\/+$/, "");

  if (!projectUrl) fail(`SUPABASE_URL belum diisi di ${envSource}`);
  if (!serviceKey) fail(`SUPABASE_SERVICE_ROLE_KEY belum diisi di ${envSource}`);

  if (parsed.STORAGE_DRIVER && parsed.STORAGE_DRIVER !== "supabase") {
    fail(`STORAGE_DRIVER di ${envSource} bernilai "${parsed.STORAGE_DRIVER}", bukan "supabase".`);
  }

  const normalizedProjectUrl = normalizeSupabaseProjectUrl(projectUrl);
  if (normalizedProjectUrl !== projectUrl.replace(/\/+$/, "")) {
    console.warn(
      `PERINGATAN: SUPABASE_URL sebaiknya tanpa /rest/v1 atau /storage/v1. Gunakan ${normalizedProjectUrl}`
    );
  }

  const canonicalPublicBase = buildSupabasePublicBaseUrl(normalizedProjectUrl, bucket);
  let publicBase = canonicalPublicBase;

  if (configuredPublicUrl) {
    const isS3Endpoint = /\.storage\.supabase\.co/i.test(configuredPublicUrl);
    if (!isHttpUrl(configuredPublicUrl) || isS3Endpoint) {
      console.warn(
        "PERINGATAN: SUPABASE_STORAGE_PUBLIC_URL tidak valid atau memakai endpoint S3."
      );
      console.warn(`  canonical: ${canonicalPublicBase}`);
      console.warn(`  terpasang: ${configuredPublicUrl}`);
      console.warn("  Uji publik memakai URL canonical.");
    } else {
      publicBase = configuredPublicUrl;
      if (configuredPublicUrl !== canonicalPublicBase) {
        console.warn("PERINGATAN: SUPABASE_STORAGE_PUBLIC_URL tidak sama dengan URL canonical.");
        console.warn(`  canonical: ${canonicalPublicBase}`);
        console.warn(`  terpasang: ${configuredPublicUrl}`);
      }
    }
  }
  const client = createClient(normalizedProjectUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  console.log(`Memeriksa bucket "${bucket}" di ${normalizedProjectUrl} ...`);

  const bucketResult = await client.storage.getBucket(bucket);
  let bucketInfo = bucketResult.data;

  if (bucketResult.error || !bucketInfo) {
    const message = bucketResult.error?.message || "tidak ada respons";
    const missing = /not found/i.test(message);
    const createRequested = process.argv.includes("--create-bucket");

    if (!missing || !createRequested) {
      fail(
        `Bucket "${bucket}" tidak bisa dibaca: ${message}${
          missing ? ". Jalankan ulang dengan --create-bucket untuk membuatnya." : ""
        }`
      );
    }

    console.log(`Bucket "${bucket}" belum ada. Membuat bucket publik ...`);
    const createResult = await client.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 10 * 1024 * 1024,
      allowedMimeTypes: [
        "image/webp",
        "image/png",
        "image/jpeg",
        "image/svg+xml",
        "application/pdf",
      ],
    });

    if (createResult.error) {
      fail(`Bucket "${bucket}" gagal dibuat: ${createResult.error.message}`);
    }

    const createdResult = await client.storage.getBucket(bucket);
    if (createdResult.error || !createdResult.data) {
      fail(
        `Bucket "${bucket}" sudah dibuat tetapi belum bisa dibaca: ${
          createdResult.error?.message || "tidak ada respons"
        }`
      );
    }
    bucketInfo = createdResult.data;
    console.log("OK: bucket publik berhasil dibuat.");
  }

  if (!bucketInfo.public) {
    fail(
      `Bucket "${bucket}" bersifat privat. Aktifkan Public bucket agar URL media bisa dipakai website.`
    );
  }

  console.log("OK: bucket ada dan bersifat publik.");

  const objectPath = `nextkarya-main/system-check/${crypto.randomUUID()}.png`;
  const signedResult = await client.storage
    .from(bucket)
    .createSignedUploadUrl(objectPath);

  if (signedResult.error || !signedResult.data) {
    fail(
      `Signed upload URL gagal dibuat: ${
        signedResult.error?.message || "tidak ada respons"
      }`
    );
  }

  console.log("OK: signed upload URL berhasil dibuat.");

  let uploaded = false;
  try {
    const uploadResponse = await fetch(signedResult.data.signedUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
        "x-upsert": "false",
      },
      body: PNG_1X1,
    });

    if (!uploadResponse.ok) {
      const detail = await uploadResponse.text().catch(() => "");
      fail(
        `Upload uji ditolak (HTTP ${uploadResponse.status})${
          detail ? `: ${detail.slice(0, 300)}` : ""
        }`
      );
    }
    uploaded = true;
    console.log("OK: berkas uji berhasil diunggah langsung ke bucket.");

    const infoResult = await client.storage.from(bucket).info(objectPath);
    if (infoResult.error || !infoResult.data) {
      fail(
        `Metadata objek tidak bisa dibaca: ${
          infoResult.error?.message || "tidak ada respons"
        }`
      );
    }

    if (infoResult.data.size !== PNG_1X1.length) {
      fail(
        `Ukuran objek tidak sesuai. Diharapkan ${PNG_1X1.length} byte, terbaca ${infoResult.data.size} byte.`
      );
    }

    const contentType =
      infoResult.data.contentType ?? infoResult.data.metadata?.mimetype ?? "";
    if (!contentType.startsWith("image/png")) {
      fail(`Tipe objek tidak sesuai. Terbaca "${contentType || "kosong"}".`);
    }
    console.log(`OK: metadata objek terbaca (${infoResult.data.size} byte, ${contentType}).`);

    const encodedPath = objectPath
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const publicUrl = `${publicBase}/${encodedPath}`;

    let publicStatus = 0;
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const response = await fetch(publicUrl, { method: "GET" });
      publicStatus = response.status;
      if (response.ok) break;
      await delay(1000);
    }

    if (publicStatus !== 200) {
      fail(
        `Objek tidak bisa dibaca publik (HTTP ${publicStatus}). Periksa bucket Public dan SUPABASE_STORAGE_PUBLIC_URL.`
      );
    }
    console.log("OK: objek bisa dibaca melalui URL publik.");
    console.log(`URL uji: ${publicUrl}`);
  } finally {
    if (uploaded) {
      const removeResult = await client.storage.from(bucket).remove([objectPath]);
      if (removeResult.error) {
        console.warn(
          `PERINGATAN: objek uji gagal dihapus (${removeResult.error.message}). Hapus manual: ${objectPath}`
        );
      } else {
        console.log("OK: objek uji sudah dihapus dari bucket.");
      }
    }
  }

  console.log("SELESAI: konfigurasi Supabase Storage siap dipakai.");
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
