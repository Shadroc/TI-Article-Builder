import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SiteArticle } from "./perSiteSeoAndRouting";
import type { ProcessedImage } from "./processImage";
import { publishToWordPress } from "./publishWordpress";

vi.mock("@/integrations/wordpress", () => ({
  uploadMedia: vi.fn(),
  createPost: vi.fn(),
  setFeaturedImage: vi.fn(),
  updateRankMathMeta: vi.fn(),
  postExistsByTitle: vi.fn(),
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
};

const mockImage: ProcessedImage = {
  buffer: Buffer.from("img"),
  mimeType: "image/webp",
  fileName: "featured.webp",
  imageSource: "og:image",
  sourceImageUrl: "https://source.test/image.jpg",
};

describe("publishToWordPress", () => {
  let wordpress: {
    uploadMedia: ReturnType<typeof vi.fn>;
    createPost: ReturnType<typeof vi.fn>;
    setFeaturedImage: ReturnType<typeof vi.fn>;
    updateRankMathMeta: ReturnType<typeof vi.fn>;
    postExistsByTitle: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    wordpress = (await import("@/integrations/wordpress")) as unknown as typeof wordpress;
    wordpress.postExistsByTitle.mockResolvedValue(null);
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

  it("skips publish when post already exists (idempotency guard)", async () => {
    wordpress.postExistsByTitle.mockResolvedValue({ id: 999, link: "https://ti.test/existing" });

    const result = await publishToWordPress(mockSiteArticle, "<p>dupe</p>", mockImage);

    expect(result.postId).toBe(999);
    expect(result.postLink).toBe("https://ti.test/existing");
    expect(wordpress.createPost).not.toHaveBeenCalled();
    expect(wordpress.uploadMedia).not.toHaveBeenCalled();
  });
});
