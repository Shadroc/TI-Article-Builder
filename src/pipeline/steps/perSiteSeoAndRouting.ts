import { supabase, SiteRow } from "@/integrations/supabase";
import { rewriteSeoForSite } from "@/integrations/openai";
import { ArticleResult } from "./generateArticle";

export interface SiteArticle {
  site: SiteRow;
  metatitle: string;
  metadescription: string;
  keyword: string;
  categoryId: number;
  categoryColor: string;
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
  sites: SiteRow[]
): Promise<SiteArticle[]> {
  const results: SiteArticle[] = [];

  for (const site of sites) {
    const seo = await rewriteSeoForSite(
      article.headline,
      article.cleanedHtml,
      site.name,
      site.slug,
      site.id
    );

    const catMap = site.category_map ?? {};
    const mapped = catMap[article.category] ?? { id: 0, color: "#CCCCCC" };

    results.push({
      site,
      metatitle: seo.metatitle,
      metadescription: seo.metadescription,
      keyword: seo.keyword,
      categoryId: mapped.id,
      categoryColor: mapped.color,
    });
  }

  return results;
}
