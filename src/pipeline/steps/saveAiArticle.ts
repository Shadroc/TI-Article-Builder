import { supabase, AiArticleRow } from "@/integrations/supabase";
import { PublishResult } from "./publishWordpress";

export async function saveAiArticle(
  rssFeedId: string,
  metatitle: string,
  articleHtml: string,
  siteId: string,
  wpResult?: PublishResult,
  imageSource?: string,
  sourceImageUrl?: string
): Promise<AiArticleRow> {
  const row: Omit<AiArticleRow, "id" | "created_at"> = {
    rss_feed_id: rssFeedId,
    title: metatitle,
    content: articleHtml,
    site_id: siteId,
    wp_post_id: wpResult?.postId,
    wp_media_id: wpResult?.mediaId,
    wp_image_url: wpResult?.imageUrl,
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
