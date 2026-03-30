import {
  uploadMedia,
  createPost,
  setFeaturedImage,
  updateRankMathMeta,
  postExistsByTitle,
} from "@/integrations/wordpress";
import { logger } from "@/lib/logger";
import { SiteArticle } from "./perSiteSeoAndRouting";
import { ProcessedImage } from "./processImage";

export interface PublishResult {
  siteSlug: string;
  postId: number;
  mediaId: number | null;
  postLink: string;
  imageUrl: string | null;
  needsImage: boolean;
}

export async function publishToWordPress(
  siteArticle: SiteArticle,
  articleHtml: string,
  image: ProcessedImage | null
): Promise<PublishResult> {
  const site = siteArticle.site;

  // Idempotency guard — check if post with this title already exists
  const existing = await postExistsByTitle(site, siteArticle.metatitle);
  if (existing) {
    logger.info("Post already exists, skipping publish", {
      siteSlug: site.slug,
      postId: existing.id,
      title: siteArticle.metatitle,
    });
    return {
      siteSlug: site.slug,
      postId: existing.id,
      mediaId: null,
      postLink: existing.link,
      imageUrl: null,
      needsImage: image === null,
    };
  }

  // Upload image if available
  let media: { id: number; source_url: string } | null = null;
  if (image) {
    media = await uploadMedia(site, image.buffer, image.fileName, image.mimeType);
  }

  const post = await createPost(
    site,
    siteArticle.metatitle,
    articleHtml,
    siteArticle.categoryId,
    "draft"
  );

  if (media) {
    await setFeaturedImage(site, post.id, media.id);
  }

  try {
    await updateRankMathMeta(
      site,
      post.id,
      siteArticle.metatitle,
      siteArticle.metadescription,
      siteArticle.keyword
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn("RankMath meta update failed (non-fatal)", {
      siteSlug: site.slug,
      postId: post.id,
      error: msg,
    });
  }

  return {
    siteSlug: site.slug,
    postId: post.id,
    mediaId: media?.id ?? null,
    postLink: post.link,
    imageUrl: media?.source_url ?? null,
    needsImage: image === null,
  };
}
