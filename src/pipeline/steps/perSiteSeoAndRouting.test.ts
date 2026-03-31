import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteRow } from "@/integrations/supabase";
import type { ArticleResult } from "./generateArticle";

vi.mock("@/integrations/openai", () => ({
  rewriteSeoForSite: vi.fn(),
}));

vi.mock("@/integrations/anthropic", () => ({
  rewriteArticleForSite: vi.fn(),
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
    const openai = (await import("@/integrations/openai")) as {
      rewriteSeoForSite: ReturnType<typeof vi.fn>;
    };
    const anthropic = (await import("@/integrations/anthropic")) as {
      rewriteArticleForSite: ReturnType<typeof vi.fn>;
    };

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    openai.rewriteSeoForSite
      .mockResolvedValueOnce({ metatitle: "TI Title", metadescription: "TI Desc", keyword: "TI KW" })
      .mockResolvedValueOnce({ metatitle: "MT Title", metadescription: "MT Desc", keyword: "MT KW" });

    anthropic.rewriteArticleForSite
      .mockResolvedValueOnce("<p>rewritten for TI</p>")
      .mockResolvedValueOnce("<p>rewritten for MT</p>");

    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], "<p>original</p>");

    expect(result).toHaveLength(2);
    expect(result[0].rewrittenHtml).toBe("<p>rewritten for TI</p>");
    expect(result[1].rewrittenHtml).toBe("<p>rewritten for MT</p>");
  });

  it("falls back to original HTML when rewrite fails for one site", async () => {
    const openai = (await import("@/integrations/openai")) as {
      rewriteSeoForSite: ReturnType<typeof vi.fn>;
    };
    const anthropic = (await import("@/integrations/anthropic")) as {
      rewriteArticleForSite: ReturnType<typeof vi.fn>;
    };
    const loggerMod = (await import("@/lib/logger")) as {
      logger: { warn: ReturnType<typeof vi.fn> };
    };

    const siteA = makeSite({ id: "s1", slug: "ti", name: "Tomorrow Investor" });
    const siteB = makeSite({ id: "s2", slug: "mt", name: "Market Tracker" });

    openai.rewriteSeoForSite
      .mockResolvedValueOnce({ metatitle: "TI Title", metadescription: "TI Desc", keyword: "TI KW" })
      .mockResolvedValueOnce({ metatitle: "MT Title", metadescription: "MT Desc", keyword: "MT KW" });

    anthropic.rewriteArticleForSite
      .mockResolvedValueOnce("<p>rewritten for TI</p>")
      .mockRejectedValueOnce(new Error("Rewrite validation failed"));

    const originalHtml = "<p>original body</p>";
    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], originalHtml);

    expect(result[0].rewrittenHtml).toBe("<p>rewritten for TI</p>");
    expect(result[1].rewrittenHtml).toBe(originalHtml);
    expect(loggerMod.logger.warn).toHaveBeenCalledWith(
      "Article rewrite failed for site, using original",
      expect.objectContaining({ site: "mt" })
    );
  });

  it("falls back to original HTML for all sites when all rewrites fail", async () => {
    const openai = (await import("@/integrations/openai")) as {
      rewriteSeoForSite: ReturnType<typeof vi.fn>;
    };
    const anthropic = (await import("@/integrations/anthropic")) as {
      rewriteArticleForSite: ReturnType<typeof vi.fn>;
    };

    const siteA = makeSite({ id: "s1", slug: "ti" });
    const siteB = makeSite({ id: "s2", slug: "mt" });

    openai.rewriteSeoForSite
      .mockResolvedValueOnce({ metatitle: "T1", metadescription: "D1", keyword: "K1" })
      .mockResolvedValueOnce({ metatitle: "T2", metadescription: "D2", keyword: "K2" });

    anthropic.rewriteArticleForSite
      .mockRejectedValueOnce(new Error("fail 1"))
      .mockRejectedValueOnce(new Error("fail 2"));

    const originalHtml = "<p>original body</p>";
    const result = await generateSeoPerSite(makeArticle(), [siteA, siteB], originalHtml);

    expect(result[0].rewrittenHtml).toBe(originalHtml);
    expect(result[1].rewrittenHtml).toBe(originalHtml);
  });

  it("maps category correctly from site category_map", async () => {
    const openai = (await import("@/integrations/openai")) as {
      rewriteSeoForSite: ReturnType<typeof vi.fn>;
    };
    const anthropic = (await import("@/integrations/anthropic")) as {
      rewriteArticleForSite: ReturnType<typeof vi.fn>;
    };

    const site = makeSite({
      category_map: { Finance: { id: 42, color: "#FF0000" } },
    });

    openai.rewriteSeoForSite.mockResolvedValueOnce({
      metatitle: "Title",
      metadescription: "Desc",
      keyword: "KW",
    });
    anthropic.rewriteArticleForSite.mockResolvedValueOnce("<p>rewritten</p>");

    const result = await generateSeoPerSite(
      makeArticle({ category: "Finance" }),
      [site],
      "<p>html</p>"
    );

    expect(result[0].categoryId).toBe(42);
    expect(result[0].categoryColor).toBe("#FF0000");
  });

  it("defaults category to id 0 when not in category_map", async () => {
    const openai = (await import("@/integrations/openai")) as {
      rewriteSeoForSite: ReturnType<typeof vi.fn>;
    };
    const anthropic = (await import("@/integrations/anthropic")) as {
      rewriteArticleForSite: ReturnType<typeof vi.fn>;
    };

    const site = makeSite({ category_map: {} });

    openai.rewriteSeoForSite.mockResolvedValueOnce({
      metatitle: "T",
      metadescription: "D",
      keyword: "K",
    });
    anthropic.rewriteArticleForSite.mockResolvedValueOnce("<p>r</p>");

    const result = await generateSeoPerSite(
      makeArticle({ category: "Unknown" }),
      [site],
      "<p>html</p>"
    );

    expect(result[0].categoryId).toBe(0);
    expect(result[0].categoryColor).toBe("#CCCCCC");
  });
});
