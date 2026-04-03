import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/stocknews", () => ({
  fetchTrendingHeadlines: vi.fn(),
  fetchArticleExcerpt: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { fetchTrendingHeadlines, fetchArticleExcerpt } from "@/integrations/stocknews";
import { logger } from "@/lib/logger";
import { fetchAndExpandHeadlines } from "./fetchHeadlines";

describe("fetchAndExpandHeadlines", () => {
  const fetchTrendingHeadlinesMock = vi.mocked(fetchTrendingHeadlines);
  const fetchArticleExcerptMock = vi.mocked(fetchArticleExcerpt);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to yesterday when today returns no headlines", async () => {
    fetchTrendingHeadlinesMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          news_id: "n1",
          title: "Fallback headline",
          news_url: "https://example.com/story",
          image_url: "https://example.com/image.jpg",
          text: "Fallback text",
          date: "2026-04-02",
          source_name: "Example",
        },
      ]);
    fetchArticleExcerptMock.mockResolvedValue(null);

    const headlines = await fetchAndExpandHeadlines(5, "today");

    expect(fetchTrendingHeadlinesMock).toHaveBeenNthCalledWith(1, 5, "today");
    expect(fetchTrendingHeadlinesMock).toHaveBeenNthCalledWith(2, 5, "yesterday");
    expect(headlines).toHaveLength(1);
    expect(headlines[0]?.title).toBe("Fallback headline");
    expect(logger.warn).toHaveBeenCalledWith(
      "fetchAndExpandHeadlines: no headlines for today, retrying yesterday",
      expect.objectContaining({
        originalDate: "today",
        fallbackDate: "yesterday",
      })
    );
  });

  it("does not fall back when the requested date is already yesterday", async () => {
    fetchTrendingHeadlinesMock.mockResolvedValueOnce([]);

    const headlines = await fetchAndExpandHeadlines(5, "yesterday");

    expect(fetchTrendingHeadlinesMock).toHaveBeenCalledTimes(1);
    expect(fetchTrendingHeadlinesMock).toHaveBeenCalledWith(5, "yesterday");
    expect(headlines).toEqual([]);
  });
});
