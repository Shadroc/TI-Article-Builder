import { env } from "@/lib/env";

export interface JinaSearchResult {
  title: string;
  url: string;
  description: string;
  content?: string;
}

interface JinaResponse {
  code: number;
  data: JinaSearchResult[];
}

export async function searchReferences(query: string): Promise<JinaResponse> {
  const params = new URLSearchParams({ q: query });

  const res = await fetch(`https://s.jina.ai?${params}`, {
    headers: {
      Authorization: `Bearer ${env().JINA_API_KEY}`,
      Accept: "application/json",
      "X-Respond-With": "no-content",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    console.error(`Jina search failed: ${res.status}`);
    return { code: res.status, data: [] };
  }

  const text = await res.text();
  try {
    return JSON.parse(text) as JinaResponse;
  } catch {
    console.error("Jina returned non-JSON response, using empty results");
    return { code: 200, data: [] };
  }
}
