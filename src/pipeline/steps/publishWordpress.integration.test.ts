/**
 * Integration test: verifies RankMath works on MT by calling the real WordPress API.
 *
 * Run: npm run test:mt-rankmath
 *
 * Requires: .env.local (or .env) with WORDPRESS_SITES, Supabase URL/key, MT site in sites table.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config();

import { describe, expect, it } from "vitest";
import { createPost, updateRankMathMeta } from "@/integrations/wordpress";
import { supabase } from "@/integrations/supabase";

const SKIP = !process.env.TEST_MT_RANKMATH;

describe.skipIf(SKIP)("publishWordpress MT RankMath integration", () => {
  it("updateRankMathMeta succeeds for MT site", async () => {
    const { data: sites } = await supabase()
      .from("sites")
      .select("*")
      .eq("active", true)
      .eq("slug", "mt");

    if (!sites?.length) {
      throw new Error("MT site not found in sites table or not active");
    }

    const mt = sites[0] as { id: string; name: string; slug: string; wp_base_url: string; category_map: Record<string, { id: number }> };
    const categoryId = Object.values(mt.category_map ?? {})[0]?.id ?? 1;

    const post = await createPost(
      mt,
      "[TI Test] RankMath verification - delete me",
      "<p>Integration test post. Safe to delete.</p>",
      categoryId,
      "draft"
    );

    await updateRankMathMeta(
      mt,
      post.id,
      "Test Meta Title - MT RankMath",
      "Test meta description for RankMath verification.",
      "test keyword"
    );

    expect(post.id).toBeGreaterThan(0);
    expect(post.link).toBeTruthy();
  });
});
