import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase", () => ({
  supabase: vi.fn(),
}));

vi.mock("./steps/fetchHeadlines", () => ({
  fetchAndExpandHeadlines: vi.fn(),
}));

vi.mock("./steps/upsertRssFeed", () => ({
  upsertRssFeedItem: vi.fn(),
}));

vi.mock("./steps/generateArticle", () => ({
  generateArticle: vi.fn(),
}));

vi.mock("./steps/processImage", () => ({
  processArticleImage: vi.fn(),
}));

vi.mock("./steps/perSiteSeoAndRouting", () => ({
  getActiveSites: vi.fn(),
  generateSeoPerSite: vi.fn(),
}));

vi.mock("./steps/publishWordpress", () => ({
  publishToWordPress: vi.fn(),
}));

vi.mock("./steps/saveAiArticle", () => ({
  listAiArticlesByFeedAndSites: vi.fn(),
  saveAiArticle: vi.fn(),
}));

vi.mock("@/lib/retry", () => ({
  withRetry: vi.fn(async (label: string, fn: () => Promise<unknown>) => {
    try {
      return await fn();
    } catch (error) {
      if (label === "generate_article" || label === "process_image") {
        return await fn();
      }
      throw error;
    }
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/error-categories", () => ({
  categorizeError: vi.fn(() => ({ category: "transient", message: "transient" })),
}));

vi.mock("@/lib/deadline", () => ({
  createDeadline: vi.fn(() => ({ expiresAt: Date.now() + 30_000 })),
}));

import { supabase } from "@/integrations/supabase";
import { fetchAndExpandHeadlines } from "./steps/fetchHeadlines";
import { upsertRssFeedItem } from "./steps/upsertRssFeed";
import { generateArticle } from "./steps/generateArticle";
import { processArticleImage } from "./steps/processImage";
import { getActiveSites, generateSeoPerSite } from "./steps/perSiteSeoAndRouting";
import { publishToWordPress } from "./steps/publishWordpress";
import { listAiArticlesByFeedAndSites, saveAiArticle } from "./steps/saveAiArticle";
import { runPipeline } from "./orchestrator";

describe("runPipeline cost aggregation", () => {
  let stepCounter = 0;
  let stepUpdates: Array<{ id: string; update: Record<string, unknown> }>;

  beforeEach(() => {
    vi.clearAllMocks();
    stepCounter = 0;
    stepUpdates = [];

    vi.mocked(supabase).mockImplementation(() => ({
      from: vi.fn((table: string) => {
        if (table === "workflow_runs") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({ data: { id: "run-1" }, error: null }),
              })),
            })),
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: { cancel_requested_at: null },
                  error: null,
                }),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ error: null }),
            })),
          };
        }

        if (table === "workflow_steps") {
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockImplementation(async () => ({
                  data: { id: `step-${++stepCounter}` },
                  error: null,
                })),
              })),
            })),
            update: vi.fn((update: Record<string, unknown>) => ({
              eq: vi.fn(async (_column: string, id: string) => {
                stepUpdates.push({ id, update });
                return { error: null };
              }),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    }) as never);

    vi.mocked(fetchAndExpandHeadlines).mockResolvedValue([
      {
        news_id: "news-1",
        title: "Headline",
        news_url: "https://example.com/story",
        image_url: "https://example.com/image.jpg",
        text: "body",
        date: "2026-04-15",
      },
    ]);

    vi.mocked(upsertRssFeedItem).mockResolvedValue({
      row: {
        id: "rss-1",
        title: "Headline",
        link: "https://example.com/story",
        pub_date: "2026-04-15",
        content: "body",
        content_snippet: "body",
        img_url: "https://example.com/image.jpg",
      },
      alreadyExisted: false,
    });

    vi.mocked(listAiArticlesByFeedAndSites).mockResolvedValue({});
    vi.mocked(getActiveSites).mockResolvedValue([
      {
        id: "site-1",
        name: "Tomorrow Investor",
        slug: "ti",
        wp_base_url: "https://example.com",
        active: true,
        category_map: {},
      },
    ] as never);
    vi.mocked(generateSeoPerSite).mockResolvedValue({
      siteArticles: [
        {
          site: {
            id: "site-1",
            name: "Tomorrow Investor",
            slug: "ti",
            wp_base_url: "https://example.com",
            active: true,
            category_map: {},
          },
          metatitle: "Meta",
          metadescription: "Desc",
          keyword: "keyword",
          categoryId: 0,
          categoryColor: "#ccc",
          rewrittenHtml: "<p>rewritten</p>",
          costs: [],
          estimatedCostUsd: 0,
        },
      ],
      estimatedCostUsd: 0,
      costsBySite: [],
    });
    vi.mocked(publishToWordPress).mockResolvedValue({
      siteSlug: "ti",
      postId: 123,
      mediaId: null,
      postLink: "https://example.com/post/123",
      imageUrl: null,
      needsImage: false,
    });
    vi.mocked(saveAiArticle).mockResolvedValue({} as never);
  });

  it("includes failed retry attempts in persisted step costs", async () => {
    const failedArticleError = Object.assign(new Error("ECONNRESET"), {
      costs: [
        {
          provider: "anthropic" as const,
          model: "claude-sonnet-4-20250514",
          operation: "article_generation",
          estimated_cost_usd: 0.12,
          input_cost_usd: 0.09,
          output_cost_usd: 0.03,
        },
      ],
    });
    const failedImageError = Object.assign(new Error("AbortError"), {
      costs: [
        {
          provider: "openai" as const,
          model: "gpt-image-1",
          operation: "image_edit",
          estimated_cost_usd: 0.08,
          input_cost_usd: 0.01,
          output_cost_usd: 0.07,
        },
      ],
      estimatedCostUsd: 0.08,
      timingsMs: { imageEdit: 500 },
    });

    vi.mocked(generateArticle)
      .mockRejectedValueOnce(failedArticleError)
      .mockResolvedValueOnce({
        headline: "Generated Headline",
        cleanedHtml: "<p>article</p>",
        category: "Technology",
        categoryId: 1,
        categoryColor: "#123456",
        tags: ["markets"],
        costs: [
          {
            provider: "anthropic",
            model: "claude-sonnet-4-20250514",
            operation: "article_generation",
            estimated_cost_usd: 0.03,
            input_cost_usd: 0.02,
            output_cost_usd: 0.01,
          },
        ],
        estimatedCostUsd: 0.03,
      });

    vi.mocked(processArticleImage)
      .mockRejectedValueOnce(failedImageError)
      .mockResolvedValueOnce({
        buffer: Buffer.from("image"),
        mimeType: "image/webp",
        fileName: "image.webp",
        imageSource: "og:image",
        sourceImageUrl: "https://example.com/source.jpg",
        subjectDescription: "subject",
        timingsMs: { imageEdit: 300, total: 600 },
        costs: [
          {
            provider: "openai",
            model: "gpt-image-1",
            operation: "image_edit",
            estimated_cost_usd: 0.02,
            input_cost_usd: 0.005,
            output_cost_usd: 0.015,
          },
        ],
        estimatedCostUsd: 0.02,
      });

    await runPipeline({ trigger: "manual", articleCount: 1 });

    const articleStep = stepUpdates.find(
      ({ update }) => update.output_summary === "Category: Technology, headline: Generated Headline"
    );
    const imageStep = stepUpdates.find(
      ({ update }) => update.output_summary === "Image: image.webp"
    );

    expect(articleStep?.update.step_metadata).toMatchObject({
      estimated_cost_usd: 0.15,
      costs: [
        expect.objectContaining({ estimated_cost_usd: 0.12 }),
        expect.objectContaining({ estimated_cost_usd: 0.03 }),
      ],
    });
    expect(imageStep?.update.step_metadata).toMatchObject({
      estimated_cost_usd: 0.1,
      costs: [
        expect.objectContaining({ estimated_cost_usd: 0.08 }),
        expect.objectContaining({ estimated_cost_usd: 0.02 }),
      ],
    });
  });

  it("sums all failed image retry costs when image processing is skipped", async () => {
    vi.mocked(generateArticle).mockResolvedValueOnce({
      headline: "Generated Headline",
      cleanedHtml: "<p>article</p>",
      category: "Technology",
      categoryId: 1,
      categoryColor: "#123456",
      tags: ["markets"],
      costs: [],
      estimatedCostUsd: 0,
    });

    vi.mocked(processArticleImage)
      .mockRejectedValueOnce(
        Object.assign(new Error("first timeout"), {
          costs: [
            {
              provider: "openai" as const,
              model: "gpt-image-1",
              operation: "image_edit",
              estimated_cost_usd: 0.02,
              input_cost_usd: 0.005,
              output_cost_usd: 0.015,
            },
          ],
          estimatedCostUsd: 0.02,
        })
      )
      .mockRejectedValueOnce(
        Object.assign(new Error("second timeout"), {
          costs: [
            {
              provider: "openai" as const,
              model: "gpt-image-1",
              operation: "image_edit",
              estimated_cost_usd: 0.03,
              input_cost_usd: 0.01,
              output_cost_usd: 0.02,
            },
          ],
          estimatedCostUsd: 0.03,
        })
      );

    await runPipeline({ trigger: "manual", articleCount: 1 });

    const imageStep = stepUpdates.find(
      ({ update }) => update.output_summary === "Image skipped: second timeout"
    );

    expect(imageStep?.update.step_metadata).toMatchObject({
      estimated_cost_usd: 0.05,
      costs: [
        expect.objectContaining({ estimated_cost_usd: 0.02 }),
        expect.objectContaining({ estimated_cost_usd: 0.03 }),
      ],
    });
  });
});
