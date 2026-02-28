import sharp from "sharp";

/**
 * Fetches the source article page and extracts the og:image (or twitter:image) URL.
 * Returns null if not found or if the page is inaccessible (paywall, bot block, etc.).
 * Resolves relative URLs against the article's origin.
 */
export async function scrapeArticleImage(articleUrl: string): Promise<string | null> {
  let res: Response;
  try {
    res = await fetch(articleUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const html = await res.text();

  // Match og:image in both attribute orders
  const imageUrl =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1] ??
    // twitter:image as secondary fallback
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

export async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  if (!res.ok) throw new Error(`Image download failed: ${res.status} – ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  return { buffer, mimeType };
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
