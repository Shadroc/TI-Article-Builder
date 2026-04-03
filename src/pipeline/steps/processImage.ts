import { searchImages, GoogleImageResult } from "@/integrations/google-cse";
import { selectBestImage, editImage } from "@/integrations/openai";
import {
  downloadImage,
  downloadImageWithReferer,
  ensureSupportedForEdit,
  resizeToWebp,
  scrapeArticleImage,
} from "@/integrations/image-processing";
import { RssFeedRow, PivotCatalogs } from "@/integrations/supabase";
import type { EditorPrompts } from "@/integrations/supabase";
import { ArticleResult } from "./generateArticle";
import { getEditorConfig } from "@/lib/editor-config";
import { DEFAULT_PIVOT_CATALOGS } from "@/lib/default-pivot-catalogs";
import { N8N_EDIT_DIRECT_TEMPLATE } from "@/lib/default-editor-prompts";
import { logger } from "@/lib/logger";
import { Deadline, DeadlineExceededError, throwIfDeadlineExceeded, withDeadlineSignal } from "@/lib/deadline";

export interface ImageTimingsMs {
  total?: number;
  ogImageScrape?: number;
  ogImageDownload?: number;
  stocknewsImageDownload?: number;
  googleCseSearch?: number;
  googleCandidateDownloads?: number;
  imageSelection?: number;
  buildEditPrompt?: number;
  ensureSupportedForEdit?: number;
  imageEdit?: number;
  resizeToWebp?: number;
}

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: string;
  fileName: string;
  imageSource: "og:image" | "img_url" | "google_cse";
  sourceImageUrl: string;
  subjectDescription: string;
  timingsMs: ImageTimingsMs;
}

type ImageErrorWithTimings = Error & { timingsMs?: ImageTimingsMs };

function attachTimings(error: unknown, timingsMs: ImageTimingsMs, processStartedAt: number): never {
  const enriched = (error instanceof Error ? error : new Error(String(error))) as ImageErrorWithTimings;
  enriched.timingsMs = {
    ...timingsMs,
    total: timingsMs.total ?? Date.now() - processStartedAt,
  };
  throw enriched;
}

async function measureStep<T>(
  timings: ImageTimingsMs,
  key: keyof ImageTimingsMs,
  meta: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    const durationMs = Date.now() - startedAt;
    timings[key] = durationMs;
    logger.info("Image timing", { step: "process_image", phase: key, durationMs, ...meta });
  }
}

async function downloadCandidateImages(
  results: GoogleImageResult[],
  max = 5,
  deadline?: Deadline,
  timings?: ImageTimingsMs
): Promise<{ url: string; buffer: Buffer; mimeType: string }[]> {
  const candidates = results.slice(0, max);
  const results_ = await measureStep(
    timings ?? {},
    "googleCandidateDownloads",
    { candidateCount: candidates.length },
    () => Promise.all(
      candidates.map(async (item) => {
        try {
          throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
          const { buffer, mimeType } = await downloadImage(
            item.link,
            withDeadlineSignal(deadline, 15_000, "Image candidate download timed out")
          );
          return { url: item.link, buffer, mimeType } as const;
        } catch (err) {
          if (err instanceof DeadlineExceededError) throw err;
          logger.warn("Failed to download candidate image", { url: item.link, err: String(err) });
          return null;
        }
      })
    )
  );

  return results_.filter((r): r is { url: string; buffer: Buffer; mimeType: string } => r !== null);
}

export async function processArticleImage(
  rssItem: RssFeedRow,
  article: ArticleResult,
  deadline?: Deadline
): Promise<ProcessedImage> {
  const processStartedAt = Date.now();
  const timingsMs: ImageTimingsMs = {};
  try {
    const { editor_prompts: prompts, pivot_catalogs } = await getEditorConfig();
    const catalogs = pivot_catalogs ?? DEFAULT_PIVOT_CATALOGS;

    let sourceBuffer: Buffer | null = null;
    let sourceMimeType = "image/jpeg";
    let imageSource = "";
    let sourceImageUrl = "";

    // Priority 1: og:image scraped from the source article URL (publisher's own editorial image)
    try {
      throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
      const ogImageUrl = await measureStep(
        timingsMs,
        "ogImageScrape",
        { articleUrl: rssItem.link },
        () => scrapeArticleImage(
          rssItem.link,
          withDeadlineSignal(deadline, 12_000, "og:image scrape timed out")
        )
      );
      if (!ogImageUrl) {
        logger.info("og:image: no meta tag found in HTML", { articleUrl: rssItem.link });
      } else {
        logger.info("og:image: meta tag found, downloading", { ogImageUrl, articleUrl: rssItem.link });
        try {
          // Pass the article URL as Referer — many CDNs enforce hotlink protection
          const { buffer, mimeType } = await measureStep(
            timingsMs,
            "ogImageDownload",
            { imageUrl: ogImageUrl, source: "og:image" },
            () => downloadImageWithReferer(
              ogImageUrl,
              rssItem.link,
              withDeadlineSignal(deadline, 15_000, "og:image download timed out")
            )
          );
          sourceBuffer = buffer;
          sourceMimeType = mimeType;
          imageSource = "og:image";
          sourceImageUrl = ogImageUrl;
          logger.info("og:image: download succeeded", { ogImageUrl, bytes: buffer.length, mimeType });
        } catch (downloadErr) {
          if (downloadErr instanceof DeadlineExceededError) throw downloadErr;
          logger.info("og:image: download failed, falling back to img_url", {
            ogImageUrl,
            err: String(downloadErr),
          });
        }
      }
    } catch (scrapeErr) {
      if (scrapeErr instanceof DeadlineExceededError) throw scrapeErr;
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
          throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
          const { buffer, mimeType } = await measureStep(
            timingsMs,
            "stocknewsImageDownload",
            { imageUrl: rssItem.img_url, source: "img_url" },
            () => downloadImage(
              rssItem.img_url,
              withDeadlineSignal(deadline, 15_000, "StockNews image download timed out")
            )
          );
          sourceBuffer = buffer;
          sourceMimeType = mimeType;
          imageSource = "img_url";
          sourceImageUrl = rssItem.img_url;
          logger.info("img_url: download succeeded", { img_url: rssItem.img_url, bytes: buffer.length });
        } catch (err) {
          if (err instanceof DeadlineExceededError) throw err;
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
      return fallbackToGoogleSearch(rssItem, article, catalogs, prompts, deadline, timingsMs, processStartedAt);
    }

  throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
  const sel = await measureStep(
    timingsMs,
    "imageSelection",
    { imageSource, candidateCount: 1 },
    () => selectBestImage(
      [{ buffer: sourceBuffer, mimeType: sourceMimeType }],
      article.headline,
      article.category,
      article.categoryColor,
      prompts ?? undefined,
      catalogs,
      withDeadlineSignal(deadline, 120_000, "Image selection timed out")
    )
  );

  const selection = {
    subjectDescription: sel.subjectDescription,
    colorTarget: sel.colorTarget,
    reason: sel.reason,
  };

  const editPrompt = await measureStep(
    timingsMs,
    "buildEditPrompt",
    { imageSource },
    () => buildImageEditPrompt(
      selection,
      article.categoryColor,
      article.headline,
      prompts ?? undefined,
      catalogs
    )
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

  const { buffer: editInputBuffer, mimeType: editInputMime } = await measureStep(
    timingsMs,
    "ensureSupportedForEdit",
    { imageSource },
    () => ensureSupportedForEdit(
      sourceBuffer,
      sourceMimeType
    )
  );

  const meta = await import("sharp").then((s) => s.default(editInputBuffer).metadata());
  logger.info("IMAGE EDIT INPUT", {
    originalMime: sourceMimeType,
    convertedMime: editInputMime,
    originalBytes: sourceBuffer.length,
    convertedBytes: editInputBuffer.length,
    width: meta.width,
    height: meta.height,
    format: meta.format,
  });

  throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
  const editedBuffer = await measureStep(
    timingsMs,
    "imageEdit",
    { imageSource },
    () => editImage(
      editInputBuffer,
      editPrompt,
      editInputMime,
      withDeadlineSignal(deadline, 90_000, "Image edit timed out")
    )
  );
  const { buffer: finalBuffer } = await measureStep(
    timingsMs,
    "resizeToWebp",
    { imageSource },
    () => resizeToWebp(editedBuffer)
  );
  const fileName = `${slugify(article.headline)}-${Date.now()}.webp`;
  timingsMs.total = Date.now() - processStartedAt;
  logger.info("Image timing summary", {
    step: "process_image",
    imageSource,
    timingsMs,
    totalDurationMs: timingsMs.total,
  });

    return {
      buffer: finalBuffer,
      mimeType: "image/webp",
      fileName,
      imageSource: imageSource as "og:image" | "img_url",
      sourceImageUrl,
      subjectDescription: selection.subjectDescription,
      timingsMs,
    };
  } catch (error) {
    attachTimings(error, timingsMs, processStartedAt);
  }
}

async function fallbackToGoogleSearch(
  rssItem: RssFeedRow,
  article: ArticleResult,
  catalogs: PivotCatalogs,
  prompts: EditorPrompts | null,
  deadline?: Deadline,
  timingsMs: ImageTimingsMs = {},
  processStartedAt = Date.now()
): Promise<ProcessedImage> {
  try {

  throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
  const imageResults = await measureStep(
    timingsMs,
    "googleCseSearch",
    { query: rssItem.title },
    () => searchImages(
      rssItem.title,
      5,
      withDeadlineSignal(deadline, 30_000, "Google CSE search timed out")
    )
  );
  if (imageResults.length === 0) {
    throw new Error("No images found from Google CSE");
  }

  const candidates = await downloadCandidateImages(imageResults, 5, deadline, timingsMs);
  if (candidates.length === 0) {
    throw new Error("Failed to download any candidate images");
  }

  throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
  const selection = await measureStep(
    timingsMs,
    "imageSelection",
    { imageSource: "google_cse", candidateCount: candidates.length },
    () => selectBestImage(
      candidates.map((c) => ({ buffer: c.buffer, mimeType: c.mimeType })),
      article.headline,
      article.category,
      article.categoryColor,
      prompts ?? undefined,
      catalogs,
      withDeadlineSignal(deadline, 120_000, "Image selection timed out")
    )
  );

  const selectedIdx = Math.min(selection.selectedIndex, candidates.length - 1);
  const selectedCandidate = candidates[selectedIdx];
  const selectedBuffer = selectedCandidate.buffer;
  const selectedMimeType = selectedCandidate.mimeType;
  const selectedUrl = selectedCandidate.url;

  const editPrompt = await measureStep(
    timingsMs,
    "buildEditPrompt",
    { imageSource: "google_cse" },
    () => buildImageEditPrompt(
      {
        subjectDescription: selection.subjectDescription,
        colorTarget: selection.colorTarget,
        reason: selection.reason,
      },
      article.categoryColor,
      article.headline,
      prompts ?? undefined,
      catalogs
    )
  );

  logger.info("IMAGE DEBUG", {
    subjectDescription: selection.subjectDescription,
    colorTarget: selection.colorTarget,
    hexColor: article.categoryColor,
    headline: article.headline,
    bufferSize: selectedBuffer.length,
    promptPreview: editPrompt.substring(0, 300),
  });

  const { buffer: editInputBuffer, mimeType: editInputMime } = await measureStep(
    timingsMs,
    "ensureSupportedForEdit",
    { imageSource: "google_cse" },
    () => ensureSupportedForEdit(
      selectedBuffer,
      selectedMimeType
    )
  );

  const meta = await import("sharp").then((s) => s.default(editInputBuffer).metadata());
  logger.info("IMAGE EDIT INPUT", {
    originalMime: selectedMimeType,
    convertedMime: editInputMime,
    originalBytes: selectedBuffer.length,
    convertedBytes: editInputBuffer.length,
    width: meta.width,
    height: meta.height,
    format: meta.format,
  });

  throwIfDeadlineExceeded(deadline, "Image processing deadline exceeded");
  const editedBuffer = await measureStep(
    timingsMs,
    "imageEdit",
    { imageSource: "google_cse" },
    () => editImage(
      editInputBuffer,
      editPrompt,
      editInputMime,
      withDeadlineSignal(deadline, 90_000, "Image edit timed out")
    )
  );
  const { buffer: finalBuffer } = await measureStep(
    timingsMs,
    "resizeToWebp",
    { imageSource: "google_cse" },
    () => resizeToWebp(editedBuffer)
  );
  const fileName = `${slugify(article.headline)}-${Date.now()}.webp`;
  timingsMs.total = Date.now() - processStartedAt;
  logger.info("Image timing summary", {
    step: "process_image",
    imageSource: "google_cse",
    timingsMs,
    totalDurationMs: timingsMs.total,
  });

  return {
    buffer: finalBuffer,
    mimeType: "image/webp",
    fileName,
    imageSource: "google_cse" as const,
    sourceImageUrl: selectedUrl,
    subjectDescription: selection.subjectDescription,
    timingsMs,
  };
  } catch (error) {
    attachTimings(error, timingsMs, processStartedAt);
  }
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
