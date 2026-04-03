import {
  uploadMedia,
  createPost,
  updatePost,
  getPostById,
  setFeaturedImage,
  updateRankMathMeta,
} from "@/integrations/wordpress";
import { logger } from "@/lib/logger";
import { SiteArticle } from "./perSiteSeoAndRouting";
import { ProcessedImage } from "./processImage";
import { AiArticleRow } from "@/integrations/supabase";

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
  image: ProcessedImage | null,
  existingArticle?: AiArticleRow | null
): Promise<PublishResult> {
  const site = siteArticle.site;
  let reusableMediaId: number | null = existingArticle?.wp_media_id ?? null;
  let reusableImageUrl: string | null = existingArticle?.wp_image_url ?? null;

  // Upload image if available
  let media: { id: number; source_url: string } | null = null;
  if (image) {
    media = await uploadMedia(site, image.buffer, image.fileName, image.mimeType, image.subjectDescription);
  }

  let post;
  if (existingArticle?.wp_post_id) {
    const existingPost = await getPostById(site, existingArticle.wp_post_id);
    if (existingPost) {
      reusableMediaId = existingArticle.wp_media_id ?? null;
      reusableImageUrl = existingArticle.wp_image_url ?? null;
      logger.info("Updating existing WordPress post for feed+site", {
        siteSlug: site.slug,
        postId: existingPost.id,
        aiArticleId: existingArticle.id,
      });
      post = await updatePost(
        site,
        existingPost.id,
        siteArticle.metatitle,
        articleHtml,
        siteArticle.categoryId,
        "draft"
      );
    } else {
      logger.warn("Stored WordPress post missing, creating a replacement", {
        siteSlug: site.slug,
        postId: existingArticle.wp_post_id,
        aiArticleId: existingArticle.id,
      });
      post = await createPost(
        site,
        siteArticle.metatitle,
        articleHtml,
        siteArticle.categoryId,
        "draft"
      );
    }
  } else {
    post = await createPost(
      site,
      siteArticle.metatitle,
      articleHtml,
      siteArticle.categoryId,
      "draft"
    );
  }

  if (media) {
    await setFeaturedImage(site, post.id, media.id);
  } else if (reusableMediaId && existingArticle?.wp_post_id !== post.id) {
    try {
      await setFeaturedImage(site, post.id, reusableMediaId);
      logger.info("Reused existing WordPress media on replacement post", {
        siteSlug: site.slug,
        postId: post.id,
        mediaId: reusableMediaId,
        aiArticleId: existingArticle?.id,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn("Stored WordPress media could not be reattached to replacement post", {
        siteSlug: site.slug,
        postId: post.id,
        mediaId: reusableMediaId,
        error: msg,
      });
      reusableMediaId = null;
      reusableImageUrl = null;
    }
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
    mediaId: media?.id ?? reusableMediaId,
    postLink: post.link,
    imageUrl: media?.source_url ?? reusableImageUrl,
    needsImage: !media && !reusableImageUrl,
  };
}
