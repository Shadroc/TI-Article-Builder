import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { DEFAULT_PROMPTS } from "@/lib/default-editor-prompts";

let _client: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  }
  return _client;
}

export type ArticleWritingPrompts = {
  article_writing_system?: string | null;
  article_writing_user?: string | null;
};

export async function writeArticle(
  rssTitle: string,
  contentSnippet: string,
  googleSearchContent: string,
  pubDate: string,
  prompts?: ArticleWritingPrompts | null
): Promise<string> {
  const system = prompts?.article_writing_system ?? DEFAULT_PROMPTS.article_writing_system;
  const userTemplate = prompts?.article_writing_user ?? DEFAULT_PROMPTS.article_writing_user;
  const truncatedSearch = googleSearchContent.substring(0, 300000);
  const userPrompt = userTemplate
    .replace(/\{\{rssTitle\}\}/g, rssTitle)
    .replace(/\{\{contentSnippet\}\}/g, contentSnippet)
    .replace(/\{\{googleSearchContent\}\}/g, truncatedSearch)
    .replace(/\{\{pubDate\}\}/g, pubDate);

  const res = await anthropic().messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userPrompt }],
  });

  const block = res.content.find((b) => b.type === "text");
  if (!block || block.type !== "text") throw new Error("Anthropic returned no text");
  return block.text;
}
