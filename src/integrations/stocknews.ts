import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

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

export async function fetchTrendingHeadlines(
  items = 6,
  date: string = "today"
): Promise<StockNewsHeadline[]> {
  const params = new URLSearchParams({
    token: env().STOCKNEWS_API_TOKEN,
    date,
    items: String(items),
  });

  const requestUrl = `https://stocknewsapi.com/api/v1/trending-headlines?${params}`;
  const res = await fetch(requestUrl, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) throw new Error(`StockNews trending failed: ${res.status}`);
  const bodyText = await res.text();

  let json: TrendingResponse;
  try {
    json = JSON.parse(bodyText) as TrendingResponse;
  } catch {
    logger.error("StockNews trending returned invalid JSON", {
      requested: items,
      date,
      status: res.status,
      bodyPreview: bodyText.slice(0, 500),
    });
    throw new Error("StockNews trending returned invalid JSON");
  }

  const data = json.data ?? [];
  logger.info("StockNews trending-headlines", {
    requested: items,
    returned: data.length,
    date,
    mismatch: data.length !== items,
  });

  if (data.length === 0) {
    logger.warn("StockNews trending-headlines returned zero items", {
      requested: items,
      date,
      status: res.status,
      responseKeys: Object.keys(json ?? {}),
      request: {
        pathname: "/api/v1/trending-headlines",
        items,
        date,
      },
      bodyPreview: bodyText.slice(0, 500),
    });
  }

  return data;
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
