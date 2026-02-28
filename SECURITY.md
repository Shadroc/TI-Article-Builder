# Security

## 1. Key rotation (manual)

If secrets may have been exposed, rotate them immediately, then update **both** `.env.local` (local dev) and Vercel env vars (production).

### Update Vercel env var after rotation
```bash
printf 'NEW_VALUE' | npx vercel env add VAR_NAME production --scope tyconas-projects --force
# Then redeploy to pick up the change:
npx vercel --prod --scope tyconas-projects --yes
```

### Supabase
- **Project**: [Automated News TLDR](https://supabase.com/dashboard/project/dedjsgmgrnpvclchghcx)
- **Service role key**: Settings → API → Regenerate `service_role` key
- Update `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel

### OpenAI
- [API keys](https://platform.openai.com/api-keys) → Revoke old key, create new
- Update `OPENAI_API_KEY` in `.env.local` and Vercel

### Anthropic
- [Console](https://console.anthropic.com/) → API keys → Rotate
- Update `ANTHROPIC_API_KEY` in `.env.local` and Vercel

### Jina AI
- [Jina dashboard](https://jina.ai/dashboard) → API keys → Regenerate
- Update `JINA_API_KEY` in `.env.local` and Vercel

### StockNewsAPI
- [StockNewsAPI dashboard](https://stocknewsapi.com/dashboard) → Regenerate token
- Update `STOCKNEWS_API_TOKEN` in `.env.local` and Vercel

### Google Custom Search
- [Google Cloud Console](https://console.cloud.google.com/) → APIs → Credentials → Regenerate key
- Update `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX` in `.env.local` and Vercel

### WordPress
- Regenerate app passwords per site in WP Admin → Users → Application Passwords
- Update `WORDPRESS_SITES` JSON in `.env.local` and Vercel

### Admin password
- Generate a new password: `openssl rand -base64 32`
- Update `ADMIN_PASSWORD` in `.env.local` and Vercel
- All existing admin sessions will be immediately invalidated (JWT re-sign required)

### Pipeline / cron secrets
- Generate new values: `openssl rand -hex 32`
- Update `PIPELINE_SECRET` and `CRON_SECRET` in `.env.local` and Vercel

---

## 2. Postgres upgrade

Supabase may advise upgrading Postgres for security patches:

1. Open [Supabase Dashboard](https://supabase.com/dashboard/project/dedjsgmgrnpvclchghcx)
2. **Settings** → **Infrastructure** → **Upgrade**
3. Follow the [Supabase upgrade guide](https://supabase.com/docs/guides/platform/upgrading)

---

## 3. Git history audit

To check if secrets were ever committed:

```bash
# Search for service role key pattern
git log -p -S "service_role" --all -- "*.env*" ".env*"

# Search for JWT-like strings (Supabase tokens)
git log -p -S "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9" --all

# If secrets found in history: rotate ALL affected keys immediately
# Optionally rewrite history with BFG Repo-Cleaner or git filter-repo
```

---

## 4. Implemented security measures

| Measure | Detail |
|---|---|
| **RLS** | Row Level Security enabled on all public Supabase tables; only the service role key (server-side only) can read/write data |
| **Admin auth** | `/runs` protected by JWT cookie signed with `ADMIN_PASSWORD`; missing or short password locks everyone out |
| **API auth** | Pipeline trigger endpoint protected by `PIPELINE_SECRET`; Vercel cron protected by `CRON_SECRET` |
| **Env vars** | All 12 secrets stored in Vercel encrypted env vars (Production); `.env.local` for local dev only |
| **`.env.example`** | Contains placeholder values only; real secrets are never committed |
| **`env.ts`** | Zod schema validates all required env vars at startup; missing vars throw with a clear list of what's absent |
