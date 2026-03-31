import { supabase, SiteRow } from "@/integrations/supabase";
import { rewriteSeoForSite } from "@/integrations/openai";
import { rewriteArticleForSite } from "@/integrations/anthropic";
import { ArticleResult } from "./generateArticle";
import { logger } from "@/lib/logger";

export interface SiteArticle {
  site: SiteRow;
  metatitle: string;
  metadescription: string;
  keyword: string;
  categoryId: number;
  categoryColor: string;
  rewrittenHtml: string;
}

export async function getActiveSites(): Promise<SiteRow[]> {
  const { data, error } = await supabase()
    .from("sites")
    .select("*")
    .eq("active", true);

  if (error) throw new Error(`Failed to fetch active sites: ${error.message}`);
  return (data ?? []) as SiteRow[];
}

export async function generateSeoPerSite(
  article: ArticleResult,
  sites: SiteRow[],
  articleHtml: string
): Promise<SiteArticle[]> {
  const seoResults = await Promise.all(
    sites.map((site) =>
      rewriteSeoForSite(
        article.headline,
        article.cleanedHtml,
        site.name,
        site.slug,
        site.id
      )
    )
  );

  // Rewrite article body per site (fallback to original on failure)
  const rewriteResults = await Promise.allSettled(
    sites.map((site) => rewriteArticleForSite(articleHtml, site.name))
  );

  return sites.map((site, i) => {
    const seo = seoResults[i];
    const catMap = site.category_map ?? {};
    const mapped = catMap[article.category] ?? { id: 0, color: "#CCCCCC" };

    const rewriteResult = rewriteResults[i];
    let rewrittenHtml = articleHtml; // fallback to original
    if (rewriteResult.status === "fulfilled") {
      rewrittenHtml = rewriteResult.value;
    } else {
      logger.warn("Article rewrite failed for site, using original", {
        site: site.slug,
        error: String(rewriteResult.reason),
      });
    }

    return {
      site,
      metatitle: seo.metatitle,
      metadescription: seo.metadescription,
      keyword: seo.keyword,
      categoryId: mapped.id,
      categoryColor: mapped.color,
      rewrittenHtml,
    };
  });
}
