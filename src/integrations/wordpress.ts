import { getWordPressCredentials } from "@/lib/env";
import { SiteRow } from "@/integrations/supabase";

function getCreds(slug: string) {
  const creds = getWordPressCredentials().find((c) => c.slug === slug);
  if (!creds) throw new Error(`WordPress credentials not found for slug: ${slug}`);
  return creds;
}

function authHeader(username: string, appPassword: string): string {
  return "Basic " + Buffer.from(`${username}:${appPassword}`).toString("base64");
}

export async function uploadMedia(
  site: SiteRow,
  imageBuffer: Buffer,
  fileName: string,
  mimeType: string
): Promise<{ id: number; source_url: string }> {
  const creds = getCreds(site.slug);
  const baseUrl = site.wp_base_url.replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds.username, creds.appPassword),
      "Content-Disposition": `attachment; filename=${fileName}`,
      "Content-Type": mimeType,
    },
    body: new Uint8Array(imageBuffer),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP media upload failed (${site.slug}): ${res.status} – ${body}`);
  }

  const json = await res.json();
  return { id: json.id, source_url: json.source_url };
}

export async function createPost(
  site: SiteRow,
  title: string,
  content: string,
  categoryId: number,
  status: "draft" | "publish" = "draft"
): Promise<{ id: number; link: string }> {
  const creds = getCreds(site.slug);
  const baseUrl = site.wp_base_url.replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds.username, creds.appPassword),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, content, status, categories: [categoryId] }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP create post failed (${site.slug}): ${res.status} – ${body}`);
  }

  const json = await res.json();
  return { id: json.id, link: json.link };
}

export async function setFeaturedImage(
  site: SiteRow,
  postId: number,
  mediaId: number
): Promise<void> {
  const creds = getCreds(site.slug);
  const baseUrl = site.wp_base_url.replace(/\/$/, "");

  const res = await fetch(`${baseUrl}/wp-json/wp/v2/posts/${postId}`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds.username, creds.appPassword),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ featured_media: mediaId }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP set featured image failed (${site.slug}): ${res.status} – ${body}`);
  }
}

export async function updateRankMathMeta(
  site: SiteRow,
  postId: number,
  metaTitle: string,
  metaDescription: string,
  focusKeyword: string
): Promise<void> {
  const creds = getCreds(site.slug);
  const baseUrl = site.wp_base_url.replace(/\/$/, "");
  const body = new URLSearchParams({
    post_id: String(postId),
    rank_math_title: metaTitle,
    rank_math_description: metaDescription,
    rank_math_focus_keyword: focusKeyword,
  });

  const res = await fetch(`${baseUrl}/wp-json/rank-math-api/v1/update-meta`, {
    method: "POST",
    headers: {
      Authorization: authHeader(creds.username, creds.appPassword),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const bodyText = await res.text();
    throw new Error(`WP rank math meta update failed (${site.slug}): ${res.status} – ${bodyText}`);
  }
}
