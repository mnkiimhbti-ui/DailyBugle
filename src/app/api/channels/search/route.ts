import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthorized } from "@/lib/auth";
import { addUsage, channelSearchesLeftToday, youtubeRemainingToday } from "@/lib/quota";
import { classifyChannelInput, getChannelByHandle, getChannelById, searchChannels, type ChannelInfo } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/**
 * GET /api/channels/search?q=...
 * The ONLY place the expensive search.list (100 units) is used, and only for
 * free text. Pasting a channel URL, @handle or UC id costs 1 unit instead.
 * Already tracked channels are matched locally first and cost nothing.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Admin key required" }, { status: 401 });
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ error: "Type at least 2 characters" }, { status: 400 });

  const input = classifyChannelInput(q);

  // Free: already tracked?
  const local = await prisma.trackedChannel.findMany({
    where:
      input.kind === "id"
        ? { channelId: input.value }
        : input.kind === "handle"
          ? { handle: { equals: input.value, mode: "insensitive" } }
          : { OR: [{ title: { contains: q, mode: "insensitive" } }, { lookupQuery: { equals: q, mode: "insensitive" } }] },
    take: 5,
  });
  if (local.length && input.kind !== "search") {
    return NextResponse.json({ results: local.map((c) => ({ ...c, tracked: true })), cost: 0 });
  }

  let results: ChannelInfo[] = [];
  let cost = 0;
  try {
    if (input.kind === "id" || input.kind === "handle") {
      if ((await youtubeRemainingToday()) < 1) return quotaError();
      const ch = input.kind === "id" ? await getChannelById(input.value) : await getChannelByHandle(input.value);
      cost = 1;
      await addUsage("youtube", 1);
      results = ch ? [ch] : [];
    } else {
      if ((await channelSearchesLeftToday()) < 1 || (await youtubeRemainingToday()) < 100) return quotaError();
      results = await searchChannels(input.value);
      cost = 100;
      await addUsage("youtube-search", 100);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }

  const trackedIds = new Set(local.map((c) => c.channelId));
  return NextResponse.json({
    results: [
      ...local.map((c) => ({ ...c, tracked: true })),
      ...results.filter((r) => !trackedIds.has(r.channelId)).map((r) => ({ ...r, tracked: false })),
    ],
    cost,
  });
}

function quotaError() {
  return NextResponse.json(
    { error: "Daily YouTube search limit reached. Paste the channel URL or @handle instead (costs 1 unit), or try tomorrow." },
    { status: 429 },
  );
}
