import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteRow } from "@/integrations/supabase";
import type { ArticleResult } from "./generateArticle";

vi.mock("@/integrations/openai", () => ({
  rewriteSeoForSiteWithUsage: vi.fn(),
}));

vi.mock("@/integrations/anthropic", () => ({
  rewriteArticleForSiteWithUsage: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { generateSeoPerSite } from "./perSiteSeoAndRouting";

const makeSite = (overrides: Partial<SiteRow> = {}): SiteRow => ({
  id: "site-1",
  name: "Tomorrow Investor",
  slug: "tomorrow-investor",
  wp_base_url: "https://www.tomorrowinvestor.com",
  active: true,
  category_map: { Technology: { id: 5, color: "#0000FF" } },
  ...overrides,
});

const makeArticle = (overrides: Partial<ArticleResult> = {}): ArticleResult =>
  ({
    headline: "Test Headline",
    cleanedHtml: "<p>original article</p>",
    category: "Technology",
    ...overrides,
  }) as ArticleResult;

describe("generateSeoPerSite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns rewritten HTML when rewrite succeeds", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    vi.mocked(openai.rewriteSeoForSiteWithUsage)
      .mockResolvedValueOnce({ data: { metatitle: "TI Title", metadescription: "TI Desc", keyword: "TI KW", site_slug: "ti", site_id: "s1", site_name: "Tomorrow Investor" }, model: "gpt-4o", usage: null, cost: null })
      .mockResolvedValueOnce({ data: { metatitle: "MT Title", metadescription: "MT Desc", keyword: "MT KW", site_slug: "mt", site_id: "s2", site_name: "Market Tracker" }, model: "gpt-4o", usage: null, cost: null });

    vi.mocked(anthropic.rewriteArticleForSiteWithUsage)
      .mockResolvedValueOnce({ text: "<p>rewritten for TI</p>", model: "claude-sonnet-4-20250514", usage: null, cost: null })
      .mockResolvedValueOnce({ text: "<p>rewritten for MT</p>", model: "claude-sonnet-4-20250514", usage: null, cost: null });

    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], "<p>original</p>");

    expect(result.siteArticles).toHaveLength(2);
    expect(result.siteArticles[0].rewrittenHtml).toBe("<p>rewritten for TI</p>");
    expect(result.siteArticles[1].rewrittenHtml).toBe("<p>rewritten for MT</p>");
  });

  it("falls back to original HTML when rewrite fails for one site", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");
    const loggerMod = await import("@/lib/logger");

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    vi.mocked(openai.rewriteSeoForSiteWithUsage)
      .mockResolvedValueOnce({ data: { metatitle: "TI Title", metadescription: "TI Desc", keyword: "TI KW", site_slug: "ti", site_id: "s1", site_name: "Tomorrow Investor" }, model: "gpt-4o", usage: null, cost: null })
      .mockResolvedValueOnce({ data: { metatitle: "MT Title", metadescription: "MT Desc", keyword: "MT KW", site_slug: "mt", site_id: "s2", site_name: "Market Tracker" }, model: "gpt-4o", usage: null, cost: null });

    vi.mocked(anthropic.rewriteArticleForSiteWithUsage)
      .mockResolvedValueOnce({ text: "<p>rewritten for TI</p>", model: "claude-sonnet-4-20250514", usage: null, cost: null })
      .mockRejectedValueOnce(new Error("Rewrite validation failed"));

    const originalHtml = "<p>original body</p>";
    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], originalHtml);

    expect(result.siteArticles[0].rewrittenHtml).toBe("<p>rewritten for TI</p>");
    expect(result.siteArticles[1].rewrittenHtml).toBe(originalHtml);
    expect(vi.mocked(loggerMod.logger.warn)).toHaveBeenCalledWith(
      "Article rewrite failed for site, using original",
      expect.objectContaining({ site: "mt" })
    );
  });

  it("counts billable rewrite fallback costs when validation fails after response", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    vi.mocked(openai.rewriteSeoForSiteWithUsage)
      .mockResolvedValueOnce({ data: { metatitle: "TI Title", metadescription: "TI Desc", keyword: "TI KW", site_slug: "ti", site_id: "s1", site_name: "Tomorrow Investor" }, model: "gpt-4o", usage: null, cost: null })
      .mockResolvedValueOnce({ data: { metatitle: "MT Title", metadescription: "MT Desc", keyword: "MT KW", site_slug: "mt", site_id: "s2", site_name: "Market Tracker" }, model: "gpt-4o", usage: null, cost: null });

    vi.mocked(anthropic.rewriteArticleForSiteWithUsage)
      .mockResolvedValueOnce({
        text: "<p>rewritten for TI</p>",
        model: "claude-sonnet-4-20250514",
        usage: null,
        cost: null,
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("Rewrite validation failed"), {
          costs: [
            {
              provider: "anthropic",
              model: "claude-sonnet-4-20250514",
              operation: "site_rewrite",
              estimated_cost_usd: 0.021,
              input_cost_usd: 0.009,
              output_cost_usd: 0.012,
            },
          ],
          estimatedCostUsd: 0.021,
        })
      );

    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], "<p>original</p>");

    expect(result.siteArticles[1].rewrittenHtml).toBe("<p>original</p>");
    expect(result.siteArticles[1].estimatedCostUsd).toBe(0.021);
    expect(result.costsBySite[1]).toMatchObject({
      site_id: "s2",
      estimated_cost_usd: 0.021,
      costs: [
        expect.objectContaining({
          estimated_cost_usd: 0.021,
        }),
      ],
    });
  });

  it("falls back to original HTML for all sites when all rewrites fail", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");

    const siteA = makeSite({ id: "s1", slug: "ti" });
    const siteB = makeSite({ id: "s2", slug: "mt" });

    vi.mocked(openai.rewriteSeoForSiteWithUsage)
      .mockResolvedValueOnce({ data: { metatitle: "T1", metadescription: "D1", keyword: "K1", site_slug: "ti", site_id: "s1", site_name: "Tomorrow Investor" }, model: "gpt-4o", usage: null, cost: null })
      .mockResolvedValueOnce({ data: { metatitle: "T2", metadescription: "D2", keyword: "K2", site_slug: "mt", site_id: "s2", site_name: "Tomorrow Investor" }, model: "gpt-4o", usage: null, cost: null });

    vi.mocked(anthropic.rewriteArticleForSiteWithUsage)
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"));

    const originalHtml = "<p>original body</p>";
    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], originalHtml);

    expect(result.siteArticles[0].rewrittenHtml).toBe(originalHtml);
    expect(result.siteArticles[1].rewrittenHtml).toBe(originalHtml);
  });

  it("maps category correctly from site category_map", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");

    const site = makeSite({
      category_map: { Finance: { id: 42, color: "#FF0000" } },
    });

    vi.mocked(openai.rewriteSeoForSiteWithUsage).mockResolvedValueOnce({
      data: { metatitle: "Title", metadescription: "Desc", keyword: "KW", site_slug: "site-1", site_id: "site-1", site_name: "Tomorrow Investor" },
      model: "gpt-4o",
      usage: null,
      cost: null,
    });
    vi.mocked(anthropic.rewriteArticleForSiteWithUsage).mockResolvedValueOnce({ text: "<p>rewritten</p>", model: "claude-sonnet-4-20250514", usage: null, cost: null });

    const result = await generateSeoPerSite(
      makeArticle({ category: "Finance" }),
      [site],
      "<p>html</p>"
    );

    expect(result.siteArticles[0].categoryId).toBe(42);
    expect(result.siteArticles[0].categoryColor).toBe("#FF0000");
  });

  it("defaults category to id 0 when not in category_map", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");

    const site = makeSite({ category_map: {} });

    vi.mocked(openai.rewriteSeoForSiteWithUsage).mockResolvedValueOnce({
      data: { metatitle: "T", metadescription: "D", keyword: "K", site_slug: "site-1", site_id: "site-1", site_name: "Tomorrow Investor" },
      model: "gpt-4o",
      usage: null,
      cost: null,
    });
    vi.mocked(anthropic.rewriteArticleForSiteWithUsage).mockResolvedValueOnce({ text: "<p>r</p>", model: "claude-sonnet-4-20250514", usage: null, cost: null });

    const result = await generateSeoPerSite(
      makeArticle({ category: "Unknown" }),
      [site],
      "<p>html</p>"
    );

    expect(result.siteArticles[0].categoryId).toBe(0);
    expect(result.siteArticles[0].categoryColor).toBe("#CCCCCC");
  });

  it("preserves partial SEO costs when one site SEO call fails", async () => {
    const openai = await import("@/integrations/openai");

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    vi.mocked(openai.rewriteSeoForSiteWithUsage)
      .mockResolvedValueOnce({
        data: {
          metatitle: "TI Title",
          metadescription: "TI Desc",
          keyword: "TI KW",
          site_slug: "ti",
          site_id: "s1",
          site_name: "Tomorrow Investor",
        },
        model: "gpt-4o-2024-08-06",
        usage: null,
        cost: {
          provider: "openai",
          model: "gpt-4o-2024-08-06",
          operation: "site_seo",
          estimated_cost_usd: 0.004,
          input_cost_usd: 0.003,
          output_cost_usd: 0.001,
        },
      })
      .mockRejectedValueOnce(new Error("429 rate limit"));

    await expect(
      generateSeoPerSite(makeArticle(), [siteA, siteB], "<p>original</p>")
    ).rejects.toMatchObject({
      estimatedCostUsd: 0.004,
      costsBySite: [
        expect.objectContaining({
          site_id: "s1",
          estimated_cost_usd: 0.004,
        }),
      ],
      costs: [
        expect.objectContaining({
          estimated_cost_usd: 0.004,
        }),
      ],
    });
  });

  it("counts billable rejected SEO responses in partial site costs", async () => {
    const openai = await import("@/integrations/openai");

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    vi.mocked(openai.rewriteSeoForSiteWithUsage)
      .mockResolvedValueOnce({
        data: {
          metatitle: "TI Title",
          metadescription: "TI Desc",
          keyword: "TI KW",
          site_slug: "ti",
          site_id: "s1",
          site_name: "Tomorrow Investor",
        },
        model: "gpt-4o-2024-08-06",
        usage: null,
        cost: {
          provider: "openai",
          model: "gpt-4o-2024-08-06",
          operation: "site_seo",
          estimated_cost_usd: 0.004,
          input_cost_usd: 0.003,
          output_cost_usd: 0.001,
        },
      })
      .mockRejectedValueOnce(
        Object.assign(new Error("invalid JSON"), {
          costs: [
            {
              provider: "openai",
              model: "gpt-4o-2024-08-06",
              operation: "site_seo",
              estimated_cost_usd: 0.006,
              input_cost_usd: 0.004,
              output_cost_usd: 0.002,
            },
          ],
          estimatedCostUsd: 0.006,
        })
      );

    await expect(
      generateSeoPerSite(makeArticle(), [siteA, siteB], "<p>original</p>")
    ).rejects.toMatchObject({
      estimatedCostUsd: 0.01,
      costsBySite: [
        expect.objectContaining({
          site_id: "s1",
          estimated_cost_usd: 0.004,
        }),
        expect.objectContaining({
          site_id: "s2",
          estimated_cost_usd: 0.006,
        }),
      ],
      costs: [
        expect.objectContaining({
          estimated_cost_usd: 0.004,
        }),
        expect.objectContaining({
          estimated_cost_usd: 0.006,
        }),
      ],
    });
  });
});
