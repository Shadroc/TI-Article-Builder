---
date: 2026-04-13
topic: open-ideation
---

# Ideation: TI Article Builder

## Codebase Context

- Next.js 16 app with a small admin surface under `src/app/(admin)/runs` and API routes for `run`, `cron`, `retry`, `status`, `stop`, and config.
- Core value lives in `src/pipeline/orchestrator.ts`, which sequences headline fetch, RSS upsert, article generation, image processing, per-site SEO/rewrite, WordPress publish, and article persistence.
- Reliability is handled inline with retries, cancellation polling, per-step workflow logging, and a hardcoded image-processing budget derived from remaining Vercel time.
- Supabase is the system of record for workflow runs, workflow steps, sites, articles, and editor config, but some editorial behavior still falls back to hardcoded defaults in code.
- Tests exist for major steps and a few integration paths, but there is no obvious replay harness, trace viewer, or deterministic dry-run path for debugging bad outputs and partial failures.
- There were no recent ideation docs in `docs/ideation/` and no reusable learnings in `docs/solutions/`.

## Ranked Ideas

### 1. Article Trace Workspace
**Description:** Persist full per-article traces for every pipeline step: prompts, model selections, source inputs, image candidates, chosen outputs, WordPress payloads, timings, and fallback decisions. Expose them inside the existing run detail UI.
**Rationale:** The repo already logs workflow steps, but mostly as summaries. This system is heavily LLM- and provider-driven, so quality debugging and incident response are limited without first-class traces.
**Downsides:** Requires secret redaction, storage discipline, and UI work to keep traces readable rather than noisy.
**Confidence:** 91%
**Complexity:** Medium
**Status:** Explored

### 2. Pre-Publish Quality Gate
**Description:** Insert a deterministic validation stage before WordPress publish that checks citation completeness, quote grounding, required metadata, HTML structure, category/tags, duplicate paragraphs, and simple market-data sanity signals.
**Rationale:** The prompts demand a lot of structure and factual discipline, but the current flow appears to trust model output until late. A quality gate would catch bad drafts before they become operational cleanup.
**Downsides:** False positives are likely at first, and the rules will need tuning to avoid blocking acceptable drafts.
**Confidence:** 89%
**Complexity:** Medium
**Status:** Unexplored

### 3. Replayable Dry-Run and Staging Publish
**Description:** Add a manual run mode that can replay one article or one whole run from saved inputs with toggles like `no live publish`, `use fixture providers`, `publish to staging site only`, or `rerun this failed article`.
**Rationale:** Current retry starts a new full run, and repo scripts suggest ad hoc staging flows. A proper replay mode would reduce risk when debugging prompts, WordPress behavior, or per-site rewrites.
**Downsides:** Needs stable input snapshots and clear idempotency semantics so "dry run" and "repair run" do not blur together.
**Confidence:** 88%
**Complexity:** High
**Status:** Unexplored

### 4. Publish Reconciliation Queue
**Description:** Model per-site publish outcomes explicitly and surface a repair queue for partial failures: one site failed, image upload failed, draft exists but DB save did not, fallback rewrite was used, or a site needs a targeted retry.
**Rationale:** This is a multi-site publishing system with partial-failure risk at several points. The orchestrator continues on errors, which is good for throughput but weak for operational cleanup without a repair surface.
**Downsides:** Adds state complexity and could duplicate some current workflow logs if not designed carefully.
**Confidence:** 86%
**Complexity:** Medium
**Status:** Unexplored

### 5. Event-Centric Story Selection and Dedup
**Description:** Cluster incoming headlines by underlying company/event before article generation, score them for novelty and investor relevance, and generate one stronger story per event instead of one story per raw headline.
**Rationale:** Financial feeds are repetitive. The current pipeline appears to dedupe at the feed-row level, which does not solve multi-source repetition. Better event selection improves quality and lowers provider spend.
**Downsides:** Clustering and scoring will create edge cases, especially when two similar headlines deserve separate coverage.
**Confidence:** 84%
**Complexity:** High
**Status:** Unexplored

### 6. Versioned Editorial Profiles
**Description:** Turn prompts, category maps, pivot catalogs, and site-specific editorial behavior into versioned profiles with diff, rollback, preview, and run-to-config attribution.
**Rationale:** Editorial configuration is split between Supabase and hardcoded defaults. When quality changes, it will be difficult to answer which config version caused the shift without explicit snapshots and version history.
**Downsides:** Schema and UX changes are required, and the team has to adopt a more disciplined config workflow.
**Confidence:** 82%
**Complexity:** Medium
**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Human approval queue | Plausible, but the repo is currently optimized for automation; this needs a separate product decision first. |
| 2 | Slack or email alerts for failures | Useful, but weaker than fixing traceability and repair flows first. |
| 3 | Self-serve site onboarding wizard | Grounded by the setup scripts, but lower leverage than core reliability and quality improvements. |
| 4 | Fully parallel article processing | Attractive, but likely risky on Vercel time budgets and external API quotas without stronger controls first. |
| 5 | Dynamic category map cleanup only | Too narrow; mostly subsumed by versioned editorial profiles. |
| 6 | Automatic run postmortems | Mostly a presentation layer on top of trace data, so the trace workspace should come first. |
| 7 | Image licensing and compliance scorer | Relevant to Google CSE usage, but secondary to output quality and recovery tooling. |
| 8 | Fine-grained resume-from-checkpoint | Valuable, but more expensive than replay/repair flows for similar operator benefit. |
| 9 | Prompt A/B testing in production | Premature before prompt versioning and run traceability exist. |
| 10 | Evergreen internal-linking engine | Not strongly grounded in the current repo surface or data model. |
| 11 | Article analytics feedback loop | Potentially valuable, but there is no evidence of reader analytics plumbing in this codebase yet. |
| 12 | Auto-generated social posts | Adjacent to publishing, but a weaker strategic move than making the article pipeline trustworthy first. |

## Session Log

- 2026-04-13: Initial ideation - 18 candidates generated, 6 survived
- 2026-04-13: Brainstorm started for Article Trace Workspace, with focus on daily run cost optimization
