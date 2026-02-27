import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  STOCKNEWS_API_TOKEN: z.string().min(1),
  GOOGLE_CSE_API_KEY: z.string().min(1),
  GOOGLE_CSE_CX: z.string().min(1),
  JINA_API_KEY: z.string().min(1),
  WORDPRESS_SITES: z.string().min(1),
  PIPELINE_SECRET: z.string().min(1),
  CRON_SECRET: z.string().min(1),
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
  return JSON.parse(env().WORDPRESS_SITES) as WordPressCredential[];
}
