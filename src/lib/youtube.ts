import { requireEnv } from "@/lib/env";

/**
 * YouTube Data API v3 quota costs (per call):
 *   search.list         100 units  (only used for free text channel search)
 *   channels.list         1 unit   (lookup by id or @handle)
 *   playlistItems.list    1 unit   (latest uploads, used by the cron)
 */
const BASE = "https://www.googleapis.com/youtube/v3";

export interface ChannelInfo {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
  uploadsPlaylistId: string;
  description?: string;
}

export interface VideoInfo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
}

async function yt<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", requireEnv("YOUTUBE_API_KEY"));
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`YouTube ${path} ${res.status}: ${text.slice(0, 300)}`) as Error & { status?: number; quota?: boolean };
    err.status = res.status;
    err.quota = res.status === 403 && /quota/i.test(text);
    throw err;
  }
  return (await res.json()) as T;
}

/** Every channel's Uploads playlist id is its channel id with "UC" swapped for "UU". */
export function uploadsPlaylistFor(channelId: string): string {
  return channelId.startsWith("UC") ? `UU${channelId.slice(2)}` : channelId;
}

type Thumbs = Record<string, { url: string } | undefined>;
const pickThumb = (t?: Thumbs) => t?.high?.url ?? t?.medium?.url ?? t?.default?.url ?? null;

interface ChannelsResponse {
  items?: {
    id: string;
    snippet: { title: string; description: string; customUrl?: string; thumbnails?: Thumbs };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }[];
}

function toChannel(i: NonNullable<ChannelsResponse["items"]>[number]): ChannelInfo {
  return {
    channelId: i.id,
    title: i.snippet.title,
    handle: i.snippet.customUrl ?? null,
    thumbnailUrl: pickThumb(i.snippet.thumbnails),
    uploadsPlaylistId: i.contentDetails?.relatedPlaylists?.uploads ?? uploadsPlaylistFor(i.id),
    description: i.snippet.description?.slice(0, 160),
  };
}

/** 1 unit. */
export async function getChannelById(channelId: string): Promise<ChannelInfo | null> {
  const data = await yt<ChannelsResponse>("channels", { part: "snippet,contentDetails", id: channelId });
  return data.items?.[0] ? toChannel(data.items[0]) : null;
}

/** 1 unit. */
export async function getChannelByHandle(handle: string): Promise<ChannelInfo | null> {
  const h = handle.startsWith("@") ? handle : `@${handle}`;
  const data = await yt<ChannelsResponse>("channels", { part: "snippet,contentDetails", forHandle: h });
  return data.items?.[0] ? toChannel(data.items[0]) : null;
}

interface SearchResponse {
  items?: { id: { channelId?: string }; snippet: { channelTitle: string; title: string; description: string; thumbnails?: Thumbs } }[];
}

/** 100 units. Returns up to 5 candidates so the user can pick the right one. */
export async function searchChannels(q: string): Promise<ChannelInfo[]> {
  const data = await yt<SearchResponse>("search", { part: "snippet", type: "channel", q, maxResults: "5" });
  return (data.items ?? [])
    .filter((i) => i.id.channelId)
    .map((i) => ({
      channelId: i.id.channelId!,
      title: i.snippet.title || i.snippet.channelTitle,
      handle: null,
      thumbnailUrl: pickThumb(i.snippet.thumbnails),
      uploadsPlaylistId: uploadsPlaylistFor(i.id.channelId!),
      description: i.snippet.description?.slice(0, 160),
    }));
}

interface PlaylistItemsResponse {
  items?: {
    snippet: { title: string; description: string; thumbnails?: Thumbs; resourceId: { videoId: string } };
    contentDetails?: { videoId: string; videoPublishedAt?: string };
    status?: { privacyStatus?: string };
  }[];
}

/** 1 unit. Latest uploads, newest first. */
export async function getLatestUploads(playlistId: string, maxResults: number): Promise<VideoInfo[]> {
  const data = await yt<PlaylistItemsResponse>("playlistItems", {
    part: "snippet,contentDetails,status",
    playlistId,
    maxResults: String(maxResults),
  });
  return (data.items ?? [])
    .filter((i) => i.status?.privacyStatus !== "private" && i.contentDetails?.videoPublishedAt)
    .map((i) => ({
      videoId: i.contentDetails?.videoId ?? i.snippet.resourceId.videoId,
      title: i.snippet.title,
      description: (i.snippet.description ?? "").slice(0, 500),
      thumbnailUrl: pickThumb(i.snippet.thumbnails),
      publishedAt: new Date(i.contentDetails!.videoPublishedAt!),
    }));
}

/**
 * Turns whatever the user typed into the cheapest lookup:
 *   https://youtube.com/channel/UCxxxx  or  UCxxxx  -> by id (1 unit)
 *   https://youtube.com/@name           or  @name   -> by handle (1 unit)
 *   anything else                                   -> search (100 units)
 */
export function classifyChannelInput(raw: string): { kind: "id" | "handle" | "search"; value: string } {
  const s = raw.trim();
  const idMatch = s.match(/(?:channel\/)?(UC[\w-]{22})/);
  if (idMatch) return { kind: "id", value: idMatch[1] };
  const handleMatch = s.match(/(?:youtube\.com\/)?(@[\w.\-]{3,30})/i);
  if (handleMatch) return { kind: "handle", value: handleMatch[1] };
  return { kind: "search", value: s };
}
