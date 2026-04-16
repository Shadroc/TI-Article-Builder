import OpenAI from "openai";
import sharp from "sharp";
import { env } from "@/lib/env";
import type { EditorPrompts } from "@/integrations/supabase";
import { formatPivotCatalogsForAI } from "@/lib/editor-config";
import type { PivotCatalogs } from "@/integrations/supabase";
import { DeadlineExceededError } from "@/lib/deadline";
import {
  estimateOpenAIChatCost,
  estimateOpenAIImageCost,
  sumEstimatedCostUsd,
  type CostEstimate,
  type OpenAIChatUsageSnapshot,
  type OpenAIImageUsageSnapshot,
} from "@/lib/costs";

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

export interface ImageCandidate {
  buffer: Buffer;
  mimeType: string;
}

export interface OpenAIChatResult<T> {
  data: T;
  model: string;
  usage: OpenAIChatUsageSnapshot | null;
  cost: CostEstimate | null;
}

export interface OpenAIImageEditResult {
  buffer: Buffer;
  model: string;
  usage: OpenAIImageUsageSnapshot | null;
  cost: CostEstimate | null;
}

type CostAwareError = Error & {
  costs?: CostEstimate[];
  estimatedCostUsd?: number;
};

const DEFAULT_SELECTION_SYSTEM = "You are a senior photo editor for an online newsroom.";

const OPENAI_CHAT_MODEL = "gpt-4o";
const OPENAI_IMAGE_MODEL = "gpt-image-1";

function attachCostContext(error: unknown, cost: CostEstimate | null): never {
  const enriched = (error instanceof Error ? error : new Error(String(error))) as CostAwareError;
  if (cost) {
    enriched.costs = [cost];
    enriched.estimatedCostUsd = sumEstimatedCostUsd([cost]);
  }
  throw enriched;
}

function normalizeChatUsage(
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | null | undefined
): OpenAIChatUsageSnapshot | null {
  if (!usage) return null;
  return {
    prompt_tokens: usage.prompt_tokens,
    completion_tokens: usage.completion_tokens,
    total_tokens: usage.total_tokens,
  };
}

function normalizeImageUsage(
  usage: {
    input_tokens: number;
    output_tokens: number;
    input_tokens_details?: { text_tokens: number; image_tokens: number };
    output_tokens_details?: { image_tokens: number };
  } | null | undefined
): OpenAIImageUsageSnapshot | null {
  if (!usage) return null;
  return {
    input_tokens: usage.input_tokens,
    output_tokens: usage.output_tokens,
    input_tokens_details: usage.input_tokens_details,
    output_tokens_details: usage.output_tokens_details,
  };
}

export async function selectBestImageWithUsage(
  candidates: ImageCandidate[],
  articleTitle: string,
  category: string,
  brandHexColor?: string,
  prompts?: Pick<EditorPrompts, "image_selection_system" | "image_selection_user">,
  pivotCatalogs?: PivotCatalogs | null,
  signal?: AbortSignal
): Promise<OpenAIChatResult<ImageSelectionResult>> {
  const imageContent = await Promise.all(
    candidates.map(async (c) => {
      const pngBuffer = await sharp(c.buffer).png().toBuffer();
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:image/png;base64,${pngBuffer.toString("base64")}`,
          detail: "auto" as const,
        },
      };
    })
  );

  const colorHint = brandHexColor
    ? `\nBrand accent colour for selective-colour treatment: ${brandHexColor}. The colorTarget MUST be a specific, prominent NON-HUMAN physical object in the foreground (e.g. a stethoscope, a vehicle, a product, machinery, a building facade). Do NOT suggest backgrounds, skies, walls, environments, or any part of a human (skin, face, hair, clothing).`
    : "";

  const systemMessage = (prompts?.image_selection_system ?? DEFAULT_SELECTION_SYSTEM) + formatPivotCatalogsForAI(pivotCatalogs);
  const userTemplate = prompts?.image_selection_user;
  const userText = userTemplate
    ? userTemplate
        .replace(/\{\{articleTitle\}\}/g, articleTitle)
        .replace(/\{\{category\}\}/g, category)
        .replace(/\{\{colorHint\}\}/g, colorHint)
        .replace(/\{\{imageCount\}\}/g, String(candidates.length))
        .replace(/\{\{imageCountMax\}\}/g, String(Math.max(0, candidates.length - 1)))
    : `ROLE: You are a photo editor selecting the best reference image for an article titled "${articleTitle}" in category "${category}".${colorHint}

You have ${candidates.length} candidate images (indexed 0-${candidates.length - 1}).

Return ONLY a JSON object with these fields:
- selectedIndex: number (0-based index of best image)
- reason: string (brief explanation)
- subjectDescription: string (main subject of selected image)
- colorTarget: string (what element to apply brand color to)`;

  const res = await openai().chat.completions.create(
    {
      model: OPENAI_CHAT_MODEL,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content: [{ type: "text" as const, text: userText }, ...imageContent],
        },
      ],
    },
    { signal: signal ?? AbortSignal.timeout(120_000) }
  );

  const usage = normalizeChatUsage(res.usage);
  const cost = usage ? estimateOpenAIChatCost(res.model, usage, "image_selection") : null;
  const text = res.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<ImageSelectionResult>;
  try {
    parsed = JSON.parse(text) as Partial<ImageSelectionResult>;
  } catch (error) {
    attachCostContext(
      error instanceof Error
        ? new Error(`selectBestImage: OpenAI returned invalid JSON: ${text.slice(0, 200)}`)
        : error,
      cost
    );
  }
  if (typeof parsed.selectedIndex !== "number") {
    attachCostContext(
      new Error(`selectBestImage: missing selectedIndex in response: ${text.slice(0, 200)}`),
      cost
    );
  }

  return {
    data: parsed as ImageSelectionResult,
    model: res.model,
    usage,
    cost,
  };
}

export async function selectBestImage(
  candidates: ImageCandidate[],
  articleTitle: string,
  category: string,
  brandHexColor?: string,
  prompts?: Pick<EditorPrompts, "image_selection_system" | "image_selection_user">,
  pivotCatalogs?: PivotCatalogs | null,
  signal?: AbortSignal
): Promise<ImageSelectionResult> {
  const result = await selectBestImageWithUsage(
    candidates,
    articleTitle,
    category,
    brandHexColor,
    prompts,
    pivotCatalogs,
    signal
  );
  return result.data;
}

const IMAGE_EDIT_TIMEOUT_MS = 90_000; // 90s per-editor timeout

const EDIT_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function editImage(
  imageBuffer: Buffer,
  prompt: string,
  mimeType = "image/jpeg",
  signal?: AbortSignal
): Promise<Buffer> {
  const result = await editImageWithUsage(imageBuffer, prompt, mimeType, signal);
  return result.buffer;
}

export async function editImageWithUsage(
  imageBuffer: Buffer,
  prompt: string,
  mimeType = "image/jpeg",
  signal?: AbortSignal
): Promise<OpenAIImageEditResult> {
  const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
  const ext = EDIT_EXT[normalizedMime] ?? "png";
  const uint8 = new Uint8Array(imageBuffer);
  const file = new File([uint8], `image.${ext}`, { type: normalizedMime });

  const formData = new FormData();
  formData.append("image", file);
  formData.append("prompt", prompt);
  formData.append("model", OPENAI_IMAGE_MODEL);
  formData.append("n", "1");
  formData.append("size", "1536x1024");

  const combinedSignal = signal ?? AbortSignal.timeout(IMAGE_EDIT_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env().OPENAI_API_KEY}`,
      },
      body: formData,
      signal: combinedSignal,
    });

    if (!res.ok) {
      const errBody = await res.text();
      let errMessage = `OpenAI image edit failed: ${res.status} ${res.statusText}`;
      try {
        const errJson = JSON.parse(errBody) as { error?: { message?: string } };
        if (errJson?.error?.message) errMessage = errJson.error.message;
      } catch {
        if (errBody) errMessage += ` — ${errBody.slice(0, 200)}`;
      }
      throw new Error(errMessage);
    }

    const data = (await res.json()) as {
      data?: { b64_json?: string }[];
      usage?: {
        input_tokens: number;
        output_tokens: number;
        input_tokens_details?: { text_tokens: number; image_tokens: number };
        output_tokens_details?: { image_tokens: number };
      };
    };
    const usage = normalizeImageUsage(data.usage);
    const cost = usage ? estimateOpenAIImageCost(OPENAI_IMAGE_MODEL, usage, "image_edit") : null;
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      attachCostContext(new Error("OpenAI image edit returned no data"), cost);
    }
    return {
      buffer: Buffer.from(b64, "base64"),
      model: OPENAI_IMAGE_MODEL,
      usage,
      cost,
    };
  } catch (err) {
    if (combinedSignal.aborted) {
      if (combinedSignal.reason instanceof DeadlineExceededError) {
        throw combinedSignal.reason;
      }
      throw new Error("Image edit timed out after 90s");
    }
    throw err;
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
  const result = await rewriteSeoForSiteWithUsage(
    articleTitle,
    articleContent,
    siteName,
    siteSlug,
    siteId
  );
  return result.data;
}

export async function rewriteSeoForSiteWithUsage(
  articleTitle: string,
  articleContent: string,
  siteName: string,
  siteSlug: string,
  siteId: string
): Promise<OpenAIChatResult<{
  metatitle: string;
  metadescription: string;
  keyword: string;
  site_slug: string;
  site_id: string;
  site_name: string;
}>> {
  const res = await openai().chat.completions.create(
    {
      model: OPENAI_CHAT_MODEL,
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
    },
    { signal: AbortSignal.timeout(120_000) }
  );

  const usage = normalizeChatUsage(res.usage);
  const cost = usage ? estimateOpenAIChatCost(res.model, usage, "site_seo") : null;
  const text = res.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(text) as Record<string, string>;
  } catch (error) {
    attachCostContext(
      error instanceof Error
        ? new Error(`rewriteSeoForSite: OpenAI returned invalid JSON: ${text.slice(0, 200)}`)
        : error,
      cost
    );
  }
  if (!parsed.metatitle || !parsed.metadescription) {
    attachCostContext(
      new Error(`rewriteSeoForSite: missing required fields in response: ${text.slice(0, 200)}`),
      cost
    );
  }
  const data = {
    metatitle: parsed.metatitle,
    metadescription: parsed.metadescription,
    keyword: parsed.keyword ?? "",
    site_slug: parsed.site_slug ?? siteSlug,
    site_id: parsed.site_id ?? siteId,
    site_name: parsed.site_name ?? siteName,
  };
  return {
    data,
    model: res.model,
    usage,
    cost,
  };
}
