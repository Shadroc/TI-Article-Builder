import { supabase, WorkflowRun, WorkflowStep } from "@/integrations/supabase";
import { fetchAndExpandHeadlines } from "./steps/fetchHeadlines";
import { upsertRssFeedItem } from "./steps/upsertRssFeed";
import { generateArticle } from "./steps/generateArticle";
import { processArticleImage } from "./steps/processImage";
import { getActiveSites, generateSeoPerSite } from "./steps/perSiteSeoAndRouting";
import { publishToWordPress } from "./steps/publishWordpress";
import { saveAiArticle } from "./steps/saveAiArticle";
import { withRetry } from "@/lib/retry";
import { logger } from "@/lib/logger";
import { categorizeError } from "@/lib/error-categories";
import { ProcessedImage } from "./steps/processImage";

export class CancelledError extends Error {
  constructor() {
    super("Pipeline run was cancelled");
    this.name = "CancelledError";
  }
}

export interface PipelineOptions {
  trigger: "cron" | "manual";
  articleCount?: number;
  /** StockNews date: "today" | "yesterday" | "MMDDYYYY-MMDDYYYY" */
  headlinesDate?: string;
}

async function isCancelled(runId: string): Promise<boolean> {
  try {
    const { data } = await supabase()
      .from("workflow_runs")
      .select("cancel_requested_at")
      .eq("id", runId)
      .single();
    return !!data?.cancel_requested_at;
  } catch {
    // On network errors, assume not cancelled to avoid premature termination
    return false;
  }
}

async function checkpoint(runId: string): Promise<void> {
  if (await isCancelled(runId)) {
    throw new CancelledError();
  }
}

/** Runs op but throws CancelledError if cancel_requested_at is set before it completes. Polls every 500ms. */
async function raceWithCancel<T>(runId: string, op: () => Promise<T>): Promise<T> {
  return Promise.race([
    op(),
    (async (): Promise<never> => {
      while (!(await isCancelled(runId))) {
        await new Promise((r) => setTimeout(r, 500));
      }
      throw new CancelledError();
    })(),
  ]);
}

async function createRun(trigger: "cron" | "manual"): Promise<string> {
  const { data, error } = await supabase()
    .from("workflow_runs")
    .insert({ status: "running", trigger } satisfies Omit<WorkflowRun, "id">)
    .select("id")
    .single();

  if (error) throw new Error(`Failed to create run: ${error.message}`);
  return data.id as string;
}

async function updateRun(
  runId: string,
  update: Partial<WorkflowRun>
): Promise<void> {
  const { error } = await supabase().from("workflow_runs").update(update).eq("id", runId);
  if (error) logger.warn("Failed to update run", { runId, error: error.message });
}

async function logStep(step: Omit<WorkflowStep, "id">): Promise<string> {
  const { data, error } = await supabase()
    .from("workflow_steps")
    .insert(step)
    .select("id")
    .single();

  if (error) {
    logger.warn("Failed to log step", { error: error.message });
    return "";
  }
  return data.id as string;
}

async function updateStep(
  stepId: string,
  update: Partial<WorkflowStep>
): Promise<void> {
  if (!stepId) return;
  await supabase().from("workflow_steps").update(update).eq("id", stepId);
}

export async function runPipeline(options: PipelineOptions): Promise<{
  runId: string;
  articlesProcessed: number;
  errors: string[];
}> {
  const runId = await createRun(options.trigger);
  const errors: string[] = [];
  let articlesProcessed = 0;

  try {
    const fetchStepId = await logStep({
      run_id: runId,
      article_index: -1,
      step_name: "fetch_headlines",
      status: "running",
    });

    await checkpoint(runId);

    const headlinesDate = options.headlinesDate?.trim() || "today";
    const headlines = await raceWithCancel(runId, () =>
      withRetry("fetch_headlines", () =>
        fetchAndExpandHeadlines(options.articleCount ?? 6, headlinesDate)
      )
    );
    await updateStep(fetchStepId, {
      status: "completed",
      output_summary: `Fetched ${headlines.length} headlines`,
      finished_at: new Date().toISOString(),
    });

    logger.info("Headlines fetched", { runId, step: "fetch_headlines", articleCount: headlines.length });

    for (let i = 0; i < headlines.length; i++) {
      await checkpoint(runId);
      const headline = headlines[i];

      try {
        await processOneArticle(runId, i, headline);
        articlesProcessed++;
        logger.info("Article processed", { runId, articleIndex: i, step: "complete" });
      } catch (err) {
        if (err instanceof CancelledError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`Article ${i} (${headline.title}): ${msg}`);
        logger.error("Article failed", { runId, articleIndex: i, error: msg });
      }
    }

    await updateRun(runId, {
      status: errors.length === headlines.length ? "failed" : "completed",
      article_count: articlesProcessed,
      finished_at: new Date().toISOString(),
      error: errors.length > 0 ? errors.join("; ") : undefined,
    });
  } catch (err) {
    if (err instanceof CancelledError) {
      await updateRun(runId, {
        status: "cancelled",
        article_count: articlesProcessed,
        finished_at: new Date().toISOString(),
        error: "Cancelled by user",
      });
      logger.info("Pipeline cancelled", { runId, articlesProcessed });
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      await updateRun(runId, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error: msg,
      });
      errors.push(msg);
    }
  }

  return { runId, articlesProcessed, errors };
}

async function processOneArticle(
  runId: string,
  articleIndex: number,
  headline: { news_id: string; title: string; news_url: string; image_url: string; text: string; date: string }
): Promise<void> {
  const articleStartMs = Date.now();
  await checkpoint(runId);

  const upsertStepId = await logStep({
    run_id: runId,
    article_index: articleIndex,
    step_name: "upsert_rss_feed",
    status: "running",
    input_summary: headline.title,
  });

  const { row: rssItem, alreadyExisted } = await raceWithCancel(runId, () =>
    withRetry("upsert_rss_feed", () => upsertRssFeedItem(headline))
  );

  if (alreadyExisted) {
    await updateStep(upsertStepId, {
      status: "skipped",
      output_summary: "Already exists, marked should_draft_article",
      finished_at: new Date().toISOString(),
    });
    return;
  }

  await updateStep(upsertStepId, {
    status: "completed",
    output_summary: `Created RSS feed item: ${rssItem.id}`,
    finished_at: new Date().toISOString(),
  });

  await checkpoint(runId);

  const articleStepId = await logStep({
    run_id: runId,
    article_index: articleIndex,
    step_name: "generate_article",
    status: "running",
  });

  const article = await raceWithCancel(runId, () =>
    withRetry("generate_article", () => generateArticle(rssItem))
  );
  await updateStep(articleStepId, {
    status: "completed",
    output_summary: `Category: ${article.category}, headline: ${article.headline}`,
    finished_at: new Date().toISOString(),
  });

  await checkpoint(runId);

  const imageStepId = await logStep({
    run_id: runId,
    article_index: articleIndex,
    step_name: "process_image",
    status: "running",
  });

  // 200s image budget cap — dynamic: min(200, 800 - elapsed - 100)
  const elapsedSeconds = (Date.now() - articleStartMs) / 1000;
  const imageBudgetMs = Math.min(200_000, Math.max(30_000, (800 - elapsedSeconds - 100) * 1000));

  let image: ProcessedImage | null = null;
  try {
    image = await raceWithCancel(runId, () =>
      withRetry("process_image", (signal) =>
        processArticleImage(rssItem, article, signal), { maxAttempts: 2, timeoutMs: imageBudgetMs }
      )
    );
  } catch (err) {
    if (err instanceof CancelledError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    const cat = categorizeError(err);
    logger.warn("Image processing failed, continuing without image", {
      runId, articleIndex, error: msg, category: cat.category,
    });
    await updateStep(imageStepId, {
      status: "completed",
      output_summary: `Image skipped: ${msg}`,
      finished_at: new Date().toISOString(),
      step_metadata: { needs_image: true, error_category: cat.category },
    });
  }

  if (image) {
    await updateStep(imageStepId, {
      status: "completed",
      output_summary: `Image: ${image.fileName}`,
      finished_at: new Date().toISOString(),
    });
  }

  await checkpoint(runId);

  const seoStepId = await logStep({
    run_id: runId,
    article_index: articleIndex,
    step_name: "seo_per_site",
    status: "running",
  });

  let siteArticles: Awaited<ReturnType<typeof generateSeoPerSite>>;
  try {
    siteArticles = await raceWithCancel(runId, async () => {
      const sites = await getActiveSites();
      return generateSeoPerSite(article, sites, article.cleanedHtml);
    });
  } catch (err) {
    if (err instanceof CancelledError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    await updateStep(seoStepId, {
      status: "failed",
      error: msg,
      finished_at: new Date().toISOString(),
    });
    throw err;
  }
  await updateStep(seoStepId, {
    status: "completed",
    output_summary: `Generated SEO for ${siteArticles.length} sites`,
    finished_at: new Date().toISOString(),
  });

  await checkpoint(runId);

  const publishStepIds = await Promise.all(
    siteArticles.map((sa) =>
      logStep({
        run_id: runId,
        article_index: articleIndex,
        step_name: `publish_${sa.site.slug}`,
        status: "running",
      })
    )
  );

  const publishResults = await raceWithCancel(runId, () =>
    Promise.allSettled(
      siteArticles.map((siteArticle) => {
        const siteImage = {
          ...image,
          fileName: image.fileName.replace('.webp', `-${siteArticle.site.slug}.webp`),
        };
        return withRetry(`publish_${siteArticle.site.slug}`, () =>
          publishToWordPress(siteArticle, siteArticle.rewrittenHtml, siteImage), { maxAttempts: 2 }
        );
      })
    )
  );

  let firstError: Error | null = null;
  const now = new Date().toISOString();

  for (let i = 0; i < siteArticles.length; i++) {
    const result = publishResults[i];
    const siteArticle = siteArticles[i];
    const stepId = publishStepIds[i];

    if (result.status === "fulfilled") {
      const pubResult = result.value;
      await saveAiArticle(
        rssItem.id,
        siteArticle.metatitle,
        siteArticle.rewrittenHtml,
        siteArticle.site.id,
        pubResult,
        image?.imageSource,
        image?.sourceImageUrl
      );
      const summary = pubResult.needsImage
        ? `Published post ${pubResult.postId} to ${siteArticle.site.slug} (needs_image)`
        : `Published post ${pubResult.postId} to ${siteArticle.site.slug}`;
      await updateStep(stepId, {
        status: "completed",
        output_summary: summary,
        finished_at: now,
      });
    } else {
      if (!firstError) firstError = result.reason instanceof Error ? result.reason : new Error(String(result.reason));
      await updateStep(stepId, {
        status: "failed",
        error: String(result.reason),
        finished_at: now,
      });
    }
  }

  if (firstError) {
    if (firstError instanceof CancelledError) throw firstError;
    throw firstError;
  }
}
