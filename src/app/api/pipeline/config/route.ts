import { NextRequest, NextResponse } from "next/server";
import { supabase, PipelineConfig } from "@/integrations/supabase";
import { env } from "@/lib/env";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env().PIPELINE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase()
    .from("pipeline_config")
    .select("*")
    .limit(1)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data as PipelineConfig });
}

export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${env().PIPELINE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const updates: Partial<PipelineConfig> & { updated_at: string } = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.headlines_to_fetch === "number") {
    updates.headlines_to_fetch = Math.min(Math.max(body.headlines_to_fetch, 1), 20);
  }
  if (body.publish_status === "draft" || body.publish_status === "publish") {
    updates.publish_status = body.publish_status;
  }
  if (Array.isArray(body.target_sites)) {
    updates.target_sites = body.target_sites;
  }
  if (typeof body.writer_model === "string") {
    updates.writer_model = body.writer_model;
  }
  if (typeof body.image_model === "string") {
    updates.image_model = body.image_model;
  }

  const { data: existing } = await supabase()
    .from("pipeline_config")
    .select("id")
    .limit(1)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "No config row found" }, { status: 500 });
  }

  const { data, error } = await supabase()
    .from("pipeline_config")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ config: data as PipelineConfig });
}
