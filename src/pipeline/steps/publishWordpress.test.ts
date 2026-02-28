import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteArticle } from "./perSiteSeoAndRouting";
import type { ProcessedImage } from "./processImage";
import { publishToWordPress } from "./publishWordpress";

vi.mock("@/integrations/wordpress", () => ({
  uploadMedia: vi.fn(),
  createPost: vi.fn(),
  setFeaturedImage: vi.fn(),
  updateRankMathMeta: vi.fn(),
}));

describe("publishToWordPress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates rank math meta after creating the post", async () => {
    const wordpress = (await import("@/integrations/wordpress")) as {
      uploadMedia: ReturnType<typeof vi.fn>;
      createPost: ReturnType<typeof vi.fn>;
      setFeaturedImage: ReturnType<typeof vi.fn>;
      updateRankMathMeta: ReturnType<typeof vi.fn>;
    };

    wordpress.uploadMedia.mockResolvedValue({
      id: 456,
      source_url: "https://ti.test/image.webp",
    });
    wordpress.createPost.mockResolvedValue({
      id: 123,
      link: "https://ti.test/post",
    });
    wordpress.setFeaturedImage.mockResolvedValue(undefined);
    wordpress.updateRankMathMeta.mockResolvedValue(undefined);

    const siteArticle: SiteArticle = {
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
    };

    const image: ProcessedImage = {
      buffer: Buffer.from("img"),
      mimeType: "image/webp",
      fileName: "featured.webp",
      imageSource: "og:image",
      sourceImageUrl: "https://source.test/image.jpg",
    };

    await publishToWordPress(siteArticle, "<p>hello</p>", image);

    expect(wordpress.updateRankMathMeta).toHaveBeenCalledWith(
      siteArticle.site,
      123,
      "Meta title",
      "Meta description",
      "focus keyword"
    );
  });

  it("still returns publish result when RankMath fails (MT-style, no RankMath)", async () => {
    const wordpress = (await import("@/integrations/wordpress")) as {
      uploadMedia: ReturnType<typeof vi.fn>;
      createPost: ReturnType<typeof vi.fn>;
      setFeaturedImage: ReturnType<typeof vi.fn>;
      updateRankMathMeta: ReturnType<typeof vi.fn>;
    };

    wordpress.uploadMedia.mockResolvedValue({
      id: 789,
      source_url: "https://mt.test/image.webp",
    });
    wordpress.createPost.mockResolvedValue({
      id: 456,
      link: "https://mt.test/post",
    });
    wordpress.setFeaturedImage.mockResolvedValue(undefined);
    wordpress.updateRankMathMeta.mockRejectedValue(
      new Error("WP rank math meta update failed (mt): 404 – Not Found")
    );

    const siteArticle: SiteArticle = {
      site: {
        id: "site-mt",
        name: "Market Tracker",
        slug: "mt",
        wp_base_url: "https://www.markettracker.com",
        active: true,
        category_map: {},
      },
      metatitle: "MT Meta title",
      metadescription: "MT Meta description",
      keyword: "focus keyword",
      categoryId: 5,
      categoryColor: "#00ff00",
    };

    const image: ProcessedImage = {
      buffer: Buffer.from("img"),
      mimeType: "image/webp",
      fileName: "featured.webp",
      imageSource: "og:image",
      sourceImageUrl: "https://source.test/image.jpg",
    };

    const result = await publishToWordPress(siteArticle, "<p>mt content</p>", image);

    expect(result).toEqual({
      siteSlug: "mt",
      postId: 456,
      mediaId: 789,
      postLink: "https://mt.test/post",
      imageUrl: "https://mt.test/image.webp",
    });
    expect(wordpress.updateRankMathMeta).toHaveBeenCalledWith(
      siteArticle.site,
      456,
      "MT Meta title",
      "MT Meta description",
      "focus keyword"
    );
  });
});
