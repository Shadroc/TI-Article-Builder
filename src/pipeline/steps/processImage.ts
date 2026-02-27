import { searchImages, GoogleImageResult } from "@/integrations/google-cse";
import { selectBestImage, editImage, generateImageEditPrompt } from "@/integrations/openai";
import { downloadImage, resizeToWebp } from "@/integrations/image-processing";
import { RssFeedRow, PivotCatalogs } from "@/integrations/supabase";
import type { EditorPrompts } from "@/integrations/supabase";
import { ArticleResult } from "./generateArticle";
import { getEditorConfig } from "@/lib/editor-config";
import { DEFAULT_PIVOT_CATALOGS } from "@/lib/default-pivot-catalogs";

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
}

async function downloadCandidateImages(
  results: GoogleImageResult[],
  max = 5
): Promise<{ url: string; buffer: Buffer; mimeType: string }[]> {
  const downloads: { url: string; buffer: Buffer; mimeType: string }[] = [];
  const candidates = results.slice(0, max);

  for (const item of candidates) {
    try {
      const { buffer, mimeType } = await downloadImage(item.image.contextLink);
      downloads.push({ url: item.image.contextLink, buffer, mimeType });
    } catch (err) {
      console.error(`Failed to download candidate image: ${item.image.contextLink}`, err);
    }
  }

  return downloads;
}

export async function processArticleImage(
  rssItem: RssFeedRow,
  article: ArticleResult
): Promise<ProcessedImage> {
  const { editor_prompts: prompts, pivot_catalogs } = await getEditorConfig();
  const catalogs = pivot_catalogs ?? DEFAULT_PIVOT_CATALOGS;

  let selectedBuffer: Buffer;
  let selection: { subjectDescription: string; colorTarget: string; reason: string };

  const hasStockImage = !!rssItem.img_url;

  if (hasStockImage) {
    // Branch: use stock API image (matches n8n: Prepare Stock Image for AI → AI Agent)
    try {
      const { buffer } = await downloadImage(rssItem.img_url!);
      const sel = await selectBestImage(
        [rssItem.img_url!],
        article.headline,
        article.category,
        article.categoryColor,
        prompts ?? undefined,
        catalogs
      );
      selection = {
        subjectDescription: sel.subjectDescription,
        colorTarget: sel.colorTarget,
        reason: sel.reason,
      };
      selectedBuffer = buffer;
    } catch (err) {
      console.error("Stock image download failed, falling back to Google CSE:", err);
      return fallbackToGoogleSearch(rssItem, article, catalogs);
    }
  } else {
    return fallbackToGoogleSearch(rssItem, article, catalogs);
  }

  const editPrompt = await buildImageEditPrompt(
    selection,
    article.categoryColor,
    article.headline,
    prompts ?? undefined,
    catalogs
  );

  const editedBuffer = await editImage(selectedBuffer, editPrompt);

  // Resize to WebP
  const { buffer: finalBuffer } = await resizeToWebp(editedBuffer);
  const fileName = `${slugify(article.headline)}-${Date.now()}.webp`;

  return { buffer: finalBuffer, mimeType: "image/webp", fileName };
}

async function fallbackToGoogleSearch(
  rssItem: RssFeedRow,
  article: ArticleResult,
  catalogs: PivotCatalogs
): Promise<ProcessedImage> {
  const { editor_prompts: prompts } = await getEditorConfig();

  const imageResults = await searchImages(rssItem.title);
  if (imageResults.length === 0) {
    throw new Error("No images found from Google CSE");
  }

  const candidates = await downloadCandidateImages(imageResults);
  if (candidates.length === 0) {
    throw new Error("Failed to download any candidate images");
  }

  const candidateUrls = candidates.map((c) => c.url);
  const selection = await selectBestImage(
    candidateUrls,
    article.headline,
    article.category,
    article.categoryColor,
    prompts ?? undefined,
    catalogs
  );

  const selectedIdx = Math.min(selection.selectedIndex, candidates.length - 1);
  const selectedBuffer = candidates[selectedIdx].buffer;

  const editPrompt = await buildImageEditPrompt(
    {
      subjectDescription: selection.subjectDescription,
      colorTarget: selection.colorTarget,
      reason: selection.reason,
    },
    article.categoryColor,
    article.headline,
    prompts ?? undefined,
    catalogs
  );

  const editedBuffer = await editImage(selectedBuffer, editPrompt);
  const { buffer: finalBuffer } = await resizeToWebp(editedBuffer);
  const fileName = `${slugify(article.headline)}-${Date.now()}.webp`;

  return { buffer: finalBuffer, mimeType: "image/webp", fileName };
}

function buildImageEditPrompt(
  selection: { subjectDescription: string; colorTarget: string; reason: string },
  hexColor: string,
  headline: string,
  prompts: EditorPrompts | null | undefined,
  catalogs: PivotCatalogs
): Promise<string> {
  const directTemplate = prompts?.image_edit_direct_template?.trim();
  if (directTemplate) {
    const prompt = directTemplate
      .replace(/\{\{subjectDescription\}\}/g, selection.subjectDescription)
      .replace(/\{\{reason\}\}/g, selection.reason)
      .replace(/\{\{colorTarget\}\}/g, selection.colorTarget)
      .replace(/\{\{hexColor\}\}/g, hexColor)
      .replace(/\{\{headline\}\}/g, headline);
    return Promise.resolve(prompt);
  }
  return generateImageEditPrompt(
    selection.subjectDescription,
    selection.colorTarget,
    hexColor,
    headline,
    prompts ?? undefined,
    catalogs
  );
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}
