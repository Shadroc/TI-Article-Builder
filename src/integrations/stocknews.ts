import { env } from "@/lib/env";

export interface StockNewsHeadline {
  news_id: string;
  title: string;
  news_url: string;
  image_url: string;
  text: string;
  date: string;
  source_name: string;
  tickers?: string[];
}

interface TrendingResponse {
  data: StockNewsHeadline[];
}

interface ArticleExcerptResponse {
  data: StockNewsHeadline[];
}

export async function fetchTrendingHeadlines(items = 6): Promise<StockNewsHeadline[]> {
  const params = new URLSearchParams({
    token: env().STOCKNEWS_API_TOKEN,
    date: "today",
    items: String(items),
  });

  const res = await fetch(`https://stocknewsapi.com/api/v1/trending-headlines?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`StockNews trending failed: ${res.status}`);
  const json: TrendingResponse = await res.json();
  return json.data ?? [];
}

export async function fetchArticleExcerpt(newsId: string): Promise<StockNewsHeadline | null> {
  const params = new URLSearchParams({
    token: env().STOCKNEWS_API_TOKEN,
    news_id: newsId,
    type: "article",
  });

  const res = await fetch(
    `https://stocknewsapi.com/api/v1/category?section=general&items=100&${params}`,
    { signal: AbortSignal.timeout(30_000) }
  );

  if (!res.ok) throw new Error(`StockNews excerpt failed: ${res.status}`);
  const json: ArticleExcerptResponse = await res.json();
  return json.data?.[0] ?? null;
}
