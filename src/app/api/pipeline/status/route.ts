import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/integrations/supabase";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env().PIPELINE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const runId = searchParams.get("runId");
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 100);
  const withSteps = searchParams.get("withSteps") === "true";

  const db = supabase();

  if (runId) {
    const [runResult, stepsResult] = await Promise.all([
      db.from("workflow_runs").select("*").eq("id", runId).single(),
      db.from("workflow_steps").select("*").eq("run_id", runId).order("article_index").order("started_at"),
    ]);

    if (runResult.error) {
      return NextResponse.json({ error: "Run not found" }, { status: 404 });
    }

    return NextResponse.json({ run: runResult.data, steps: stepsResult.data ?? [] });
  }

  // Dashboard mode: return latest runs + optionally steps for the most recent running one
  const { data: runs, error } = await db
    .from("workflow_runs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let latestSteps: unknown[] = [];
  if (withSteps && runs && runs.length > 0) {
    const latestRun = runs[0];
    const { data: steps } = await db
      .from("workflow_steps")
      .select("*")
      .eq("run_id", latestRun.id)
      .order("article_index")
      .order("started_at");
    latestSteps = steps ?? [];
  }

  return NextResponse.json({ runs, latestSteps });
}
