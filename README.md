# TI Article Builder

Automated financial article generation and multi-site WordPress publishing pipeline, built with Next.js and deployed on Vercel.

## Architecture

- **Trigger**: Vercel Cron (daily at 06:00 UTC) or manual via admin dashboard
- **Data**: Supabase (rss_feed, ai_articles, sites, workflow tracking)
- **AI**: Anthropic Claude (article writing), OpenAI GPT-4o (image selection, SEO, image editing)
- **Images**: Google CSE image search, OpenAI image editing, Sharp resize/WebP
- **Publishing**: WordPress REST API (multi-site via `sites` table)

## Pipeline Flow

1. Fetch trending headlines from StockNewsAPI
2. Upsert each headline into `rss_feed` (skip duplicates)
3. Search references via Jina AI
4. Generate article HTML with Anthropic Claude
5. Extract category, tags, and headline metadata
6. Select/edit featured image via OpenAI (90s timeout, 200s budget cap)
7. Resize to 900x600 WebP (graceful degradation: publishes without image on failure)
8. Generate per-site SEO (metatitle, metadescription) via OpenAI
9. Publish as draft to each WordPress site (idempotency guard: skips if title exists)
10. Save article record to `ai_articles` (idempotency: rss_feed_id + site_id check)

## Setup

```bash
cp .env.example .env.local
# Fill in all required API keys and credentials (including ADMIN_PASSWORD for /runs)
npm install
npm run dev
```

## Database

Run the migration in `supabase/migrations/001_workflow_tables.sql` against your Supabase project. The existing `rss_feed`, `ai_articles`, and `sites` tables are expected to already exist.

## Deployment

Deploy to Vercel. The cron schedule is configured in `vercel.json`.

## API Endpoints

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/api/pipeline/run` | POST | Bearer PIPELINE_SECRET | Manual trigger |
| `/api/pipeline/cron` | GET | Bearer CRON_SECRET | Vercel cron trigger |
| `/api/pipeline/status` | GET | Bearer PIPELINE_SECRET | Run history + details |
| `/api/pipeline/retry` | POST | Bearer PIPELINE_SECRET | Start a new full pipeline run (same as manual trigger) |

## Error Handling

Errors are categorized into 5 types: `API_TIMEOUT`, `RATE_LIMIT`, `NETWORK`, `MALFORMED_RESPONSE`, `UNKNOWN`. Retries are automatic for retryable categories (timeouts, rate limits, network errors). Non-retryable errors fail immediately.

## Admin Dashboard

Visit `/runs` to access the dashboard. Two modes:
- **Active**: live pipeline stage track, terminal logs with step durations, smart auto-scroll
- **Idle**: last run summary, run history with expandable steps, sparkline visualization

Three tabs: Dashboard, Articles, Settings. Run confirmation dialog protects against accidental pipeline triggers.

Requires `ADMIN_PASSWORD` in `.env.local`; you will be prompted to sign in.

## Testing

```bash
npx vitest run
```

17 tests across error categorization (8), retry utility (5), and WordPress publishing (4).
