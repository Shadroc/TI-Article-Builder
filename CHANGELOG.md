# Changelog

All notable changes to this project will be documented in this file.

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
