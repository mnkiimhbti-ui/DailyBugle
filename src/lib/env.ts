function int(name: string, fallback: number): number {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}`);
  return v;
}

export const config = {
  tavilyQueriesPerSync: () => int("TAVILY_QUERIES_PER_SYNC", 16),
  tavilyMaxResults: () => Math.min(int("TAVILY_MAX_RESULTS", 20), 20),
  /** Hard monthly ceiling, kept under the 1,000 free credits. */
  tavilyMonthlyBudget: () => int("TAVILY_MONTHLY_BUDGET", 950),
  /** Hard daily ceiling, kept under the 10,000 free units. */
  youtubeDailyBudget: () => int("YOUTUBE_DAILY_BUDGET", 9000),
  maxChannelSearchesPerDay: () => int("MAX_CHANNEL_SEARCHES_PER_DAY", 20),
  videosPerChannel: () => Math.min(int("VIDEOS_PER_CHANNEL", 15), 50),
  retentionDays: () => int("RETENTION_DAYS", 30),
  priorityLocations: () =>
    (process.env.PRIORITY_LOCATIONS ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
};
