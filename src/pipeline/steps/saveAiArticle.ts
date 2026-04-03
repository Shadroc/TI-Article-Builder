import { supabase, AiArticleRow } from "@/integrations/supabase";
import { PublishResult } from "./publishWordpress";
import { logger } from "@/lib/logger";

function compareAiArticles(a: AiArticleRow, b: AiArticleRow): number {
  const aHasPost = a.wp_post_id != null ? 1 : 0;
  const bHasPost = b.wp_post_id != null ? 1 : 0;
  if (aHasPost !== bHasPost) return bHasPost - aHasPost;

  const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
  const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
  if (aCreated !== bCreated) return bCreated - aCreated;

  return (b.id ?? "").localeCompare(a.id ?? "");
}

function pickCanonicalAiArticle(
  rows: AiArticleRow[],
  context: { rssFeedId: string; siteId: string }
): AiArticleRow | undefined {
  if (rows.length === 0) return undefined;
  const sorted = [...rows].sort(compareAiArticles);
  const canonical = sorted[0];

  if (sorted.length > 1) {
    logger.warn("Duplicate AI article rows found for feed+site; using canonical row", {
      rssFeedId: context.rssFeedId,
      siteId: context.siteId,
      duplicateCount: sorted.length,
      canonicalId: canonical?.id,
      canonicalWpPostId: canonical?.wp_post_id ?? null,
      duplicateIds: sorted.map((row) => row.id ?? "unknown"),
    });
  }

  return canonical;
}

export async function listAiArticlesByFeedAndSites(
  rssFeedId: string,
  siteIds: string[]
): Promise<Record<string, AiArticleRow>> {
  if (siteIds.length === 0) return {};

  const { data, error } = await supabase()
    .from("ai_articles")
    .select("*")
    .eq("rss_feed_id", rssFeedId)
    .in("site_id", siteIds);

  if (error) throw new Error(`Failed to load existing AI articles: ${error.message}`);

  const rows = (data ?? []) as AiArticleRow[];
  const grouped = new Map<string, AiArticleRow[]>();

  for (const row of rows) {
    const siteRows = grouped.get(row.site_id) ?? [];
    siteRows.push(row);
    grouped.set(row.site_id, siteRows);
  }

  return Object.fromEntries(
    Array.from(grouped.entries()).map(([siteId, siteRows]) => [
      siteId,
      pickCanonicalAiArticle(siteRows, { rssFeedId, siteId }),
    ])
  );
}

export async function saveAiArticle(
  rssFeedId: string,
  metatitle: string,
  articleHtml: string,
  siteId: string,
  wpResult?: PublishResult,
  imageSource?: string,
  sourceImageUrl?: string
): Promise<AiArticleRow> {
  // Build the row, omitting null media fields so upsert preserves existing DB values
  // (a failed image upload shouldn't erase a previous success).
  const row: Record<string, unknown> = {
    rss_feed_id: rssFeedId,
    title: metatitle,
    content: articleHtml,
    site_id: siteId,
  };
  if (wpResult?.postId != null) row.wp_post_id = wpResult.postId;
  if (wpResult?.mediaId != null) row.wp_media_id = wpResult.mediaId;
  if (wpResult?.imageUrl != null) row.wp_image_url = wpResult.imageUrl;
  if (imageSource != null) row.image_source = imageSource;
  if (sourceImageUrl != null) row.source_image_url = sourceImageUrl;

  // Atomic upsert — the unique index on (rss_feed_id, site_id) prevents race-condition duplicates.
  // Omitted columns are preserved on conflict (existing DB values stay intact).
  const { data, error } = await supabase()
    .from("ai_articles")
    .upsert(row, { onConflict: "rss_feed_id,site_id" })
    .select()
    .single();

  if (error) throw new Error(`Failed to upsert AI article: ${error.message}`);

  logger.info("AI article upserted for feed+site", {
    rssFeedId,
    siteId,
    articleId: (data as AiArticleRow).id,
  });
  return data as AiArticleRow;
}
