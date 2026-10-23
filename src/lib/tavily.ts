import { requireEnv } from "@/lib/env";

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score?: number;
  published_date?: string;
  favicon?: string;
  images?: { url: string; description?: string }[] | string[];
}

interface TavilyResponse {
  results: TavilyResult[];
  usage?: { credits?: number };
}

/**
 * One Tavily news search. search_depth is pinned to "basic" (1 credit).
 * Never enable auto_parameters: it can silently upgrade to "advanced" (2 credits).
 */
export async function tavilyNewsSearch(
  query: string,
  opts: { startDate?: string; maxResults: number },
): Promise<{ results: TavilyResult[]; credits: number }> {
  const body: Record<string, unknown> = {
    query,
    topic: "news",
    search_depth: "basic",
    max_results: opts.maxResults,
    include_images: true,
    include_favicon: true,
    include_answer: false,
    include_raw_content: false,
    include_usage: true,
  };
  if (opts.startDate) body.start_date = opts.startDate;
  else body.time_range = "week";

  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requireEnv("TAVILY_API_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // 429 or 432 means rate or plan limit reached: stop immediately, do not retry.
    const err = new Error(`Tavily ${res.status}: ${text.slice(0, 200)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as TavilyResponse;
  return { results: data.results ?? [], credits: data.usage?.credits ?? 1 };
}

export function firstImage(r: TavilyResult): string | null {
  const img = r.images?.[0];
  if (!img) return null;
  return typeof img === "string" ? img : img.url ?? null;
}
