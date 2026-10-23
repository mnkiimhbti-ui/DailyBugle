import { prisma } from "@/lib/db";
import { config } from "@/lib/env";

export type Api = "tavily" | "youtube" | "youtube-search";

export function utcDay(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function addUsage(api: Api, units: number): Promise<void> {
  if (units <= 0) return;
  const day = utcDay();
  await prisma.apiUsage.upsert({
    where: { day_api: { day, api } },
    create: { day, api, units },
    update: { units: { increment: units } },
  });
}

export async function usageToday(api: Api): Promise<number> {
  const row = await prisma.apiUsage.findUnique({ where: { day_api: { day: utcDay(), api } } });
  return row?.units ?? 0;
}

export async function tavilyUsedThisMonth(): Promise<number> {
  const month = utcDay().slice(0, 7);
  const agg = await prisma.apiUsage.aggregate({
    _sum: { units: true },
    where: { api: "tavily", day: { startsWith: month } },
  });
  return agg._sum.units ?? 0;
}

export async function tavilyRemainingThisMonth(): Promise<number> {
  return Math.max(0, config.tavilyMonthlyBudget() - (await tavilyUsedThisMonth()));
}

/** YouTube quota resets at midnight Pacific; tracking per UTC day is a conservative approximation. */
export async function youtubeRemainingToday(): Promise<number> {
  const used = (await usageToday("youtube")) + (await usageToday("youtube-search"));
  return Math.max(0, config.youtubeDailyBudget() - used);
}

export async function channelSearchesLeftToday(): Promise<number> {
  // youtube-search is stored in units (100 per search)
  const used = Math.round((await usageToday("youtube-search")) / 100);
  return Math.max(0, config.maxChannelSearchesPerDay() - used);
}
