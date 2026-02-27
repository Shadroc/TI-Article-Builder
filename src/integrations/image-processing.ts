import sharp from "sharp";

export async function downloadImage(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
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
