import { describe, expect, it, vi } from "vitest";
import type { ArticleResult } from "@/pipeline/steps/generateArticle";
import type { SiteRow } from "@/integrations/supabase";

vi.mock("@/lib/editor-config", () => ({
  getEditorConfig: vi.fn().mockResolvedValue({ editor_prompts: null, pivot_catalogs: null }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

vi.mock("@/integrations/image-processing", () => ({
  scrapeArticleImage: vi.fn(),
  downloadImageWithReferer: vi.fn(),
  downloadImage: vi.fn(),
  ensureSupportedForEdit: vi.fn(),
  resizeToWebp: vi.fn(),
}));

vi.mock("@/integrations/google-cse", () => ({
  searchImages: vi.fn(),
}));

vi.mock("@/integrations/openai", () => ({
  selectBestImageWithUsage: vi.fn(),
  editImageWithUsage: vi.fn(),
  rewriteSeoForSiteWithUsage: vi.fn(),
}));

vi.mock("@/integrations/anthropic", () => ({
  rewriteArticleForSiteWithUsage: vi.fn(),
}));

import { processArticleImage } from "@/pipeline/steps/processImage";
import { generateSeoPerSite } from "@/pipeline/steps/perSiteSeoAndRouting";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64"
);

function makeArticle(overrides: Partial<ArticleResult> = {}): ArticleResult {
  return {
    headline: "Test Headline",
    cleanedHtml: "<p>original article</p>",
    category: "Finance",
    categoryId: 7,
    categoryColor: "#00AB76",
    tags: ["markets"],
    ...overrides,
  };
}

function makeSite(i: number): SiteRow {
  return {
    id: `site-${i}`,
    name: `Site ${i}`,
    slug: `site-${i}`,
    wp_base_url: `https://site-${i}.example.com`,
    active: true,
    category_map: { Finance: { id: 7, color: "#00AB76" } },
  };
}

describe("speed profile", () => {
  it("shows image processing is mostly serial wall-clock time", async () => {
    const imageProcessing = await import("@/integrations/image-processing");
    const openai = await import("@/integrations/openai");

    vi.mocked(imageProcessing.scrapeArticleImage).mockImplementation(async () => {
      await sleep(30);
      return "https://example.com/source.jpg";
    });
    vi.mocked(imageProcessing.downloadImageWithReferer).mockImplementation(async () => {
      await sleep(60);
      return { buffer: Buffer.from("source"), mimeType: "image/jpeg" };
    });
    vi.mocked(openai.selectBestImageWithUsage).mockImplementation(async () => {
      await sleep(80);
      return {
        data: {
          selectedIndex: 0,
          reason: "Best image",
          subjectDescription: "Factory",
          colorTarget: "the machinery",
        },
        model: "gpt-4o",
        usage: null,
        cost: null,
      };
    });
    vi.mocked(imageProcessing.ensureSupportedForEdit).mockImplementation(async () => {
      await sleep(20);
      return { buffer: TINY_PNG, mimeType: "image/png" };
    });
    vi.mocked(openai.editImageWithUsage).mockImplementation(async () => {
      await sleep(140);
      return { buffer: Buffer.from("edited"), model: "gpt-image-1", usage: null, cost: null };
    });
    vi.mocked(imageProcessing.resizeToWebp).mockImplementation(async () => {
      await sleep(25);
      return { buffer: Buffer.from("webp"), mimeType: "image/webp" };
    });

    const startedAt = Date.now();
    const result = await processArticleImage(
      {
        id: "rss-1",
        title: "Title",
        link: "https://example.com/story",
        pub_date: "2026-01-01",
        content: "body",
        img_url: "https://example.com/image.jpg",
      },
      makeArticle()
    );
    const elapsedMs = Date.now() - startedAt;

    expect(result.timingsMs.ogImageScrape).toBeGreaterThanOrEqual(25);
    expect(result.timingsMs.ogImageDownload).toBeGreaterThanOrEqual(55);
    expect(result.timingsMs.imageSelection).toBeGreaterThanOrEqual(75);
    expect(result.timingsMs.imageEdit).toBeGreaterThanOrEqual(135);
    expect(result.timingsMs.resizeToWebp).toBeGreaterThanOrEqual(20);
    expect(elapsedMs).toBeGreaterThanOrEqual(330);

    console.log(
      JSON.stringify(
        {
          profile: "image_processing_serial",
          elapsedMs,
          timingsMs: result.timingsMs,
        },
        null,
        2
      )
    );
  });

  it("shows per-site seo and rewrite run in parallel across sites", async () => {
    const openai = await import("@/integrations/openai");
    const anthropic = await import("@/integrations/anthropic");

    vi.mocked(openai.rewriteSeoForSiteWithUsage).mockImplementation(async (_title, _content, siteName) => {
      await sleep(70);
      return {
        data: {
          metatitle: `${siteName} title`,
          metadescription: `${siteName} description`,
          keyword: `${siteName} keyword`,
          site_slug: "ignored",
          site_id: "ignored",
          site_name: siteName,
        },
        model: "gpt-4o",
        usage: null,
        cost: null,
      };
    });

    vi.mocked(anthropic.rewriteArticleForSiteWithUsage).mockImplementation(async (html, siteName) => {
      await sleep(120);
      return { text: `${html}<!-- ${siteName} -->`, model: "claude-sonnet-4-20250514", usage: null, cost: null };
    });

    const article = makeArticle();
    const html = "<p>original</p>";

    const startedOne = Date.now();
    await generateSeoPerSite(article, [makeSite(1)], html);
    const oneSiteMs = Date.now() - startedOne;

    const startedFive = Date.now();
    await generateSeoPerSite(article, [1, 2, 3, 4, 5].map(makeSite), html);
    const fiveSiteMs = Date.now() - startedFive;

    expect(oneSiteMs).toBeGreaterThanOrEqual(180);
    expect(fiveSiteMs).toBeLessThan(320);

    console.log(
      JSON.stringify(
        {
          profile: "per_site_parallelism",
          oneSiteMs,
          fiveSiteMs,
          speedMultiplier: Number((fiveSiteMs / oneSiteMs).toFixed(2)),
        },
        null,
        2
      )
    );
  });
});
