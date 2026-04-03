import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteArticle } from "./perSiteSeoAndRouting";
import type { ProcessedImage } from "./processImage";
import { publishToWordPress } from "./publishWordpress";

vi.mock("@/integrations/wordpress", () => ({
  uploadMedia: vi.fn(),
  createPost: vi.fn(),
  updatePost: vi.fn(),
  getPostById: vi.fn(),
  setFeaturedImage: vi.fn(),
  updateRankMathMeta: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const mockSiteArticle: SiteArticle = {
  site: {
    id: "site-1",
    name: "Tomorrow Investor",
    slug: "tomorrow-investor",
    wp_base_url: "https://www.tomorrowinvestor.com",
    active: true,
    category_map: {},
  },
  metatitle: "Meta title",
  metadescription: "Meta description",
  keyword: "focus keyword",
  categoryId: 9,
  categoryColor: "#fff",
  rewrittenHtml: "<p>hello</p>",
};

const mockImage: ProcessedImage = {
  buffer: Buffer.from("img"),
  mimeType: "image/webp",
  fileName: "featured.webp",
  imageSource: "og:image",
  sourceImageUrl: "https://source.test/image.jpg",
  subjectDescription: "A stock chart showing market trends",
  timingsMs: {},
};

describe("publishToWordPress", () => {
  let wordpress: {
    uploadMedia: ReturnType<typeof vi.fn>;
    createPost: ReturnType<typeof vi.fn>;
    updatePost: ReturnType<typeof vi.fn>;
    getPostById: ReturnType<typeof vi.fn>;
    setFeaturedImage: ReturnType<typeof vi.fn>;
    updateRankMathMeta: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    wordpress = (await import("@/integrations/wordpress")) as unknown as typeof wordpress;
    wordpress.getPostById.mockResolvedValue(null);
  });

  it("publishes with image and updates RankMath", async () => {
    wordpress.uploadMedia.mockResolvedValue({ id: 456, source_url: "https://ti.test/image.webp" });
    wordpress.createPost.mockResolvedValue({ id: 123, link: "https://ti.test/post" });
    wordpress.setFeaturedImage.mockResolvedValue(undefined);
    wordpress.updateRankMathMeta.mockResolvedValue(undefined);

    const result = await publishToWordPress(mockSiteArticle, "<p>hello</p>", mockImage);

    expect(result.postId).toBe(123);
    expect(result.needsImage).toBe(false);
    expect(wordpress.uploadMedia).toHaveBeenCalled();
    expect(wordpress.setFeaturedImage).toHaveBeenCalledWith(mockSiteArticle.site, 123, 456);
    expect(wordpress.updateRankMathMeta).toHaveBeenCalledWith(
      mockSiteArticle.site, 123, "Meta title", "Meta description", "focus keyword"
    );
  });

  it("still returns result when RankMath fails", async () => {
    wordpress.uploadMedia.mockResolvedValue({ id: 789, source_url: "https://ti.test/image.webp" });
    wordpress.createPost.mockResolvedValue({ id: 456, link: "https://ti.test/post" });
    wordpress.setFeaturedImage.mockResolvedValue(undefined);
    wordpress.updateRankMathMeta.mockRejectedValue(new Error("404 Not Found"));

    const result = await publishToWordPress(mockSiteArticle, "<p>content</p>", mockImage);

    expect(result.postId).toBe(456);
    expect(result.mediaId).toBe(789);
  });

  it("publishes without image when image is null (needs_image)", async () => {
    wordpress.createPost.mockResolvedValue({ id: 321, link: "https://ti.test/post-no-img" });
    wordpress.updateRankMathMeta.mockResolvedValue(undefined);

    const result = await publishToWordPress(mockSiteArticle, "<p>no image</p>", null);

    expect(result.postId).toBe(321);
    expect(result.mediaId).toBeNull();
    expect(result.imageUrl).toBeNull();
    expect(result.needsImage).toBe(true);
    expect(wordpress.uploadMedia).not.toHaveBeenCalled();
    expect(wordpress.setFeaturedImage).not.toHaveBeenCalled();
  });

  it("updates the existing WordPress post referenced by ai_articles", async () => {
    wordpress.getPostById.mockResolvedValue({ id: 999, link: "https://ti.test/existing" });
    wordpress.updatePost.mockResolvedValue({ id: 999, link: "https://ti.test/existing" });
    wordpress.updateRankMathMeta.mockResolvedValue(undefined);

    const result = await publishToWordPress(
      mockSiteArticle,
      "<p>updated</p>",
      null,
      {
        id: "ai-1",
        rss_feed_id: "feed-1",
        title: "Old title",
        content: "<p>old</p>",
        site_id: "site-1",
        wp_post_id: 999,
        wp_media_id: 456,
        wp_image_url: "https://ti.test/existing-image.webp",
      }
    );

    expect(result.postId).toBe(999);
    expect(result.postLink).toBe("https://ti.test/existing");
    expect(result.mediaId).toBe(456);
    expect(result.imageUrl).toBe("https://ti.test/existing-image.webp");
    expect(result.needsImage).toBe(false);
    expect(wordpress.uploadMedia).not.toHaveBeenCalled();
    expect(wordpress.createPost).not.toHaveBeenCalled();
    expect(wordpress.updatePost).toHaveBeenCalledWith(
      mockSiteArticle.site,
      999,
      "Meta title",
      "<p>updated</p>",
      9,
      "draft"
    );
  });

  it("creates a replacement post when the stored wp_post_id is missing remotely", async () => {
    wordpress.getPostById.mockResolvedValue(null);
    wordpress.createPost.mockResolvedValue({ id: 222, link: "https://ti.test/recreated" });
    wordpress.setFeaturedImage.mockResolvedValue(undefined);
    wordpress.updateRankMathMeta.mockResolvedValue(undefined);

    const result = await publishToWordPress(
      mockSiteArticle,
      "<p>updated</p>",
      null,
      {
        id: "ai-1",
        rss_feed_id: "feed-1",
        title: "Old title",
        content: "<p>old</p>",
        site_id: "site-1",
        wp_post_id: 999,
        wp_media_id: 456,
        wp_image_url: "https://ti.test/existing-image.webp",
      }
    );

    expect(result.postId).toBe(222);
    expect(result.needsImage).toBe(false);
    expect(result.mediaId).toBe(456);
    expect(result.imageUrl).toBe("https://ti.test/existing-image.webp");
    expect(wordpress.createPost).toHaveBeenCalled();
    expect(wordpress.setFeaturedImage).toHaveBeenCalledWith(mockSiteArticle.site, 222, 456);
  });
});
