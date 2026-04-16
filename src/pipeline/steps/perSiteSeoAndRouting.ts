import { supabase, SiteRow } from "@/integrations/supabase";
import { rewriteSeoForSiteWithUsage } from "@/integrations/openai";
import { rewriteArticleForSiteWithUsage } from "@/integrations/anthropic";
import { ArticleResult } from "./generateArticle";
import { logger } from "@/lib/logger";
import type { CostEstimate } from "@/lib/costs";
import { sumEstimatedCostUsd } from "@/lib/costs";

export interface SiteArticle {
  site: SiteRow;
  metatitle: string;
  metadescription: string;
  keyword: string;
  categoryId: number;
  categoryColor: string;
  rewrittenHtml: string;
  costs?: CostEstimate[];
  estimatedCostUsd?: number;
}

export interface SeoPerSiteResult {
  siteArticles: SiteArticle[];
  estimatedCostUsd: number;
  costsBySite: Array<{
    site_id: string;
    site_slug: string;
    site_name: string;
    estimated_cost_usd: number;
    costs: CostEstimate[];
  }>;
}

type SeoStepError = Error & {
  costs?: CostEstimate[];
  estimatedCostUsd?: number;
  costsBySite?: SeoPerSiteResult["costsBySite"];
};

function extractKnownCosts(error: unknown): CostEstimate[] {
  if (!error || typeof error !== "object" || !("costs" in error)) return [];
  const costs = (error as { costs?: unknown }).costs;
  return Array.isArray(costs) ? (costs as CostEstimate[]) : [];
}

function siteCostsEntry(
  site: SiteRow,
  costs: CostEstimate[]
): SeoPerSiteResult["costsBySite"][number] {
  return {
    site_id: site.id,
    site_slug: site.slug,
    site_name: site.name,
    estimated_cost_usd: sumEstimatedCostUsd(costs),
    costs,
  };
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
): Promise<SeoPerSiteResult> {
  const seoResults = await Promise.allSettled(
    sites.map((site) =>
      rewriteSeoForSiteWithUsage(
        article.headline,
        article.cleanedHtml,
        site.name,
        site.slug,
        site.id
      )
    )
  );

  const partialCostsBySite = seoResults.flatMap((result, index) => {
    const costs =
      result.status === "fulfilled"
        ? result.value.cost ? [result.value.cost] : []
        : extractKnownCosts(result.reason);
    if (result.status !== "fulfilled" && costs.length === 0) return [];
    return [siteCostsEntry(sites[index], costs)];
  });

  const seoFailures = seoResults.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ site: sites[index], reason: result.reason }]
      : []
  );

  if (seoFailures.length > 0) {
    const partialCosts = partialCostsBySite.flatMap((entry) => entry.costs);
    const firstFailure = seoFailures[0];
    const message =
      seoFailures.length === 1
        ? `SEO generation failed for ${firstFailure.site.slug}: ${String(firstFailure.reason)}`
        : `SEO generation failed for ${seoFailures.length} sites; first failure on ${firstFailure.site.slug}: ${String(firstFailure.reason)}`;

    const error = new Error(message) as SeoStepError;
    error.costs = partialCosts;
    error.estimatedCostUsd = sumEstimatedCostUsd(partialCosts);
    error.costsBySite = partialCostsBySite;
    throw error;
  }

  const fulfilledSeoResults = seoResults.map((result) => {
    if (result.status !== "fulfilled") {
      throw new Error("Expected fulfilled SEO result");
    }
    return result.value;
  });

  // Rewrite article body per site (fallback to original on failure)
  const rewriteResults = await Promise.allSettled(
    sites.map((site) => rewriteArticleForSiteWithUsage(articleHtml, site.name))
  );

  const siteArticles = sites.map((site, i) => {
    const seo = fulfilledSeoResults[i];
    const catMap = site.category_map ?? {};
    const mapped = catMap[article.category] ?? { id: 0, color: "#CCCCCC" };
    const costs: CostEstimate[] = [];
    if (seo.cost) costs.push(seo.cost);

    const rewriteResult = rewriteResults[i];
    let rewrittenHtml = articleHtml; // fallback to original
    if (rewriteResult.status === "fulfilled") {
      rewrittenHtml = rewriteResult.value.text;
      if (rewriteResult.value.cost) costs.push(rewriteResult.value.cost);
    } else {
      costs.push(...extractKnownCosts(rewriteResult.reason));
      logger.warn("Article rewrite failed for site, using original", {
        site: site.slug,
        error: String(rewriteResult.reason),
      });
    }

    return {
      site,
      metatitle: seo.data.metatitle,
      metadescription: seo.data.metadescription,
      keyword: seo.data.keyword,
      categoryId: mapped.id,
      categoryColor: mapped.color,
      rewrittenHtml,
      costs,
      estimatedCostUsd: sumEstimatedCostUsd(costs),
    };
  });

  return {
    siteArticles,
    estimatedCostUsd: sumEstimatedCostUsd(
      siteArticles.map((siteArticle) =>
        siteArticle.costs?.map((cost) => cost) ?? []
      ).flat()
    ),
    costsBySite: siteArticles.map((siteArticle) =>
      siteCostsEntry(siteArticle.site, siteArticle.costs ?? [])
    ),
  };
}
