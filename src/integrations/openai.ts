import OpenAI from "openai";
import { env } from "@/lib/env";
import type { EditorPrompts, PivotCatalogs } from "@/integrations/supabase";
import { formatPivotCatalogsForAI } from "@/lib/editor-config";

let _client: OpenAI | null = null;

export function openai(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: env().OPENAI_API_KEY });
  }
  return _client;
}

export interface ImageSelectionResult {
  selectedIndex: number;
  reason: string;
  subjectDescription: string;
  colorTarget: string;
}

const DEFAULT_SELECTION_SYSTEM = "You are a senior photo editor for an online newsroom.";

export async function selectBestImage(
  imageUrls: string[],
  articleTitle: string,
  category: string,
  brandHexColor?: string,
  prompts?: Pick<EditorPrompts, "image_selection_system" | "image_selection_user">,
  pivotCatalogs?: PivotCatalogs | null
): Promise<ImageSelectionResult> {
  const imageContent = imageUrls.map((url) => ({
    type: "image_url" as const,
    image_url: { url, detail: "low" as const },
  }));

  const colorHint = brandHexColor
    ? `\nBrand accent color (hex) for this category: ${brandHexColor}. When choosing colorTarget, suggest an element where this color will be applied (e.g. accent, background tint, clothing).`
    : "";

  const systemMessage = (prompts?.image_selection_system ?? DEFAULT_SELECTION_SYSTEM) + formatPivotCatalogsForAI(pivotCatalogs);
  const userTemplate = prompts?.image_selection_user;
  const userText = userTemplate
    ? userTemplate
        .replace(/\{\{articleTitle\}\}/g, articleTitle)
        .replace(/\{\{category\}\}/g, category)
        .replace(/\{\{colorHint\}\}/g, colorHint)
        .replace(/\{\{imageCount\}\}/g, String(imageUrls.length))
        .replace(/\{\{imageCountMax\}\}/g, String(Math.max(0, imageUrls.length - 1)))
    : `ROLE: You are a photo editor selecting the best reference image for an article titled "${articleTitle}" in category "${category}".${colorHint}

You have ${imageUrls.length} candidate images (indexed 0-${imageUrls.length - 1}).

Return ONLY a JSON object with these fields:
- selectedIndex: number (0-based index of best image)
- reason: string (brief explanation)
- subjectDescription: string (main subject of selected image)
- colorTarget: string (what element to apply brand color to)`;

  const res = await openai().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemMessage },
      {
        role: "user",
        content: [{ type: "text" as const, text: userText }, ...imageContent],
      },
    ],
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text) as ImageSelectionResult;
}

const DEFAULT_EDIT_SYSTEM = `You are a senior photo editor for an online newsroom. Your task is to write a single, concise prompt for an AI image editor (e.g. DALL-E / GPT Image) that will transform a reference photo into an editorial image.

RULES:
- The prompt must describe creating a new editorial photo. Include: the main subject (from subjectDescription), and instruct applying the brand accent color (hex {{hexColor}}) to the element described in colorTarget.
- Context: news article titled "{{headline}}".
- Style: professional newsroom photography, clean composition, editorial quality.
- CRITICAL: The prompt must explicitly forbid any text, words, letters, numbers, captions, watermarks, or logos in the image. Include a phrase like "Do not include any text or words in the image."
- Output ONLY a JSON object with one field: "prompt" (string). The string is the exact prompt to send to the image editor, nothing else.`;

const DEFAULT_EDIT_USER = `Write the image edit prompt.

- Subject: {{subjectDescription}}
- Apply brand color {{hexColor}} to: {{colorTarget}}
- Article headline: "{{headline}}"

Return JSON: { "prompt": "your single prompt string here" }`;

/** Generate the image edit prompt on the fly via AI (matches n8n "prompt created by AI Agent"). */
export async function generateImageEditPrompt(
  subjectDescription: string,
  colorTarget: string,
  hexColor: string,
  headline: string,
  prompts?: Pick<EditorPrompts, "image_edit_system" | "image_edit_user">,
  pivotCatalogs?: PivotCatalogs | null
): Promise<string> {
  const replace = (t: string) =>
    t
      .replace(/\{\{subjectDescription\}\}/g, subjectDescription)
      .replace(/\{\{colorTarget\}\}/g, colorTarget)
      .replace(/\{\{hexColor\}\}/g, hexColor)
      .replace(/\{\{headline\}\}/g, headline);

  const systemMessage = replace(prompts?.image_edit_system ?? DEFAULT_EDIT_SYSTEM) + formatPivotCatalogsForAI(pivotCatalogs);
  const userMessage = replace(prompts?.image_edit_user ?? DEFAULT_EDIT_USER);

  const res = await openai().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemMessage },
      { role: "user", content: userMessage },
    ],
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(text) as { prompt?: string };
  const prompt = parsed?.prompt?.trim();
  if (!prompt) throw new Error("generateImageEditPrompt returned no prompt");
  return prompt;
}

const IMAGE_EDIT_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes

export async function editImage(
  imageBuffer: Buffer,
  prompt: string,
  mimeType = "image/png"
): Promise<Buffer> {
  const uint8 = new Uint8Array(imageBuffer);
  const blob = new Blob([uint8], { type: mimeType });
  const file = new File([blob], "image.png", { type: mimeType });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_EDIT_TIMEOUT_MS);

  try {
    const res = await openai().images.edit(
      {
        model: "gpt-image-1",
        image: file,
        prompt,
        n: 1,
        size: "1536x1024",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        quality: "medium" as any,
      },
      { signal: controller.signal }
    );

    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI image edit returned no data");
    return Buffer.from(b64, "base64");
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("Image edit timed out after 3 minutes");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function rewriteSeoForSite(
  articleTitle: string,
  articleContent: string,
  siteName: string,
  siteSlug: string,
  siteId: string
): Promise<{
  metatitle: string;
  metadescription: string;
  keyword: string;
  site_slug: string;
  site_id: string;
  site_name: string;
}> {
  const res = await openai().chat.completions.create({
    model: "gpt-4o",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You are an expert SEO content optimizer. Create highly unique meta tags specifically tailored for the site ${siteName}. The title MUST be uniquely rewritten, up to 60 chars. Description up to 160 chars. Keyword is the main topic. CRITICAL REQUIREMENT: You MUST include the following site metadata exactly as provided in your JSON output: "site_slug": "${siteSlug}", "site_id": "${siteId}", "site_name": "${siteName}"`,
      },
      {
        role: "user",
        content: `Create metatitle and metadescription focusing ONLY on the specific angle or audience for ${siteName}. The title and description MUST NOT be the exact same as other sites republishing this. Make it completely unique.
- Original Article Title: ${articleTitle}
- Article Content (first 2000 chars): ${articleContent.substring(0, 2000)}
- Site Name: ${siteName}

Return a JSON object with: metatitle, metadescription, keyword, site_slug, site_id, site_name`,
      },
    ],
  });

  const text = res.choices[0]?.message?.content ?? "{}";
  return JSON.parse(text);
}
