import { uploadMedia, createPost, setFeaturedImage } from "@/integrations/wordpress";
import { SiteArticle } from "./perSiteSeoAndRouting";
import { ProcessedImage } from "./processImage";

export interface PublishResult {
  siteSlug: string;
  postId: number;
  mediaId: number;
  postLink: string;
  imageUrl: string;
}

export async function publishToWordPress(
  siteArticle: SiteArticle,
  articleHtml: string,
  image: ProcessedImage
): Promise<PublishResult> {
  const site = siteArticle.site;

  const media = await uploadMedia(site, image.buffer, image.fileName, image.mimeType);

  const post = await createPost(
    site,
    siteArticle.metatitle,
    articleHtml,
    siteArticle.categoryId,
    "draft"
  );

  await setFeaturedImage(site, post.id, media.id);

  return {
    siteSlug: site.slug,
    postId: post.id,
    mediaId: media.id,
    postLink: post.link,
    imageUrl: media.source_url,
  };
}
