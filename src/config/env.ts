import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z
  .object({
    PORT: z.string().default("5000").transform((val) => parseInt(val, 10)),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().default("redis://localhost:6379"),
    JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    ANALYTICS_SALT_SECRET: z
      .string()
      .min(32, "ANALYTICS_SALT_SECRET must be at least 32 characters")
      .optional(),
    WEBHOOK_SECRET: z.string().min(16, "WEBHOOK_SECRET must be at least 16 characters"),
    FRONTEND_URL: z.string().default("http://localhost:3000"),
    SITE_ID: z.string().default("nextkarya-main"),
    STAFF_ADMIN_EMAILS: z
      .string()
      .default("programmer@nextkarya.web.id")
      .transform((value) =>
        value
          .split(",")
          .map((email) => email.trim().toLowerCase())
          .filter((email) => email.length > 0)
      ),
    UPLOAD_DIR: z.string().default("./uploads"),
    STORAGE_DRIVER: z.enum(["local", "supabase"]).default("local"),
    SUPABASE_URL: z.string().url("SUPABASE_URL harus berupa alamat lengkap").optional(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
    SUPABASE_STORAGE_BUCKET: z.string().min(1).max(100).default("nextkarya-media"),
    SUPABASE_STORAGE_PUBLIC_URL: z
      .string()
      .url("SUPABASE_STORAGE_PUBLIC_URL harus berupa alamat lengkap")
      .optional(),
    SUPABASE_SIGNED_UPLOAD_TTL_SECONDS: z.coerce
      .number()
      .int()
      .min(60)
      .max(3600)
      .default(900),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER !== "supabase") return;

    if (!value.SUPABASE_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_URL"],
        message: "SUPABASE_URL wajib diisi saat STORAGE_DRIVER=supabase",
      });
    }
    if (!value.SUPABASE_SERVICE_ROLE_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["SUPABASE_SERVICE_ROLE_KEY"],
        message: "SUPABASE_SERVICE_ROLE_KEY wajib diisi saat STORAGE_DRIVER=supabase",
      });
    }

    if (value.SUPABASE_STORAGE_PUBLIC_URL) {
      try {
        const publicUrl = new URL(value.SUPABASE_STORAGE_PUBLIC_URL);
        const isSupabaseHost = publicUrl.hostname.endsWith(".supabase.co");
        const isS3Endpoint = publicUrl.hostname.endsWith(".storage.supabase.co");
        const isPublicObjectPath = publicUrl.pathname.includes(
          "/storage/v1/object/public/"
        );

        if (isS3Endpoint || (isSupabaseHost && !isPublicObjectPath)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["SUPABASE_STORAGE_PUBLIC_URL"],
            message:
              "Gunakan URL public object Supabase, misalnya https://<PROJECT_REF>.supabase.co/storage/v1/object/public/<BUCKET>. Jangan pakai endpoint S3.",
          });
        }
      } catch {
        // Malformed URLs are already reported by the `.url()` check above.
      }
    }
  });

/**
 * Runtime environment configuration schema with strict validation rules and type inference.
 */
export type EnvConfig = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.format());
  process.exit(1);
}

/**
 * Validated, immutable environment configuration singleton.
 */
export const env: EnvConfig = parsed.data;
