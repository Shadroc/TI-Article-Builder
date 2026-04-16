import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/jina", () => ({
  searchReferences: vi.fn(),
}));

vi.mock("@/integrations/anthropic", () => ({
  writeArticleWithUsage: vi.fn(),
}));

vi.mock("@/lib/editor-config", () => ({
  getEditorConfig: vi.fn(),
  getCategoryMapFromConfig: vi.fn(),
}));

import { searchReferences } from "@/integrations/jina";
import { writeArticleWithUsage } from "@/integrations/anthropic";
import { getCategoryMapFromConfig, getEditorConfig } from "@/lib/editor-config";
import { generateArticle } from "./generateArticle";

describe("generateArticle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(searchReferences).mockResolvedValue({ data: [] } as never);
    vi.mocked(getEditorConfig).mockResolvedValue({ editor_prompts: null } as never);
  });

  it("attaches article generation cost when post-processing fails after a billable response", async () => {
    vi.mocked(writeArticleWithUsage).mockResolvedValue({
      text: "<h1>Headline</h1><p><strong>Category:</strong> Technology</p><p>Body</p>",
      model: "claude-sonnet-4-20250514",
      usage: null,
      cost: {
        provider: "anthropic",
        model: "claude-sonnet-4-20250514",
        operation: "article_generation",
        estimated_cost_usd: 0.045,
        input_cost_usd: 0.015,
        output_cost_usd: 0.03,
      },
    });
    vi.mocked(getCategoryMapFromConfig).mockRejectedValue(new Error("Config lookup failed"));

    await expect(
      generateArticle({
        id: "rss-1",
        title: "Headline",
        link: "https://example.com/story",
        pub_date: "2026-04-15",
        content: "body",
      })
    ).rejects.toMatchObject({
      message: "Config lookup failed",
      estimatedCostUsd: 0.045,
      costs: [
        expect.objectContaining({
          estimated_cost_usd: 0.045,
        }),
      ],
    });
  });
});
