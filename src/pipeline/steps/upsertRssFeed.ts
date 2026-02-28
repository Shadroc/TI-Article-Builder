import { supabase, RssFeedRow } from "@/integrations/supabase";
import { HeadlineItem } from "./fetchHeadlines";

export interface UpsertResult {
  row: RssFeedRow;
  alreadyExisted: boolean;
}

export async function upsertRssFeedItem(item: HeadlineItem): Promise<UpsertResult> {
  const db = supabase();

  // Deterministic lookup by link; avoids maybeSingle() failure when historical duplicates exist.
  const { data: existingRows, error: existingError } = await db
    .from("rss_feed")
    .select("*")
    .eq("link", item.news_url)
    .order("id", { ascending: true })
    .limit(1);

  if (existingError) {
    throw new Error(`Failed to query existing RSS feed item: ${existingError.message}`);
  }

  const existing = existingRows?.[0];

  if (existing) {
    const { error: updateError } = await db
      .from("rss_feed")
      .update({ should_draft_article: true })
      .eq("id", existing.id);

    if (updateError) {
      throw new Error(`Failed to update existing RSS feed item: ${updateError.message}`);
    }

    return { row: existing as RssFeedRow, alreadyExisted: true };
  }

  const { data: inserted, error } = await db
    .from("rss_feed")
    .insert({
      title: item.title,
      link: item.news_url,
      pub_date: item.date,
      content: item.text,
      img_url: item.image_url,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to insert RSS feed item: ${error.message}`);
  return { row: inserted as RssFeedRow, alreadyExisted: false };
}
