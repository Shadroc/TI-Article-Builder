import { searchImages, GoogleImageResult } from "@/integrations/google-cse";
import { selectBestImage, editImage } from "@/integrations/openai";
import { downloadImage, downloadImageWithReferer, resizeToWebp, scrapeArticleImage } from "@/integrations/image-processing";
import { RssFeedRow, PivotCatalogs } from "@/integrations/supabase";
import type { EditorPrompts } from "@/integrations/supabase";
import { ArticleResult } from "./generateArticle";
import { getEditorConfig } from "@/lib/editor-config";
import { DEFAULT_PIVOT_CATALOGS } from "@/lib/default-pivot-catalogs";
import { N8N_EDIT_DIRECT_TEMPLATE } from "@/lib/default-editor-prompts";
import { logger } from "@/lib/logger";

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  imageSource: "og:image" | "img_url" | "google_cse";
  sourceImageUrl: string;
}

async function downloadCandidateImages(
  results: GoogleImageResult[],
  max = 5
): Promise<{ url: string; buffer: Buffer; mimeType: string }[]> {
  const downloads: { url: string; buffer: Buffer; mimeType: string }[] = [];
  const candidates = results.slice(0, max);

  for (const item of candidates) {
    try {
      const { buffer, mimeType } = await downloadImage(item.link);
      downloads.push({ url: item.link, buffer, mimeType });
    } catch (err) {
      console.error(`Failed to download candidate image: ${item.link}`, err);
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

  let sourceBuffer: Buffer | null = null;
  let sourceMimeType = "image/jpeg";
  let imageSource = "";
  let sourceImageUrl = "";

  // Priority 1: og:image scraped from the source article URL (publisher's own editorial image)
  try {
    const ogImageUrl = await scrapeArticleImage(rssItem.link);
    if (!ogImageUrl) {
      logger.info("og:image: no meta tag found in HTML", { articleUrl: rssItem.link });
    } else {
      logger.info("og:image: meta tag found, downloading", { ogImageUrl, articleUrl: rssItem.link });
      try {
        // Pass the article URL as Referer — many CDNs enforce hotlink protection
        const { buffer, mimeType } = await downloadImageWithReferer(ogImageUrl, rssItem.link);
        sourceBuffer = buffer;
        sourceMimeType = mimeType;
        imageSource = "og:image";
        sourceImageUrl = ogImageUrl;
        logger.info("og:image: download succeeded", { ogImageUrl, bytes: buffer.length, mimeType });
      } catch (downloadErr) {
        logger.info("og:image: download failed, falling back to img_url", {
          ogImageUrl,
          err: String(downloadErr),
        });
      }
    }
  } catch (scrapeErr) {
    logger.info("og:image: scrape threw an error, falling back to img_url", {
      articleUrl: rssItem.link,
      err: String(scrapeErr),
    });
  }

  // Priority 2: img_url from StockNewsAPI
  if (!sourceBuffer) {
    if (!rssItem.img_url) {
      logger.info("img_url: not present on rssItem, skipping to Google CSE");
    } else {
      try {
        const { buffer, mimeType } = await downloadImage(rssItem.img_url);
        sourceBuffer = buffer;
        sourceMimeType = mimeType;
        imageSource = "img_url";
        sourceImageUrl = rssItem.img_url;
        logger.info("img_url: download succeeded", { img_url: rssItem.img_url, bytes: buffer.length });
      } catch (err) {
        logger.info("img_url: download failed, falling back to Google CSE", {
          img_url: rssItem.img_url,
          err: String(err),
        });
      }
    }
  }

  // Priority 3: Google CSE fallback
  if (!sourceBuffer) {
    logger.info("Image source: Google CSE fallback");
    return fallbackToGoogleSearch(rssItem, article, catalogs, prompts);
  }

  const sel = await selectBestImage(
    [{ buffer: sourceBuffer, mimeType: sourceMimeType }],
    article.headline,
    article.category,
    article.categoryColor,
    prompts ?? undefined,
    catalogs
  );

  const selection = {
    subjectDescription: sel.subjectDescription,
    colorTarget: sel.colorTarget,
    reason: sel.reason,
  };

  const editPrompt = await buildImageEditPrompt(
    selection,
    article.categoryColor,
    article.headline,
    prompts ?? undefined,
    catalogs
  );

  logger.info("IMAGE DEBUG", {
    imageSource,
    subjectDescription: selection.subjectDescription,
    colorTarget: selection.colorTarget,
    hexColor: article.categoryColor,
    headline: article.headline,
    bufferSize: sourceBuffer.length,
    promptPreview: editPrompt.substring(0, 300),
  });

  const editedBuffer = await editImage(sourceBuffer, editPrompt, sourceMimeType);
  const { buffer: finalBuffer } = await resizeToWebp(editedBuffer);
  const fileName = `${slugify(article.headline)}-${Date.now()}.webp`;

  return {
    buffer: finalBuffer,
    mimeType: "image/webp",
    fileName,
    imageSource: imageSource as "og:image" | "img_url",
    sourceImageUrl,
  };
}

async function fallbackToGoogleSearch(
  rssItem: RssFeedRow,
  article: ArticleResult,
  catalogs: PivotCatalogs,
  prompts: EditorPrompts | null
): Promise<ProcessedImage> {

  const imageResults = await searchImages(rssItem.title);
  if (imageResults.length === 0) {
    throw new Error("No images found from Google CSE");
  }

  const candidates = await downloadCandidateImages(imageResults);
  if (candidates.length === 0) {
    throw new Error("Failed to download any candidate images");
  }

  const selection = await selectBestImage(
    candidates.map((c) => ({ buffer: c.buffer, mimeType: c.mimeType })),
    article.headline,
    article.category,
    article.categoryColor,
    prompts ?? undefined,
    catalogs
  );

  const selectedIdx = Math.min(selection.selectedIndex, candidates.length - 1);
  const selectedCandidate = candidates[selectedIdx];
  const selectedBuffer = selectedCandidate.buffer;
  const selectedMimeType = selectedCandidate.mimeType;
  const selectedUrl = selectedCandidate.url;

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

  logger.info("IMAGE DEBUG", {
    subjectDescription: selection.subjectDescription,
    colorTarget: selection.colorTarget,
    hexColor: article.categoryColor,
    headline: article.headline,
    bufferSize: selectedBuffer.length,
    promptPreview: editPrompt.substring(0, 300),
  });

  const editedBuffer = await editImage(selectedBuffer, editPrompt, selectedMimeType);
  const { buffer: finalBuffer } = await resizeToWebp(editedBuffer);
  const fileName = `${slugify(article.headline)}-${Date.now()}.webp`;

  return { buffer: finalBuffer, mimeType: "image/webp", fileName, imageSource: "google_cse" as const, sourceImageUrl: selectedUrl };
}

function buildImageEditPrompt(
  selection: { subjectDescription: string; colorTarget: string; reason: string },
  hexColor: string,
  headline: string,
  prompts: EditorPrompts | null | undefined,
  _catalogs: PivotCatalogs
): Promise<string> {
  const directTemplate = (prompts?.image_edit_direct_template?.trim() || N8N_EDIT_DIRECT_TEMPLATE).trim();
  const isFromConfig = !!prompts?.image_edit_direct_template?.trim();
  if (isFromConfig) {
    logger.info("Image edit: using direct edit template from config", {
      step: "process_image",
      directTemplateChars: directTemplate.length,
    });
  } else {
    logger.info("Image edit: using built-in default edit template", { step: "process_image" });
  }
  const prompt = directTemplate
    .replace(/\{\{subjectDescription\}\}/g, selection.subjectDescription)
    .replace(/\{\{reason\}\}/g, selection.reason)
    .replace(/\{\{colorTarget\}\}/g, selection.colorTarget)
    .replace(/\{\{hexColor\}\}/g, hexColor)
    .replace(/\{\{headline\}\}/g, headline);
  return Promise.resolve(prompt);
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}
