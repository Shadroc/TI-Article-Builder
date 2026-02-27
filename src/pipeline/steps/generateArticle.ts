import { searchReferences } from "@/integrations/jina";
import { writeArticle } from "@/integrations/anthropic";
import { RssFeedRow } from "@/integrations/supabase";
import { getEditorConfig, getCategoryMapFromConfig } from "@/lib/editor-config";

export interface ArticleResult {
  headline: string;
  cleanedHtml: string;
  category: string;
  categoryId: number;
  categoryColor: string;
  tags: string[];
}

function cleanText(raw: string): string {
  let text = raw
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&hellip;/g, "...");

  text = text
    .replace(/\u202f/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/\u2003/g, " ")
    .replace(/\u2009/g, " ")
    .replace(/\u2011/g, "-")
    .replace(/\u2013/g, "-")
    .replace(/\u2014/g, "-")
    .replace(/\u2018/g, "'")
    .replace(/\u2019/g, "'")
    .replace(/\u201c/g, '"')
    .replace(/\u201d/g, '"')
    .replace(/«/g, '"')
    .replace(/»/g, '"')
    .replace(/\u2026/g, "...");

  text = text
    .replace(/\\n/g, "")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/>\s+</g, "><");

  text = text.replace(/^\s+|\s+$/g, "").replace(/\n{3,}/g, "\n\n");
  return text;
}

function extractMetadata(html: string): {
  headline: string;
  category: string;
  tags: string[];
  cleanedHtml: string;
} {
  const headlineMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const headline = headlineMatch ? headlineMatch[1].trim() : "";

  const categoryMatch = html.match(/<strong>\s*Category:\s*<\/strong>\s*([^<]+)/i);
  const category = categoryMatch ? categoryMatch[1].trim() : "Uncategorized";

  const tagsMatch = html.match(/<strong>\s*Tags:\s*<\/strong>\s*([^<]+)/i);
  const tags = tagsMatch
    ? tagsMatch[1].split(",").map((t) => t.trim()).filter(Boolean)
    : [];

  let cleaned = html
    .replace(/<h1[^>]*>[\s\S]*?<\/h1>/i, "")
    .replace(/<p[^>]*>\s*<strong>\s*Category:\s*<\/strong>[\s\S]*?<\/p>/i, "")
    .replace(/<p[^>]*>\s*<strong>\s*Tags:\s*<\/strong>[\s\S]*?<\/p>/i, "")
    .replace(/<p[^>]*>\s*<\/p>/g, "")
    .trim();

  return { headline, category, tags, cleanedHtml: cleaned };
}

export async function generateArticle(rssItem: RssFeedRow): Promise<ArticleResult> {
  const jinaResult = await searchReferences(rssItem.title);
  const searchContent = JSON.stringify(jinaResult.data ?? []);

  const { editor_prompts } = await getEditorConfig();
  const rawArticle = await writeArticle(
    rssItem.title,
    rssItem.content_snippet ?? rssItem.content ?? "",
    searchContent,
    rssItem.pub_date,
    editor_prompts ?? undefined
  );

  const cleaned = cleanText(rawArticle);
  const { headline, category, tags, cleanedHtml } = extractMetadata(cleaned);

  const categoryMap = await getCategoryMapFromConfig();
  const catInfo = categoryMap[category] ?? { id: 0, color: "#CCCCCC" };

  return {
    headline,
    cleanedHtml,
    category,
    categoryId: catInfo.id,
    categoryColor: catInfo.color,
    tags,
  };
}
