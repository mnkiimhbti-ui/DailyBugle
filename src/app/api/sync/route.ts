import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { recentSync, runSync } from "@/lib/sync";

/**
 * POST /api/sync  (x-admin-key header)  : the "Refresh now" button.
 * GET  /api/sync  (Authorization: Bearer CRON_SECRET) : optional Vercel Cron.
 *
 * The scheduled sync runs in GitHub Actions (scripts/sync.ts). Searches run in
 * parallel so a manual run fits inside the 60s Vercel Hobby limit.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Blocks double clicks and overlap with the scheduled run, both of which would waste credits. */
const COOLDOWN_MINUTES = 15;

async function handle(req: Request, trigger: string) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const recent = await recentSync(COOLDOWN_MINUTES);
  if (recent) {
    const msg = recent.finishedAt
      ? `Already refreshed ${Math.max(1, Math.round((Date.now() - recent.finishedAt.getTime()) / 60_000))} min ago. Try again in a few minutes.`
      : "A refresh is already running. Give it a minute.";
    return NextResponse.json({ error: msg }, { status: 429 });
  }

  const mode = new URL(req.url).searchParams.get("mode");
  const report = await runSync(trigger, { news: mode !== "videos", videos: mode !== "news" });
  return NextResponse.json(report);
}

export const POST = (req: Request) => handle(req, "manual-app");
export const GET = (req: Request) => handle(req, "vercel-cron");
