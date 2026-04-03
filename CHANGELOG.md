# Changelog

All notable changes to this project will be documented in this file.

## [0.1.2.0] - 2026-04-03

### Added
- Deadline-based image processing with per-phase timing instrumentation (`deadline.ts`, `ImageTimingsMs`)
- `CRON_MAX_ARTICLES` env var to cap cron batch size and prevent Vercel timeout failures
- Yesterday fallback in `fetchAndExpandHeadlines` when StockNews returns zero items for today
- Invalid JSON detection in StockNews response with structured error logging
- AbortSignal propagation through image pipeline (scrape, download, CSE search, edit, selection)
- WordPress `updatePost()` and `getPostById()` for idempotent post updates
- Atomic upsert in `saveAiArticle` using unique index on (rss_feed_id, site_id)
- Duplicate article deduplication via `pickCanonicalAiArticle` (prefers rows with wp_post_id)
- Migration 010: unique index on ai_articles(rss_feed_id, site_id) with duplicate cleanup
- Test suites for cron route, stocknews, fetchHeadlines, processImage, saveAiArticle

### Changed
- Cron route simplified: removed fragile `isPacificSixAm` time gate, single 13:00 UTC schedule
- WordPress publish flow: update existing posts instead of skipping duplicates, reuse media on replacement posts
- `saveAiArticle` preserves existing media references when new image upload returns null
- Image processing errors now include timing breakdown for debugging slow phases
- Structured logging replaces `console.error` in candidate image downloads

### Fixed
- Cron silently skipping when Vercel fires 1+ second late (60-second window was too narrow)
- Race condition in saveAiArticle: concurrent runs could create duplicate rows
- Failed image upload wiping previously successful media reference from ai_articles

## [0.1.1.0] - 2026-03-31

### Added
- Per-site article body rewriting via Claude Sonnet (`rewriteArticleForSite`) — each WordPress site gets uniquely phrased content for independent Google indexability
- Per-site image filenames — appends site slug to prevent CDN/WordPress media deduplication
- Alt text support in `uploadMedia()` using image `subjectDescription` from AI selection
- Rewrite validation guardrails: HTML structure check, length bounds (50-150%), link preservation, added-link rejection, script/style tag rejection
- `Promise.allSettled` fallback — if a per-site rewrite fails, that site publishes with the original HTML
- Test suite for `rewriteArticleForSite` validation (6 tests)
- Test suite for `generateSeoPerSite` rewrite + fallback behavior (5 tests)

### Fixed
- Null pointer crash in orchestrator when image processing fails and per-site publish runs
- Alt text sanitization — strips HTML tags and caps length before sending to WordPress

## [0.1.0.0] - 2026-03-30

### Added
- Error categorization system (`error-categories.ts`) with 5 categories: API_TIMEOUT, RATE_LIMIT, NETWORK, MALFORMED_RESPONSE, UNKNOWN
- Publish idempotency guard via `postExistsByTitle()` — prevents duplicate WordPress posts
- `saveAiArticle` idempotency check (rss_feed_id + site_id) before insert
- 200s image budget cap in orchestrator with dynamic calculation and graceful degradation
- `step_metadata` JSONB column for structured step data (migration 009)
- GEMINI_API_KEY env var support for future image fallback chain
- Dashboard two-mode layout: active (live pipeline) and idle (history + summary)
- Run sparkline visualization in header
- Last run summary card for idle state
- Run history view with expandable step details
- Settings panel consolidating config, prompts, categories, and pivots tabs
- Design tokens file — single source of truth for colors and category palette
- Smart auto-scroll in terminal log panel (pauses when user scrolls up)
- Step duration display in terminal logs
- Run confirmation dialog before live pipeline execution
- Test suite for retry utility (5 tests)
- Test suite for error categorization (8 tests)

### Changed
- `retry.ts` rewritten: `shouldRetry` defaults to `isRetryable`, structured logging, per-call `timeoutMs` with AbortController
- `publishWordpress.ts` rewritten: accepts `ProcessedImage | null`, skips upload when null, returns `needsImage` flag
- Image edit timeout reduced from 3 minutes to 90 seconds
- Dashboard tabs simplified from 6 to 3 (Dashboard, Articles, Settings)
- Vitest environment changed to `node` globally (jsdom ESM incompatibility)
- Replaced `console.error`/`console.warn` with structured logger in orchestrator

### Fixed
- Timer cleanup in retry.ts — `clearTimeout` in both success and error paths
