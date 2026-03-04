"use server";

import { after } from "next/server";
import { runPipeline } from "@/pipeline/orchestrator";
import { supabase, PipelineConfig, EditorPrompts, CategoryMap, PivotCatalogs } from "@/integrations/supabase";

export async function triggerPipelineRun() {
  const db = supabase();
  const { data: config } = await db
    .from("pipeline_config")
    .select("headlines_to_fetch, headlines_date")
    .limit(1)
    .single();

  const articleCount = Math.min(config?.headlines_to_fetch ?? 6, 20);
  const headlinesDate = config?.headlines_date ?? "today";

  after(() =>
    runPipeline({ trigger: "manual", articleCount, headlinesDate }).catch((err) => {
      console.error("Pipeline run failed:", err);
    })
  );

  await new Promise((r) => setTimeout(r, 500));

  return { started: true };
}

export async function triggerTestRun() {
  after(() =>
    runPipeline({ trigger: "manual", articleCount: 1 }).catch((err) => {
      console.error("Test run failed:", err);
    })
  );

  await new Promise((r) => setTimeout(r, 500));

  return { started: true };
}

export async function stopPipelineRun(runId?: string) {
  const db = supabase();

  if (!runId) {
    const { data } = await db
      .from("workflow_runs")
      .select("id")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) return { error: "No running pipeline found" };
    runId = data.id;
  }

  const now = new Date().toISOString();
  const { data, error } = await db
    .from("workflow_runs")
    .update({
      cancel_requested_at: now,
      status: "cancelled",
      finished_at: now,
      error: "Cancelled by user",
    })
    .eq("id", runId)
    .eq("status", "running")
    .select("id");

  if (error) return { error: error.message };
  if (!data?.length) return { error: "Run not found or already finished" };

  return { runId, message: "Cancelled" };
}

export async function fetchDashboardData() {
  const db = supabase();

  const [runsResult, configResult, sitesResult] = await Promise.all([
    db.from("workflow_runs").select("*").order("started_at", { ascending: false }).limit(20),
    db.from("pipeline_config").select("*").limit(1).single(),
    db.from("sites").select("*").eq("active", true),
  ]);

  const runs = runsResult.data ?? [];
  let latestSteps: Record<string, unknown>[] = [];

  if (runs.length > 0) {
    // Include steps from multiple runs to persist logs over the day
    // Use runs from the last 24 hours (or last 10 runs as fallback)
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    const cutoffIso = cutoff.toISOString();
    const recentRunIds = (runs as { id: string; started_at?: string }[])
      .filter((r) => (r.started_at ?? "") >= cutoffIso)
      .map((r) => r.id)
      .slice(0, 10); // cap at 10 runs max

    const runIds = recentRunIds.length > 0 ? recentRunIds : [runs[0].id as string];

    const { data: steps } = await db
      .from("workflow_steps")
      .select("*")
      .in("run_id", runIds)
      .order("started_at", { ascending: true })
      .order("article_index", { ascending: true });
    latestSteps = (steps ?? []) as Record<string, unknown>[];
  }

  // Fetch recent articles for preview
  const { data: articles } = await db
    .from("ai_articles")
    .select("*, rss_feed:rss_feed_id(title, link, pub_date, img_url)")
    .order("created_at", { ascending: false })
    .limit(20);

  return {
    runs: runs as Record<string, unknown>[],
    latestSteps,
    config: (configResult.data ?? null) as PipelineConfig | null,
    sites: (sitesResult.data ?? []) as { id: string; name: string; slug: string; category_map?: Record<string, { id: number; color: string }> | null }[],
    articles: (articles ?? []) as Record<string, unknown>[],
  };
}

export async function updatePipelineConfig(updates: Partial<PipelineConfig>) {
  const db = supabase();

  const { data: existing } = await db
    .from("pipeline_config")
    .select("id")
    .limit(1)
    .single();

  if (!existing) return { error: "No config row" };

  const { data, error } = await db
    .from("pipeline_config")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", existing.id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { config: data as PipelineConfig };
}

export async function updateEditorConfig(updates: {
  editor_prompts?: EditorPrompts | null;
  category_map?: CategoryMap | null;
  pivot_catalogs?: PivotCatalogs | null;
}) {
  const db = supabase();

  const { data: existing } = await db
    .from("pipeline_config")
    .select("id")
    .limit(1)
    .single();

  if (!existing) return { error: "No config row" };

  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.editor_prompts !== undefined) payload.editor_prompts = updates.editor_prompts;
  if (updates.category_map !== undefined) payload.category_map = updates.category_map;
  if (updates.pivot_catalogs !== undefined) payload.pivot_catalogs = updates.pivot_catalogs;

  const { data, error } = await db
    .from("pipeline_config")
    .update(payload)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) return { error: error.message };
  return { config: data as PipelineConfig };
}

export async function updateSiteCategoryMap(
  siteId: string,
  categoryMap: Record<string, { id: number; color: string }>
) {
  const db = supabase();
  const { data, error } = await db
    .from("sites")
    .update({ category_map: categoryMap })
    .eq("id", siteId)
    .select()
    .single();

  if (error) return { error: error.message };
  return { site: data };
}
