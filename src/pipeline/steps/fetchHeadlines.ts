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
  const expanded = await Promise.all(
    headlines.map((h) =>
      fetchArticleExcerpt(h.news_id).catch((err) => {
        console.error(`Failed to expand headline ${h.news_id}:`, err);
        return null;
      })
    )
  );

  return headlines.map((headline, i) => {
    const source = expanded[i] ?? headline;
    return {
      news_id: headline.news_id,
      title: source.title,
      news_url: source.news_url ?? headline.news_url,
      image_url: source.image_url ?? headline.image_url,
      text: source.text ?? headline.text,
      date: source.date ?? headline.date,
    };
  });
}
