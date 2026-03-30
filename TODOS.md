# TODOS

## P1 — High Priority

### Provision NanoBanana/Gemini API Key
**What:** Get a Gemini API key, add `GEMINI_API_KEY` to Vercel env vars, add optional Zod validation in `env.ts`.
**Why:** The NanoBanana image fallback code won't activate without the key — it silently skips to raw resize.
**Effort:** S (manual task, ~15min)
**Depends on:** NanoBanana integration code being written first.
**Source:** CEO Review 2026-03-24

### Concurrent Run Protection
**What:** Add a Supabase-based run lock — check for active `workflow_runs` with `status='running'` before starting a new run. Reject with a clear error if one exists.
**Why:** Cron + manual trigger overlap could process/publish the same article simultaneously. Gets more likely as retry chains extend execution time. Codex outside voice flagged this as cannot-defer — duplicate publishing is the default failure mode once runs slow down. The publish idempotency guard (in current PR scope) provides a safety net, but wasted compute remains.
**Effort:** S (human: ~1h / CC: ~5min)
**Depends on:** Nothing — can be built independently.
**Source:** CEO Review outside voice 2026-03-24, promoted to P1 by Eng Review 2026-03-24

### Circuit Breaker for OpenAI Image API
**What:** Track consecutive OpenAI image failures across runs (Supabase counter or in-memory). After 3 consecutive failures, skip directly to NanoBanana/raw-resize for 5 minutes before retrying OpenAI.
**Why:** Prevents wasting 270s of the 800s Vercel budget on a known-down provider per article.
**Effort:** S (human: ~2h / CC: ~10min)
**Depends on:** Error categorization (accepted scope item #10).
**Source:** CEO Review outside voice 2026-03-24

## P2 — Medium Priority

### Per-Article Retry Button
**What:** Add a retry button per article in the dashboard that re-runs from the failed step (image processing or publish), reattaching to the existing workflow run.
**Why:** When the image fallback chain fails completely, the only option is rerunning the entire pipeline from scratch (~5-10 min wasted).
**Effort:** M (human: ~4h / CC: ~15min) — needs state management for partial re-execution.
**Depends on:** Step-level status tracking (already exists in `workflow_steps`).
**Source:** CEO Review 2026-03-24 (deferred from accepted scope)

### Wire Runtime Config to Pipeline
**What:** Connect dashboard ConfigurationTab settings (target_sites, model selection, post status) to actual pipeline execution. Currently the UI exposes controls the pipeline ignores — models are hard-coded, target_sites is unused, post status is always "draft".
**Why:** Dashboard gives a false sense of configurability, which erodes trust in the tool.
**Effort:** M (human: ~4h / CC: ~15min)
**Depends on:** Nothing — can be built independently.
**Source:** Eng Review outside voice (Codex) 2026-03-24
