import { NextRequest, NextResponse } from "next/server";
import { runPipeline } from "@/pipeline/orchestrator";
import { supabase } from "@/integrations/supabase";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
// Pro/Enterprise: up to 800s. Keep cron batches conservative to avoid timeout-driven failures.
export const maxDuration = 800;
const DEFAULT_CRON_MAX_ARTICLES = 5;

export function getCronArticleCount(configuredArticleCount: number): number {
  const cronCap = env().CRON_MAX_ARTICLES ?? DEFAULT_CRON_MAX_ARTICLES;
  return Math.min(configuredArticleCount, cronCap);
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const expectedToken = `Bearer ${env().CRON_SECRET}`;

    if (authHeader !== expectedToken) {
      logger.warn("Cron request unauthorized", {
        hasAuthorizationHeader: Boolean(authHeader),
        authorizationLooksBearer: authHeader?.startsWith("Bearer ") ?? false,
        userAgent: request.headers.get("user-agent") ?? "unknown",
        cronInvocation: request.headers.get("x-vercel-cron") ?? "unknown",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: config, error } = await supabase()
      .from("pipeline_config")
      .select("headlines_to_fetch, headlines_date")
      .limit(1)
      .single();

    if (error) {
      logger.error("Cron failed to load pipeline config", { error: error.message });
      return NextResponse.json({ error: "Failed to load pipeline config" }, { status: 500 });
    }

    const configuredArticleCount = Math.min(config?.headlines_to_fetch ?? 5, 20);
    const articleCount = getCronArticleCount(configuredArticleCount);
    const headlinesDate = config?.headlines_date ?? "today";

    if (articleCount < configuredArticleCount) {
      logger.warn("Cron article count clamped to avoid maxDuration timeout", {
        configuredArticleCount,
        effectiveArticleCount: articleCount,
        cronArticleCap: env().CRON_MAX_ARTICLES ?? DEFAULT_CRON_MAX_ARTICLES,
        maxDuration,
      });
    }

    const startedAt = Date.now();
    const result = await runPipeline({ trigger: "cron", articleCount, headlinesDate });

    logger.info("Cron pipeline finished", {
      runId: result.runId,
      configuredArticleCount,
      effectiveArticleCount: articleCount,
      articlesProcessed: result.articlesProcessed,
      errorCount: result.errors.length,
      durationMs: Date.now() - startedAt,
    });

    return NextResponse.json({
      runId: result.runId,
      articlesProcessed: result.articlesProcessed,
      errors: result.errors,
      configuredArticleCount,
      effectiveArticleCount: articleCount,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Cron pipeline request failed", { error: message });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
