import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z
    .string()
    .min(1)
    .refine((v) => v.startsWith("sb_secret_"), "SUPABASE_SECRET_KEY must be a secret key (sb_secret_...)"),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  STOCKNEWS_API_TOKEN: z.string().min(1),
  GOOGLE_CSE_API_KEY: z.string().min(1),
  GOOGLE_CSE_CX: z.string().min(1),
  JINA_API_KEY: z.string().min(1),
  WORDPRESS_SITES: z
    .string()
    .min(1)
    .refine((v) => {
      try {
        const parsed = JSON.parse(v);
        return (
          Array.isArray(parsed) &&
          parsed.every(
            (s) =>
              typeof s.slug === "string" &&
              typeof s.username === "string" &&
              typeof s.appPassword === "string"
          )
        );
      } catch {
        return false;
      }
    }, "WORDPRESS_SITES must be a valid JSON array of { slug, username, appPassword }"),
  PIPELINE_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
  CRON_MAX_ARTICLES: z.coerce.number().int().min(1).max(20).optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  GEMINI_API_KEY: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;

export function env(): Env {
  if (!_env) {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const missing = result.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Missing or invalid env vars: ${missing}`);
    }
    _env = result.data;
  }
  return _env;
}

/** WordPress credentials by slug (URL comes from sites.wp_base_url in Supabase) */
export interface WordPressCredential {
  slug: string;
  username: string;
  appPassword: string;
}

export function getWordPressCredentials(): WordPressCredential[] {
  try {
    return JSON.parse(env().WORDPRESS_SITES) as WordPressCredential[];
  } catch {
    throw new Error("WORDPRESS_SITES contains invalid JSON — check the env var format");
  }
}
