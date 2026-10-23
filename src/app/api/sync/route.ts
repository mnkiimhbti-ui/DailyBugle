import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { runSync } from "@/lib/sync";

/**
 * POST /api/sync  (x-admin-key header)  : manual sync from the UI.
 * GET  /api/sync  (Authorization: Bearer CRON_SECRET) : optional Vercel Cron.
 *
 * The scheduled sync normally runs in GitHub Actions (scripts/sync.ts). This
 * route exists for manual runs. Vercel Hobby functions stop at 60s, so the
 * route syncs only what fits; Actions has no such limit.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: Request, trigger: string) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = new URL(req.url).searchParams.get("mode");
  const report = await runSync(trigger, { news: mode !== "videos", videos: mode !== "news" });
  return NextResponse.json(report);
}

export const POST = (req: Request) => handle(req, "manual-api");
export const GET = (req: Request) => handle(req, "vercel-cron");
