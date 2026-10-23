import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { config } from "@/lib/env";
import { tavilyUsedThisMonth, usageToday } from "@/lib/quota";
import type { StatusResponse } from "@/lib/feed-types";

export const dynamic = "force-dynamic";

/** GET /api/status : last sync and quota usage, shown in the app footer. */
export async function GET() {
  const [last, tavily, yt, yts, news, videos, channels] = await Promise.all([
    prisma.syncLog.findFirst({ where: { finishedAt: { not: null } }, orderBy: { startedAt: "desc" } }),
    tavilyUsedThisMonth(),
    usageToday("youtube"),
    usageToday("youtube-search"),
    prisma.newsItem.count(),
    prisma.videoItem.count(),
    prisma.trackedChannel.count(),
  ]);
  const body: StatusResponse = {
    lastSync: last
      ? { finishedAt: last.finishedAt?.toISOString() ?? null, newsAdded: last.newsAdded, videosAdded: last.videosAdded, errors: last.errors }
      : null,
    tavilyUsedThisMonth: tavily,
    tavilyMonthlyBudget: config.tavilyMonthlyBudget(),
    youtubeUsedToday: yt + yts,
    counts: { news, videos, channels },
  };
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=120" } });
}
