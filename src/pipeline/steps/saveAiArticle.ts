import { supabase, AiArticleRow } from "@/integrations/supabase";
import { PublishResult } from "./publishWordpress";
import { logger } from "@/lib/logger";

export async function saveAiArticle(
  rssFeedId: string,
  metatitle: string,
  articleHtml: string,
  siteId: string,
  wpResult?: PublishResult,
  imageSource?: string,
  sourceImageUrl?: string
): Promise<AiArticleRow> {
  // Idempotency: check if we already saved an article for this rss_feed_id + site_id
  const { data: existing } = await supabase()
    .from("ai_articles")
    .select("*")
    .eq("rss_feed_id", rssFeedId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (existing) {
    logger.info("AI article already exists for this feed+site, skipping insert", {
      rssFeedId, siteId, existingId: existing.id,
    });
    return existing as AiArticleRow;
  }

  const row: Omit<AiArticleRow, "id" | "created_at"> = {
    rss_feed_id: rssFeedId,
    title: metatitle,
    content: articleHtml,
    site_id: siteId,
    wp_post_id: wpResult?.postId,
    wp_media_id: wpResult?.mediaId ?? undefined,
    wp_image_url: wpResult?.imageUrl ?? undefined,
    image_source: imageSource,
    source_image_url: sourceImageUrl,
  };

  const { data, error } = await supabase()
    .from("ai_articles")
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`Failed to save AI article: ${error.message}`);
  return data as AiArticleRow;
}
