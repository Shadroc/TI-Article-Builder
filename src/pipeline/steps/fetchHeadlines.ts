import {
  fetchTrendingHeadlines,
  fetchArticleExcerpt,
  StockNewsHeadline,
} from "@/integrations/stocknews";
import { logger } from "@/lib/logger";

export interface HeadlineItem {
  news_id: string;
  title: string;
  news_url: string;
  image_url: string;
  text: string;
  date: string;
}

export async function fetchAndExpandHeadlines(
  count = 6,
  date: string = "today"
): Promise<HeadlineItem[]> {
  logger.info("fetchAndExpandHeadlines: requesting headlines", {
    requestedCount: count,
    date,
  });
  const headlines = await fetchTrendingHeadlines(count, date);
  logger.info("fetchAndExpandHeadlines: raw headlines received", {
    requestedCount: count,
    receivedCount: headlines.length,
  });
  const results: HeadlineItem[] = [];

  for (const headline of headlines) {
    let expanded: StockNewsHeadline | null = null;
    try {
      expanded = await fetchArticleExcerpt(headline.news_id);
    } catch (err) {
      console.error(`Failed to expand headline ${headline.news_id}:`, err);
    }

    const source = expanded ?? headline;
    results.push({
      news_id: headline.news_id,
      title: source.title,
      news_url: source.news_url ?? headline.news_url,
      image_url: source.image_url ?? headline.image_url,
      text: source.text ?? headline.text,
      date: source.date ?? headline.date,
    });
  }

  return results;
}
