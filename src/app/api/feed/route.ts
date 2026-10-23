import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isValidLocationId } from "@/lib/locations";
import type { FeedItem, FeedResponse } from "@/lib/feed-types";

/**
 * GET /api/feed
 *   types      text,video            (default both)
 *   locations  comma separated ids   (default: no location filter)
 *   from, to   ISO date or datetime  (inclusive)
 *   channels   comma separated YouTube channel ids (default: all tracked)
 *   cursor     ISO datetime from the previous page's nextCursor
 *   limit      1..60 (default 30)
 *
 * Reads ONLY from the database. No external API is ever called here.
 */
export const dynamic = "force-dynamic";

const list = (v: string | null) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : []);

function parseDate(v: string | null, endOfDay = false): Date | undefined {
  if (!v) return undefined;
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v}T${endOfDay ? "23:59:59.999" : "00:00:00"}+05:30` : v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const types = new Set(list(sp.get("types")).filter((t) => t === "text" || t === "video"));
  if (types.size === 0) {
    types.add("text");
    types.add("video");
  }
  const locations = list(sp.get("locations")).filter(isValidLocationId).slice(0, 200);
  const channels = list(sp.get("channels")).filter((c) => /^UC[\w-]{22}$/.test(c)).slice(0, 100);
  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"), true);
  const cursor = parseDate(sp.get("cursor"));
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 30, 1), 60);

  const publishedAt: Prisma.DateTimeFilter = {};
  if (from) publishedAt.gte = from;
  if (to) publishedAt.lte = to;
  if (cursor) publishedAt.lt = cursor;

  const [news, videos] = await Promise.all([
    types.has("text")
      ? prisma.newsItem.findMany({
          where: { publishedAt, ...(locations.length ? { locations: { hasSome: locations } } : {}) },
          orderBy: { publishedAt: "desc" },
          take: limit + 1,
        })
      : Promise.resolve([]),
    types.has("video")
      ? prisma.videoItem.findMany({
          where: { publishedAt, ...(channels.length ? { channelId: { in: channels } } : {}) },
          orderBy: { publishedAt: "desc" },
          take: limit + 1,
          include: { channel: { select: { title: true } } },
        })
      : Promise.resolve([]),
  ]);

  const merged: FeedItem[] = [
    ...news.map((n) => ({
      kind: "text" as const,
      id: n.id,
      url: n.url,
      title: n.title,
      snippet: n.snippet,
      imageUrl: n.imageUrl,
      faviconUrl: n.faviconUrl,
      source: n.source,
      publishedAt: n.publishedAt.toISOString(),
      locations: n.locations,
    })),
    ...videos.map((v) => ({
      kind: "video" as const,
      id: v.id,
      videoId: v.videoId,
      title: v.title,
      description: v.description,
      thumbnailUrl: v.thumbnailUrl,
      publishedAt: v.publishedAt.toISOString(),
      channelId: v.channelId,
      channelTitle: v.channel.title,
    })),
  ].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const page = merged.slice(0, limit);
  const hasMore = merged.length > limit;
  const body: FeedResponse = { items: page, nextCursor: hasMore ? page[page.length - 1].publishedAt : null };

  return NextResponse.json(body, {
    // Data only changes twice a day, so let the CDN absorb repeat loads.
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900" },
  });
}
