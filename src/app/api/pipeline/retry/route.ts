import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/orchestrator";
import { env } from "@/lib/env";
import { supabase } from "@/integrations/supabase";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env().PIPELINE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: config } = await supabase()
    .from("pipeline_config")
    .select("headlines_to_fetch, headlines_date")
    .limit(1)
    .single();

  const articleCount = Math.min(config?.headlines_to_fetch ?? 6, 20);
  const headlinesDate = config?.headlines_date ?? "today";

  const result = await runPipeline({ trigger: "manual", articleCount, headlinesDate });

  return NextResponse.json({
    runId: result.runId,
    articlesProcessed: result.articlesProcessed,
    errors: result.errors,
  });
}
