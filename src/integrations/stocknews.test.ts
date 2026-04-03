import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: vi.fn(() => ({
    STOCKNEWS_API_TOKEN: "secret-token",
  })),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from "@/lib/logger";
import { fetchTrendingHeadlines } from "./stocknews";

describe("fetchTrendingHeadlines", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs sanitized diagnostics when the API returns zero items", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue('{"data":[],"status":"ok"}'),
      })
    );

    const result = await fetchTrendingHeadlines(5, "today");

    expect(result).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      "StockNews trending-headlines returned zero items",
      expect.objectContaining({
        requested: 5,
        date: "today",
        request: {
          pathname: "/api/v1/trending-headlines",
          items: 5,
          date: "today",
        },
      })
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      "StockNews trending-headlines returned zero items",
      expect.objectContaining({
        bodyPreview: expect.stringContaining("secret-token"),
      })
    );
  });
});
