import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorized } from "@/lib/auth";
import { syncChannelUploads } from "@/lib/sync";
import { getChannelById } from "@/lib/youtube";
import { addUsage, youtubeRemainingToday } from "@/lib/quota";
import type { ChannelDTO } from "@/lib/feed-types";

export const dynamic = "force-dynamic";

const toDTO = (c: { channelId: string; title: string; handle: string | null; thumbnailUrl: string | null }): ChannelDTO => ({
  channelId: c.channelId,
  title: c.title,
  handle: c.handle,
  thumbnailUrl: c.thumbnailUrl,
});

/** GET /api/channels : tracked channels (database only). */
export async function GET() {
  const channels = await prisma.trackedChannel.findMany({ orderBy: { title: "asc" } });
  return NextResponse.json({ channels: channels.map(toDTO) });
}

/**
 * POST /api/channels  { channelId, query? }
 * Saves a channel picked from /api/channels/search. Costs 1 unit to verify
 * the channel plus 1 unit to pull its latest uploads straight away.
 * If the channel is already tracked, costs nothing.
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Admin key required" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { channelId?: string; query?: string };
  const channelId = body.channelId?.trim() ?? "";
  if (!/^UC[\w-]{22}$/.test(channelId)) return NextResponse.json({ error: "Invalid channelId" }, { status: 400 });

  const existing = await prisma.trackedChannel.findUnique({ where: { channelId } });
  if (existing) return NextResponse.json({ channel: toDTO(existing), alreadyTracked: true });

  if ((await youtubeRemainingToday()) < 2) {
    return NextResponse.json({ error: "YouTube daily quota reached, try again tomorrow" }, { status: 429 });
  }

  const info = await getChannelById(channelId);
  await addUsage("youtube", 1);
  if (!info) return NextResponse.json({ error: "Channel not found" }, { status: 404 });

  const saved = await prisma.trackedChannel.create({
    data: {
      channelId: info.channelId,
      title: info.title,
      handle: info.handle,
      thumbnailUrl: info.thumbnailUrl,
      uploadsPlaylistId: info.uploadsPlaylistId,
      lookupQuery: (body.query ?? info.title).slice(0, 200),
    },
  });

  let videosAdded = 0;
  try {
    videosAdded = await syncChannelUploads(saved.channelId, saved.uploadsPlaylistId);
  } catch {
    // Not fatal: the next scheduled sync will pick it up.
  }
  return NextResponse.json({ channel: toDTO(saved), videosAdded });
}

/** DELETE /api/channels?channelId=UC... : stop tracking and drop its videos (free). */
export async function DELETE(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Admin key required" }, { status: 401 });
  const channelId = new URL(req.url).searchParams.get("channelId") ?? "";
  await prisma.trackedChannel.deleteMany({ where: { channelId } });
  return NextResponse.json({ ok: true });
}
