import { prisma } from "@/lib/db";
import { config } from "@/lib/env";
import { LOCATION_BY_ID, LOCATIONS, isValidLocationId } from "@/lib/locations";
import { tagArticle } from "@/lib/mentions";
import { addUsage, tavilyRemainingThisMonth, youtubeRemainingToday } from "@/lib/quota";
import { firstImage, tavilyNewsSearch } from "@/lib/tavily";
import { getLatestUploads } from "@/lib/youtube";

export interface SyncReport {
  newsAdded: number;
  videosAdded: number;
  tavilyUsed: number;
  youtubeUsed: number;
  locationsSearched: string[];
  errors: string[];
}

const ALWAYS = ["global", "country:india"];

/**
 * Picks which locations to search this run, within budget:
 *   1. Global and India every run
 *   2. PRIORITY_LOCATIONS every run (e.g. your home district)
 *   3. The remaining budget rotates through regions and states,
 *      least recently searched first, so every region and state is
 *      covered every couple of days.
 */
export async function planNewsQueries(budget: number): Promise<string[]> {
  if (budget <= 0) return [];
  const fixed = [...ALWAYS, ...config.priorityLocations().filter(isValidLocationId)];
  const plan: string[] = [];
  for (const id of fixed) if (!plan.includes(id) && plan.length < budget) plan.push(id);

  const pool = LOCATIONS.filter((l) => (l.kind === "region" || l.kind === "state") && !plan.includes(l.id)).map((l) => l.id);
  const cursors = await prisma.locationCursor.findMany({ where: { locationId: { in: pool } } });
  const last = new Map(cursors.map((c) => [c.locationId, c.lastQueriedAt.getTime()]));
  pool.sort((a, b) => (last.get(a) ?? 0) - (last.get(b) ?? 0));

  for (const id of pool) {
    if (plan.length >= budget) break;
    plan.push(id);
  }
  return plan;
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function parseDate(s?: string): Date {
  const d = s ? new Date(s) : new Date();
  return Number.isNaN(d.getTime()) || d.getTime() > Date.now() + 86_400_000 ? new Date() : d;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function syncNews(report: SyncReport): Promise<void> {
  const remaining = await tavilyRemainingThisMonth();
  const budget = Math.min(config.tavilyQueriesPerSync(), remaining);
  if (budget === 0) {
    report.errors.push("Tavily monthly budget exhausted, skipping news");
    return;
  }
  const plan = await planNewsQueries(budget);

  for (const locationId of plan) {
    const node = LOCATION_BY_ID.get(locationId)!;
    const cursor = await prisma.locationCursor.findUnique({ where: { locationId } });
    // Ask only for news since the last time this location was searched (1 day overlap), max 7 days back.
    const sevenDaysAgo = Date.now() - 7 * 86_400_000;
    const since = cursor ? Math.max(cursor.lastQueriedAt.getTime() - 86_400_000, sevenDaysAgo) : sevenDaysAgo;

    try {
      const { results, credits } = await tavilyNewsSearch(node.query, {
        startDate: isoDay(new Date(since)),
        maxResults: config.tavilyMaxResults(),
      });
      report.tavilyUsed += credits;
      await addUsage("tavily", credits);
      report.locationsSearched.push(locationId);

      const rows = results
        .filter((r) => r.url && r.title)
        .map((r) => ({
          url: r.url,
          title: r.title.slice(0, 300),
          snippet: (r.content ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
          imageUrl: firstImage(r),
          faviconUrl: r.favicon ?? null,
          source: hostOf(r.url),
          publishedAt: parseDate(r.published_date),
          score: r.score ?? null,
          locations: tagArticle(locationId, `${r.title} ${r.content ?? ""}`),
        }));

      if (rows.length) {
        const existing = await prisma.newsItem.findMany({
          where: { url: { in: rows.map((r) => r.url) } },
          select: { url: true },
        });
        const existingSet = new Set(existing.map((e) => e.url));
        const fresh = rows.filter((r) => !existingSet.has(r.url));
        if (fresh.length) {
          const created = await prisma.newsItem.createMany({ data: fresh, skipDuplicates: true });
          report.newsAdded += created.count;
        }
        // Same story found under another location: merge the location tags.
        for (const r of rows.filter((r) => existingSet.has(r.url))) {
          await prisma.$executeRaw`
            UPDATE "NewsItem"
            SET locations = ARRAY(SELECT DISTINCT unnest(locations || ${r.locations}::text[]))
            WHERE url = ${r.url}`;
        }
      }

      await prisma.locationCursor.upsert({
        where: { locationId },
        create: { locationId, lastQueriedAt: new Date(), lastResultCount: rows.length },
        update: { lastQueriedAt: new Date(), lastResultCount: rows.length },
      });
    } catch (e) {
      const err = e as Error & { status?: number };
      report.errors.push(`news ${locationId}: ${err.message}`);
      // Rate limited, out of credits or bad key: stop spending, try again next run.
      if (err.status === 401 || err.status === 429 || err.status === 432 || err.status === 433) break;
    }
  }
}

async function syncVideos(report: SyncReport): Promise<void> {
  const channels = await prisma.trackedChannel.findMany({ orderBy: { lastSyncedAt: { sort: "asc", nulls: "first" } } });
  let remaining = await youtubeRemainingToday();
  for (const ch of channels) {
    if (remaining < 1) {
      report.errors.push("YouTube daily budget reached, remaining channels wait for next run");
      break;
    }
    try {
      const added = await syncChannelUploads(ch.channelId, ch.uploadsPlaylistId);
      report.videosAdded += added;
      report.youtubeUsed += 1;
      remaining -= 1;
    } catch (e) {
      const err = e as Error & { quota?: boolean };
      report.errors.push(`video ${ch.title}: ${err.message}`);
      if (err.quota) break;
    }
  }
}

/** 1 YouTube unit. Shared by the cron and by "add channel". */
export async function syncChannelUploads(channelId: string, uploadsPlaylistId: string): Promise<number> {
  const videos = await getLatestUploads(uploadsPlaylistId, config.videosPerChannel());
  await addUsage("youtube", 1);
  const created = await prisma.videoItem.createMany({
    data: videos.map((v) => ({ ...v, channelId })),
    skipDuplicates: true,
  });
  await prisma.trackedChannel.update({ where: { channelId }, data: { lastSyncedAt: new Date() } });
  return created.count;
}

async function cleanup(report: SyncReport): Promise<void> {
  const cutoff = new Date(Date.now() - config.retentionDays() * 86_400_000);
  try {
    await prisma.newsItem.deleteMany({ where: { publishedAt: { lt: cutoff } } });
    await prisma.videoItem.deleteMany({ where: { publishedAt: { lt: cutoff } } });
    await prisma.apiUsage.deleteMany({ where: { day: { lt: cutoff.toISOString().slice(0, 7) + "-01" } } });
    await prisma.syncLog.deleteMany({ where: { startedAt: { lt: cutoff } } });
  } catch (e) {
    report.errors.push(`cleanup: ${(e as Error).message}`);
  }
}

export async function runSync(trigger: string, opts: { news?: boolean; videos?: boolean } = {}): Promise<SyncReport> {
  const report: SyncReport = { newsAdded: 0, videosAdded: 0, tavilyUsed: 0, youtubeUsed: 0, locationsSearched: [], errors: [] };
  const log = await prisma.syncLog.create({ data: { trigger } });
  try {
    if (opts.news !== false) await syncNews(report);
    if (opts.videos !== false) await syncVideos(report);
    await cleanup(report);
  } finally {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        newsAdded: report.newsAdded,
        videosAdded: report.videosAdded,
        tavilyUsed: report.tavilyUsed,
        youtubeUsed: report.youtubeUsed,
        errors: report.errors,
      },
    });
  }
  return report;
}
