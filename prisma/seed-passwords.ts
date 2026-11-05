import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/**
 * Jalur darurat untuk merotasi kata sandi staf tanpa menjalankan seed konten.
 *
 * Skrip ini hanya mengubah `passwordHash` dan menaikkan `tokenVersion`.
 * Tidak ada konten, status situs, atau data lain yang disentuh.
 *
 * Pemakaian:
 *   SEED_PASSWORD_PROGRAMMER="..." \
 *   SEED_PASSWORD_DESIGNER="..." \
 *   SEED_PASSWORD_LEAD="..." \
 *   npm run db:seed-passwords
 *
 * Akun yang variabelnya kosong akan dilewati. Minimal satu akun harus diisi.
 */

const prisma = new PrismaClient();

const PASSWORD_HASH_COST = 12;
const MIN_PASSWORD_LENGTH = 12;

const ACCOUNTS = [
  {
    label: "Programmer",
    email: "programmer@nextkarya.web.id",
    envKey: "SEED_PASSWORD_PROGRAMMER",
  },
  {
    label: "Desainer",
    email: "designer@nextkarya.web.id",
    envKey: "SEED_PASSWORD_DESIGNER",
  },
  {
    label: "Project Lead",
    email: "lead@nextkarya.web.id",
    envKey: "SEED_PASSWORD_LEAD",
  },
] as const;

async function main() {
  const updates: Array<{
    email: string;
    fullName: string;
    passwordHash: string;
  }> = [];

  for (const account of ACCOUNTS) {
    const plainPassword = process.env[account.envKey]?.trim();

    if (!plainPassword) {
      console.log(`Lewati ${account.label}: ${account.envKey} kosong.`);
      continue;
    }

    if (plainPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(
        `${account.envKey} minimal ${MIN_PASSWORD_LENGTH} karakter.`
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: account.email },
      select: { id: true, email: true, fullName: true },
    });

    if (!user) {
      throw new Error(
        `Akun ${account.email} tidak ditemukan. Periksa kembali email staf.`
      );
    }

    updates.push({
      email: user.email,
      fullName: user.fullName,
      passwordHash: await bcrypt.hash(plainPassword, PASSWORD_HASH_COST),
    });
  }

  if (updates.length === 0) {
    throw new Error(
      "Tidak ada kata sandi yang diisi. Isi minimal satu variabel SEED_PASSWORD_*."
    );
  }

  await prisma.$transaction(
    updates.map((update) =>
      prisma.user.update({
        where: { email: update.email },
        data: {
          passwordHash: update.passwordHash,
          tokenVersion: { increment: 1 },
        },
      })
    )
  );

  for (const update of updates) {
    console.log(`Kata sandi diperbarui: ${update.fullName} <${update.email}>`);
  }

  console.log(
    "Selesai. Semua sesi lama untuk akun yang diubah sudah tidak berlaku."
  );
}

main()
  .catch((error) => {
    console.error("Rotasi kata sandi gagal:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
