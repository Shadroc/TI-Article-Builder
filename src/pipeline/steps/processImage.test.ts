import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDeadline } from "@/lib/deadline";

vi.mock("@/lib/editor-config", () => ({
  getEditorConfig: vi.fn().mockResolvedValue({ editor_prompts: null, pivot_catalogs: null }),
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
  selectBestImage: vi.fn(),
  editImage: vi.fn(),
}));

import { processArticleImage } from "./processImage";

describe("processArticleImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("honors an already-expired deadline before network image work begins", async () => {
    const imageProcessing = await import("@/integrations/image-processing");
    const deadline = createDeadline(1);
    await new Promise((resolve) => setTimeout(resolve, 5));

    await expect(
      processArticleImage(
        {
          id: "rss-1",
          title: "Title",
          link: "https://example.com/story",
          pub_date: "2026-01-01",
          content: "body",
          img_url: "https://example.com/image.jpg",
        },
        {
          headline: "Headline",
          cleanedHtml: "<p>body</p>",
          category: "Finance",
          categoryId: 1,
          categoryColor: "#fff",
          tags: [],
        },
        deadline
      )
    ).rejects.toThrow("Image processing deadline exceeded");

    expect(imageProcessing.scrapeArticleImage).not.toHaveBeenCalled();
  });

  it("attaches partial timings to image-processing failures", async () => {
    const imageProcessing = await import("@/integrations/image-processing");
    const googleCse = await import("@/integrations/google-cse");
    vi.mocked(imageProcessing.scrapeArticleImage).mockRejectedValueOnce(new Error("upstream failed"));
    vi.mocked(imageProcessing.downloadImage).mockRejectedValueOnce(new Error("img url failed"));
    vi.mocked(googleCse.searchImages).mockResolvedValueOnce([]);

    const error = await processArticleImage(
      {
        id: "rss-1",
        title: "Title",
        link: "https://example.com/story",
        pub_date: "2026-01-01",
        content: "body",
        img_url: "https://example.com/image.jpg",
      },
      {
        headline: "Headline",
        cleanedHtml: "<p>body</p>",
        category: "Finance",
        categoryId: 1,
        categoryColor: "#fff",
        tags: [],
      }
    ).catch((err) => err as Error & { timingsMs?: Record<string, unknown> });

    expect(error.message).toContain("No images found from Google CSE");
    expect(error.timingsMs).toMatchObject({
      ogImageScrape: expect.any(Number),
      stocknewsImageDownload: expect.any(Number),
      googleCseSearch: expect.any(Number),
      total: expect.any(Number),
    });
  });
});
