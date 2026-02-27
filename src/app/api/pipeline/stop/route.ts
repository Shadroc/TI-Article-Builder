import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/integrations/supabase";
import { env } from "@/lib/env";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env().PIPELINE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let runId: string | undefined;
  try {
    const body = await request.json();
    runId = body.runId;
  } catch {
    // try to find latest running
  }

  const db = supabase();

  if (!runId) {
    const { data } = await db
      .from("workflow_runs")
      .select("id")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      return NextResponse.json({ error: "No running pipeline found" }, { status: 404 });
    }
    runId = data.id;
  }

  await db
    .from("workflow_runs")
    .update({ cancel_requested_at: new Date().toISOString() })
    .eq("id", runId)
    .eq("status", "running");

  return NextResponse.json({ runId, message: "Cancel requested" });
}
