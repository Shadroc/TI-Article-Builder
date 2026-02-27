import { supabase, RssFeedRow } from "@/integrations/supabase";
import { HeadlineItem } from "./fetchHeadlines";

export interface UpsertResult {
  row: RssFeedRow;
  alreadyExisted: boolean;
}

export async function upsertRssFeedItem(item: HeadlineItem): Promise<UpsertResult> {
  const db = supabase();

  // Check for existing by link (idempotent — no unique on link in Automated News TLDR)
  const { data: existing } = await db
    .from("rss_feed")
    .select("*")
    .eq("link", item.news_url)
    .maybeSingle();

  if (existing) {
    await db
      .from("rss_feed")
      .update({ should_draft_article: true })
      .eq("id", existing.id);
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
