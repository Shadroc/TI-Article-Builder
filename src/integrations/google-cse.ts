import { env } from "@/lib/env";

export interface GoogleImageResult {
  title: string;
  link: string;
  image: {
    contextLink: string;
    thumbnailLink: string;
    width: number;
    height: number;
  };
}

interface GoogleSearchResponse {
  items?: GoogleImageResult[];
  error?: { message: string };
}

export async function searchImages(query: string, num = 5): Promise<GoogleImageResult[]> {
  const params = new URLSearchParams({
    key: env().GOOGLE_CSE_API_KEY,
    cx: env().GOOGLE_CSE_CX,
    searchType: "image",
    num: String(num),
    imgSize: "large",
    imgType: "photo",
    q: query,
  });

  const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.error(`Google CSE failed: ${res.status}`);
    return [];
  }

  const json: GoogleSearchResponse = await res.json();
  return json.items ?? [];
}
