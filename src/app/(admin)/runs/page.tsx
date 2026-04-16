import { createClient } from "@supabase/supabase-js";
import Dashboard from "./Dashboard";
import { PipelineConfig } from "@/integrations/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 800;

async function loadDashboardData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return { runs: [], steps: [], config: null, sites: [], articles: [] };
  }

  const db = createClient(url, key);

  const [runsResult, configResult, sitesResult, articlesResult] = await Promise.all([
    db.from("workflow_runs").select("*").order("started_at", { ascending: false }).limit(20),
    db.from("pipeline_config").select("*").limit(1).single(),
    db.from("sites").select("id, name, slug, category_map").eq("active", true),
    db.from("ai_articles")
      .select("*, rss_feed:rss_feed_id(title, link, pub_date, img_url)")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const runs = (runsResult.data ?? []) as Record<string, unknown>[];
  let steps: Record<string, unknown>[] = [];

  if (runs.length > 0) {
    const runIds = runs.map((run) => run.id as string);

    const { data } = await db
      .from("workflow_steps")
      .select("*")
      .in("run_id", runIds)
      .order("started_at", { ascending: true })
      .order("article_index", { ascending: true });
    steps = (data ?? []) as Record<string, unknown>[];
  }

  return {
    runs,
    steps,
    config: (configResult.data ?? null) as PipelineConfig | null,
    sites: (sitesResult.data ?? []) as { id: string; name: string; slug: string; category_map?: Record<string, { id: number; color: string }> | null }[],
    articles: (articlesResult.data ?? []) as Record<string, unknown>[],
  };
}

export default async function RunsPage() {
  const data = await loadDashboardData();

  return (
    <Dashboard
      initialRuns={data.runs}
      initialSteps={data.steps}
      initialConfig={data.config}
      initialSites={data.sites}
      initialArticles={data.articles}
    />
  );
}
