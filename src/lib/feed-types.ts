// Shapes shared by the API and the UI.

export type ContentType = "text" | "video";

export interface NewsDTO {
  kind: "text";
  id: string;
  url: string;
  title: string;
  snippet: string;
  imageUrl: string | null;
  faviconUrl: string | null;
  source: string;
  publishedAt: string;
  locations: string[];
  categories: string[];
}

export interface VideoDTO {
  kind: "video";
  id: string;
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  channelId: string;
  channelTitle: string;
  categories: string[];
}

export type FeedItem = NewsDTO | VideoDTO;

export interface FeedResponse {
  items: FeedItem[];
  nextCursor: string | null;
}

export interface ChannelDTO {
  channelId: string;
  title: string;
  handle: string | null;
  thumbnailUrl: string | null;
}

export interface StatusResponse {
  lastSync: { finishedAt: string | null; newsAdded: number; videosAdded: number; errors: string[] } | null;
  tavilyUsedThisMonth: number;
  tavilyMonthlyBudget: number;
  youtubeUsedToday: number;
  counts: { news: number; videos: number; channels: number };
}
