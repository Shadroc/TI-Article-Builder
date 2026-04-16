import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { DEFAULT_PROMPTS } from "@/lib/default-editor-prompts";
import {
  estimateAnthropicTextCost,
  sumEstimatedCostUsd,
  type AnthropicUsageSnapshot,
  type CostEstimate,
} from "@/lib/costs";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 120_000 });
  }
  return _client;
}

export type ArticleWritingPrompts = {
  article_writing_system?: string | null;
  article_writing_user?: string | null;
};

const ANTHROPIC_TEXT_MODEL = "claude-sonnet-4-20250514";

export interface AnthropicTextResult {
  text: string;
  model: string;
  usage: AnthropicUsageSnapshot | null;
  cost: CostEstimate | null;
}

type AnthropicMessageResponse = {
  content: Array<{ type: string; text?: string }>;
  usage?: AnthropicUsageSnapshot;
  model: string;
};

type CostAwareError = Error & {
  costs?: CostEstimate[];
  estimatedCostUsd?: number;
};

function attachCostContext(error: unknown, cost: CostEstimate | null): never {
  const enriched = (error instanceof Error ? error : new Error(String(error))) as CostAwareError;
  if (cost) {
    enriched.costs = [cost];
    enriched.estimatedCostUsd = sumEstimatedCostUsd([cost]);
  }
  throw enriched;
}

function extractTextResult(
  res: AnthropicMessageResponse,
  operation: string,
  missingTextError: string
): AnthropicTextResult {
  const usage: AnthropicUsageSnapshot | null = res.usage
    ? {
        input_tokens: res.usage.input_tokens,
        output_tokens: res.usage.output_tokens,
        cache_creation_input_tokens: res.usage.cache_creation_input_tokens,
        cache_read_input_tokens: res.usage.cache_read_input_tokens,
      }
    : null;
  const cost = usage ? estimateAnthropicTextCost(res.model, usage, operation) : null;
  const block = res.content.find((b) => b.type === "text" && typeof b.text === "string");
  if (!block?.text) {
    attachCostContext(new Error(missingTextError), cost);
  }

  return {
    text: block.text,
    model: res.model,
    usage,
    cost,
  };
}

export async function writeArticleWithUsage(
  rssTitle: string,
  contentSnippet: string,
  googleSearchContent: string,
  pubDate: string,
  prompts?: ArticleWritingPrompts | null
): Promise<AnthropicTextResult> {
  const system = prompts?.article_writing_system ?? DEFAULT_PROMPTS.article_writing_system;
  const userTemplate = prompts?.article_writing_user ?? DEFAULT_PROMPTS.article_writing_user;
  const truncatedSearch = googleSearchContent.substring(0, 300000);
  const userPrompt = userTemplate
    .replace(/\{\{rssTitle\}\}/g, rssTitle)
    .replace(/\{\{contentSnippet\}\}/g, contentSnippet)
    .replace(/\{\{googleSearchContent\}\}/g, truncatedSearch)
    .replace(/\{\{pubDate\}\}/g, pubDate);

  const res = await anthropic().messages.create({
    model: ANTHROPIC_TEXT_MODEL,
    max_tokens: 8096,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  return extractTextResult(
    res as unknown as AnthropicMessageResponse,
    "article_generation",
    "Anthropic returned no text"
  );
}

export async function writeArticle(
  rssTitle: string,
  contentSnippet: string,
  googleSearchContent: string,
  pubDate: string,
  prompts?: ArticleWritingPrompts | null
): Promise<string> {
  const result = await writeArticleWithUsage(
    rssTitle,
    contentSnippet,
    googleSearchContent,
    pubDate,
    prompts
  );
  return result.text;
}

export async function rewriteArticleForSiteWithUsage(
  articleHtml: string,
  siteName: string
): Promise<AnthropicTextResult> {
  const res = await anthropic().messages.create({
    model: ANTHROPIC_TEXT_MODEL,
    max_tokens: 8096,
    system: `You are a professional editor. Rewrite this article for publication on ${siteName}. Requirements:
1. Change phrasing and sentence structure so it reads as original content, not a copy.
2. Replace any references to 'TomorrowInvestor' or 'Tomorrow Investor' with '${siteName}'.
3. Keep all facts, data points, quotes, citations, and source attributions identical.
4. Preserve all HTML tags, structure, links, and formatting exactly.
5. Keep the disclaimer section intact (update site name only).
6. Return ONLY the rewritten HTML, no commentary.`,
    messages: [{ role: "user", content: articleHtml }],
  });

  const result = extractTextResult(
    res as unknown as AnthropicMessageResponse,
    "site_rewrite",
    "Anthropic rewrite returned no text"
  );

  try {
    const rewritten = result.text.trim();

    // Validation guardrails
    if (!rewritten.startsWith("<") || !rewritten.includes("<p>")) {
      throw new Error("Rewrite validation failed: output is not valid HTML");
    }
    if (/<script[\s>]/i.test(rewritten) || /<style[\s>]/i.test(rewritten)) {
      throw new Error("Rewrite validation failed: output contains prohibited script/style tags");
    }
    const lengthRatio = rewritten.length / articleHtml.length;
    if (lengthRatio < 0.5 || lengthRatio > 1.5) {
      throw new Error(`Rewrite validation failed: length ratio ${lengthRatio.toFixed(2)} outside 0.5-1.5 bounds`);
    }
    // Check that all links from original are preserved
    const originalLinks = [...articleHtml.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const rewrittenLinks = [...rewritten.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    const missingLinks = originalLinks.filter((link) => !rewrittenLinks.includes(link));
    if (missingLinks.length > 0) {
      throw new Error(`Rewrite validation failed: missing links: ${missingLinks.join(", ")}`);
    }
    const addedLinks = rewrittenLinks.filter((link) => !originalLinks.includes(link));
    if (addedLinks.length > 0) {
      throw new Error(`Rewrite validation failed: unexpected links added: ${addedLinks.join(", ")}`);
    }

    return {
      ...result,
      text: rewritten,
    };
  } catch (error) {
    attachCostContext(error, result.cost);
  }
}

export async function rewriteArticleForSite(
  articleHtml: string,
  siteName: string
): Promise<string> {
  const result = await rewriteArticleForSiteWithUsage(articleHtml, siteName);
  return result.text;
}
