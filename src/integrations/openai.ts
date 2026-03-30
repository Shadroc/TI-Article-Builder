import OpenAI from "openai";
import sharp from "sharp";
import { env } from "@/lib/env";
import type { EditorPrompts } from "@/integrations/supabase";
import { formatPivotCatalogsForAI } from "@/lib/editor-config";
import type { PivotCatalogs } from "@/integrations/supabase";

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

const DEFAULT_SELECTION_SYSTEM = "You are a senior photo editor for an online newsroom.";

export async function selectBestImage(
  candidates: ImageCandidate[],
  articleTitle: string,
  category: string,
  brandHexColor?: string,
  prompts?: Pick<EditorPrompts, "image_selection_system" | "image_selection_user">,
  pivotCatalogs?: PivotCatalogs | null
): Promise<ImageSelectionResult> {
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
      model: "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemMessage },
        {
          role: "user",
          content: [{ type: "text" as const, text: userText }, ...imageContent],
        },
      ],
    },
    { signal: AbortSignal.timeout(120_000) }
  );

  const text = res.choices[0]?.message?.content ?? "{}";
  let parsed: Partial<ImageSelectionResult>;
  try {
    parsed = JSON.parse(text) as Partial<ImageSelectionResult>;
  } catch {
    throw new Error(`selectBestImage: OpenAI returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (typeof parsed.selectedIndex !== "number") {
    throw new Error(`selectBestImage: missing selectedIndex in response: ${text.slice(0, 200)}`);
  }
  return parsed as ImageSelectionResult;
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
  mimeType = "image/jpeg"
): Promise<Buffer> {
  const normalizedMime = mimeType.toLowerCase().split(";")[0].trim();
  const ext = EDIT_EXT[normalizedMime] ?? "png";
  const uint8 = new Uint8Array(imageBuffer);
  const file = new File([uint8], `image.${ext}`, { type: normalizedMime });

  const formData = new FormData();
  formData.append("image", file);
  formData.append("prompt", prompt);
  formData.append("model", "gpt-image-1");
  formData.append("n", "1");
  formData.append("size", "1536x1024");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_EDIT_TIMEOUT_MS);

  try {
    const res = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env().OPENAI_API_KEY}`,
      },
      body: formData,
      signal: controller.signal,
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

    const data = (await res.json()) as { data?: { b64_json?: string }[] };
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI image edit returned no data");
    return Buffer.from(b64, "base64");
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error("Image edit timed out after 90s");
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
  const res = await openai().chat.completions.create(
    {
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
    },
    { signal: AbortSignal.timeout(120_000) }
  );

  const text = res.choices[0]?.message?.content ?? "{}";
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(text) as Record<string, string>;
  } catch {
    throw new Error(`rewriteSeoForSite: OpenAI returned invalid JSON: ${text.slice(0, 200)}`);
  }
  if (!parsed.metatitle || !parsed.metadescription) {
    throw new Error(`rewriteSeoForSite: missing required fields in response: ${text.slice(0, 200)}`);
  }
  return {
    metatitle: parsed.metatitle,
    metadescription: parsed.metadescription,
    keyword: parsed.keyword ?? "",
    site_slug: parsed.site_slug ?? siteSlug,
    site_id: parsed.site_id ?? siteId,
    site_name: parsed.site_name ?? siteName,
  };
}
