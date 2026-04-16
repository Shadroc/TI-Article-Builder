---
title: Record AI run costs in workflow steps and aggregate them in the runs dashboard
date: 2026-04-15
category: docs/solutions/best-practices
module: pipeline cost observability
problem_type: best_practice
component: tooling
severity: medium
applies_when:
  - You need per-run or per-article AI cost visibility across Anthropic and OpenAI calls
  - Workflow steps can retry, partially fail, or succeed after fallback behavior
  - Operators need cost visibility directly in the admin runs dashboard
tags: [ai-costs, workflow-steps, dashboard, openai, anthropic, retries, seo, images]
---

# Record AI run costs in workflow steps and aggregate them in the runs dashboard

## Context
This pipeline makes several paid model calls per article: Anthropic article generation, Anthropic per-site rewrites for SEO-safe publication, OpenAI SEO generation, OpenAI image selection, and OpenAI image editing. Without recording those costs at the workflow-step level, the admin UI can show run status and timing but not what actually drove spend.

The main trap is that the most expensive runs are often noisy runs. Retries, partial site failures, and snapshot model names can all make a naive cost report undercount the real bill.

## Guidance
Persist estimated provider cost on each `workflow_steps.step_metadata` record, then compute run totals by summing the step values in the UI.

The pattern that held up here has three parts:

1. Normalize provider model names before price lookup.
   OpenAI often returns snapshot IDs like `gpt-4o-2024-08-06`, not just the alias you requested. Cost lookup should resolve canonical pricing keys by prefix rather than exact string match.

2. Treat retries as additive spend, not replacement spend.
   If `generate_article` or `process_image` fails after tokens were already consumed, the next successful attempt does not erase that earlier cost. Aggregate known `costs` from failed attempts and include them in the final persisted step metadata.

3. Preserve partial costs on failure paths.
   `seo_per_site` can spend money on some sites before another site fails. Use `Promise.allSettled()` for the SEO stage, attach partial `costs` and `costs_by_site` to the thrown error, and persist those values on the failed step.

The implementation points in this repo are:

- Pricing normalization and run-cost helpers in [src/app/(admin)/runs/runMetrics.ts](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/app/(admin)/runs/runMetrics.ts:1) and [src/lib/costs.ts](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/lib/costs.ts:73)
- Retry and partial-failure aggregation in [src/pipeline/orchestrator.ts](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/pipeline/orchestrator.ts:105)
- Per-site SEO partial-cost capture in [src/pipeline/steps/perSiteSeoAndRouting.ts](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/pipeline/steps/perSiteSeoAndRouting.ts:67)
- Dashboard surfaces in [src/app/(admin)/runs/LastRunSummary.tsx](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/app/(admin)/runs/LastRunSummary.tsx:34), [src/app/(admin)/runs/RunHistoryView.tsx](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/app/(admin)/runs/RunHistoryView.tsx:23), and [src/app/(admin)/runs/[runId]/page.tsx](/Users/adamkambeitz/conductor/workspaces/TI-Article Builder/melbourne/src/app/(admin)/runs/[runId]/page.tsx:63)

## Why This Matters
If the pipeline only records the final successful attempt, the dashboard will report the cheapest version of the run instead of the run you actually paid for. That hides the real sources of spend precisely when operators are trying to debug expensive days.

Storing the cost on `workflow_steps` instead of trying to backfill it later also keeps the accounting aligned with the actual pipeline structure. The run dashboard, run detail page, and future per-article reporting can all reuse the same persisted step metadata instead of rebuilding costs from provider-specific logs.

## When to Apply
- When a workflow mixes multiple paid providers or multiple model families
- When a step may retry after provider usage has already been incurred
- When one branch of work can partially succeed before another branch fails
- When operators need immediate spend visibility without leaving the app

## Examples
Before this pattern:

```ts
const seoResults = await Promise.all(
  sites.map((site) => rewriteSeoForSiteWithUsage(...))
);
```

If one site failed, the step threw and the already-incurred costs from the other sites were lost.

After this pattern:

```ts
const seoResults = await Promise.allSettled(
  sites.map((site) => rewriteSeoForSiteWithUsage(...))
);

const partialCostsBySite = seoResults.flatMap((result, index) => {
  if (result.status !== "fulfilled") return [];
  const costs = result.value.cost ? [result.value.cost] : [];
  return [siteCostsEntry(sites[index], costs)];
});
```

That makes it possible to persist partial `estimated_cost_usd` and `costs_by_site` even when the overall `seo_per_site` step fails.

Before this pattern, retrying article generation or image processing only showed the last attempt's cost in the UI. After this pattern, the orchestrator appends failed-attempt `costs` to the final successful step metadata before the dashboard sums the run.

## Related
- Related docs: none found in `docs/solutions/`
- Related GitHub issues: no matching issues found via `gh issue list`
