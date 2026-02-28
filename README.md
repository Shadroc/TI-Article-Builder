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
6. Select/edit featured image via OpenAI
7. Resize to 900x600 WebP
8. Generate per-site SEO (metatitle, metadescription) via OpenAI
9. Publish as draft to each WordPress site
10. Save article record to `ai_articles`

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
| `/api/pipeline/retry` | POST | Bearer PIPELINE_SECRET | Retry a failed run |

## Admin Dashboard

Visit `/runs` to see pipeline run history, trigger new runs, and inspect per-step logs.
Requires `ADMIN_PASSWORD` in `.env.local`; you will be prompted to sign in.
