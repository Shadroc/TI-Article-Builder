import sharp from "sharp";

/**
 * Fetches the source article page and extracts the og:image (or twitter:image) URL.
 * Returns null if not found or if the page is inaccessible (paywall, bot block, etc.).
 * Resolves relative URLs against the article's origin.
 */
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

export async function scrapeArticleImage(articleUrl: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(articleUrl, {
      signal: AbortSignal.timeout(12_000),
      headers: BROWSER_HEADERS,
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const html = await res.text();

  // Match og:image in both attribute orders, then twitter:image as fallback
  const imageUrl =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    html.match(/<meta[^>]+property=["']og:image:url["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:url["']/i)?.[1] ??
    html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i)?.[1] ??
    null;

  if (!imageUrl) return null;

  // Resolve relative URLs
  if (imageUrl.startsWith("http")) return imageUrl;
  try {
    const origin = new URL(articleUrl).origin;
    return imageUrl.startsWith("/") ? `${origin}${imageUrl}` : `${origin}/${imageUrl}`;
  } catch {
    return null;
  }
}

/**
 * Downloads an image. Pass `referer` to match the source page domain —
 * many CDNs reject hotlink requests without a matching Referer header.
 */
export async function downloadImageWithReferer(
  url: string,
  referer?: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const headers: Record<string, string> = {
    "User-Agent": BROWSER_HEADERS["User-Agent"],
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  };
  if (referer) {
    try {
      headers["Referer"] = new URL(referer).origin + "/";
    } catch {
      // ignore malformed referer
    }
  }
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers,
  });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} – ${url}`);
  const contentType = res.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    throw new Error(`URL returned non-image content-type: ${contentType} – ${url}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, mimeType: contentType };
}

/** Generic image download — no Referer. Use downloadImageWithReferer for editorial og:images. */
export async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  return downloadImageWithReferer(url);
}

export async function resizeToWebp(
  input: Buffer,
  width = 900,
  height = 600
): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = await sharp(input)
    .resize(width, height, { fit: "fill" })
    .webp({ quality: 80 })
    .toBuffer();

  return { buffer, mimeType: "image/webp" };
}
