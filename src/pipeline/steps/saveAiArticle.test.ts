import { beforeEach, describe, expect, it, vi } from "vitest";
import { listAiArticlesByFeedAndSites, saveAiArticle } from "./saveAiArticle";
import { logger } from "@/lib/logger";

vi.mock("@/integrations/supabase", () => ({
  supabase: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe("saveAiArticle", () => {
  let supabaseMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    supabaseMock = vi.mocked((await import("@/integrations/supabase")).supabase);
  });

  it("upserts with all fields when wpResult is provided", async () => {
    const upsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: "ai-1",
        rss_feed_id: "feed-1",
        site_id: "site-1",
        title: "New title",
        content: "<p>new</p>",
        wp_post_id: 222,
        wp_media_id: 555,
        wp_image_url: "https://img/new.webp",
      },
      error: null,
    });

    const table = {
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: upsertSingle,
        })),
      })),
    };

    supabaseMock.mockReturnValue({
      from: vi.fn(() => table),
    } as never);

    const result = await saveAiArticle(
      "feed-1",
      "New title",
      "<p>new</p>",
      "site-1",
      {
        siteSlug: "ti",
        postId: 222,
        mediaId: 555,
        postLink: "https://post/222",
        imageUrl: "https://img/new.webp",
        needsImage: false,
      },
      "og:image",
      "https://source/img.jpg"
    );

    expect(table.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        rss_feed_id: "feed-1",
        site_id: "site-1",
        title: "New title",
        wp_post_id: 222,
        wp_media_id: 555,
        wp_image_url: "https://img/new.webp",
        image_source: "og:image",
        source_image_url: "https://source/img.jpg",
      }),
      { onConflict: "rss_feed_id,site_id" }
    );
    expect(result.wp_post_id).toBe(222);
  });

  it("omits null media fields to preserve existing DB values", async () => {
    const upsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: "ai-1",
        rss_feed_id: "feed-1",
        site_id: "site-1",
        title: "New title",
        content: "<p>new</p>",
        wp_post_id: 222,
        wp_media_id: 444,
        wp_image_url: "https://img/existing.webp",
      },
      error: null,
    });

    const table = {
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: upsertSingle,
        })),
      })),
    };

    supabaseMock.mockReturnValue({
      from: vi.fn(() => table),
    } as never);

    await saveAiArticle(
      "feed-1",
      "New title",
      "<p>new</p>",
      "site-1",
      {
        siteSlug: "ti",
        postId: 222,
        mediaId: null,
        postLink: "https://post/222",
        imageUrl: null,
        needsImage: true,
      }
    );

    const firstUpsertCall = table.upsert.mock.calls.at(0) as unknown[] | undefined;
    expect(firstUpsertCall).toBeDefined();
    const upsertArg = firstUpsertCall?.[0] as unknown as Record<string, unknown>;
    // null media fields should be omitted so existing DB values are preserved
    expect(upsertArg).not.toHaveProperty("wp_media_id");
    expect(upsertArg).not.toHaveProperty("wp_image_url");
    expect(upsertArg.wp_post_id).toBe(222);
  });

  it("upserts without wp fields when no wpResult provided", async () => {
    const upsertSingle = vi.fn().mockResolvedValue({
      data: {
        id: "ai-1",
        rss_feed_id: "feed-1",
        site_id: "site-1",
        title: "Title",
        content: "<p>html</p>",
      },
      error: null,
    });

    const table = {
      upsert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: upsertSingle,
        })),
      })),
    };

    supabaseMock.mockReturnValue({
      from: vi.fn(() => table),
    } as never);

    await saveAiArticle("feed-1", "Title", "<p>html</p>", "site-1");

    const firstUpsertCall = table.upsert.mock.calls.at(0) as unknown[] | undefined;
    expect(firstUpsertCall).toBeDefined();
    const upsertArg = firstUpsertCall?.[0] as unknown as Record<string, unknown>;
    expect(upsertArg).not.toHaveProperty("wp_post_id");
    expect(upsertArg).not.toHaveProperty("wp_media_id");
    expect(upsertArg).not.toHaveProperty("wp_image_url");
  });

  it("loads existing rows keyed by site_id", async () => {
    supabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                { id: "a1", rss_feed_id: "feed-1", site_id: "site-1", title: "A", content: "A" },
                { id: "a2", rss_feed_id: "feed-1", site_id: "site-2", title: "B", content: "B" },
              ],
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    const result = await listAiArticlesByFeedAndSites("feed-1", ["site-1", "site-2"]);

    expect(result["site-1"]?.id).toBe("a1");
    expect(result["site-2"]?.id).toBe("a2");
  });

  it("deduplicates existing rows per site deterministically", async () => {
    supabaseMock.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            in: vi.fn().mockResolvedValue({
              data: [
                {
                  id: "a1",
                  rss_feed_id: "feed-1",
                  site_id: "site-1",
                  title: "Draft",
                  content: "A",
                  wp_post_id: null,
                  created_at: "2026-03-30T00:00:00.000Z",
                },
                {
                  id: "a2",
                  rss_feed_id: "feed-1",
                  site_id: "site-1",
                  title: "Published",
                  content: "B",
                  wp_post_id: 99,
                  created_at: "2026-03-29T00:00:00.000Z",
                },
              ],
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    const result = await listAiArticlesByFeedAndSites("feed-1", ["site-1"]);

    expect(result["site-1"]?.id).toBe("a2");
    expect(logger.warn).toHaveBeenCalledWith(
      "Duplicate AI article rows found for feed+site; using canonical row",
      expect.objectContaining({
        siteId: "site-1",
        canonicalId: "a2",
      })
    );
  });
});
