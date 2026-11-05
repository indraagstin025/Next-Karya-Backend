import { z } from "zod";

/**
 * Pesan bawaan Zod untuk kondisi yang tidak punya pesan khusus.
 * Tujuannya agar pengguna membaca kalimat biasa, bukan istilah teknis.
 */
z.setErrorMap((issue, ctx) => {
  switch (issue.code) {
    case z.ZodIssueCode.invalid_type:
      return {
        message:
          issue.received === "undefined" || issue.received === "null"
            ? "Bagian ini wajib diisi."
            : "Isian ini belum sesuai.",
      };
    case z.ZodIssueCode.invalid_literal:
      return { message: "Pilihan ini tidak tersedia." };
    case z.ZodIssueCode.unrecognized_keys:
      return {
        message: "Ada isian yang tidak dikenali. Muat ulang halaman lalu coba lagi.",
      };
    case z.ZodIssueCode.invalid_union:
    case z.ZodIssueCode.invalid_union_discriminator:
      return { message: "Isian ini belum sesuai." };
    case z.ZodIssueCode.invalid_enum_value:
      return { message: "Pilihan ini tidak tersedia. Silakan pilih dari daftar." };
    case z.ZodIssueCode.invalid_arguments:
    case z.ZodIssueCode.invalid_return_type:
      return { message: "Permintaan tidak dapat diproses." };
    case z.ZodIssueCode.invalid_date:
      return { message: "Tanggal belum benar." };
    case z.ZodIssueCode.invalid_string:
      if (issue.validation === "email") {
        return { message: "Alamat email belum benar. Contoh: nama@email.com." };
      }
      if (issue.validation === "url") {
        return { message: "Alamat web belum benar. Contoh: https://namasitus.com." };
      }
      return { message: "Isian ini belum benar." };
    case z.ZodIssueCode.too_small:
      if (issue.type === "string") {
        return { message: `Isian ini minimal ${issue.minimum} karakter.` };
      }
      if (issue.type === "array") {
        return { message: `Pilih minimal ${issue.minimum} item.` };
      }
      if (issue.type === "date") {
        return { message: "Tanggalnya terlalu awal." };
      }
      return { message: `Nilai ini minimal ${issue.minimum}.` };
    case z.ZodIssueCode.too_big:
      if (issue.type === "string") {
        return { message: `Isian ini maksimal ${issue.maximum} karakter.` };
      }
      if (issue.type === "array") {
        return { message: `Maksimal ${issue.maximum} item.` };
      }
      if (issue.type === "date") {
        return { message: "Tanggalnya terlalu akhir." };
      }
      return { message: `Nilai ini maksimal ${issue.maximum}.` };
    case z.ZodIssueCode.not_multiple_of:
      return { message: "Nilai ini tidak sesuai." };
    case z.ZodIssueCode.not_finite:
      return { message: "Nilai ini tidak wajar." };
    case z.ZodIssueCode.custom:
      return { message: ctx.defaultError };
    default:
      return { message: "Isian ini belum sesuai." };
  }
});
