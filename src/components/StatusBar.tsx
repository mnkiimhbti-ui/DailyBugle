"use client";

import { useEffect, useState } from "react";
import { timeAgo } from "@/components/Cards";
import type { StatusResponse } from "@/lib/feed-types";

export function StatusBar({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<StatusResponse | null>(null);
  useEffect(() => {
    fetch("/api/status")
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => {});
  }, []);
  if (!s) return null;
  const last = s.lastSync?.finishedAt ? `Updated ${timeAgo(s.lastSync.finishedAt)}` : "Not synced yet";
  if (compact) return <span className="text-xs text-muted">{last}</span>;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs text-muted">
      <span>{last}</span>
      <span>
        {s.counts.news} articles, {s.counts.videos} videos, {s.counts.channels} channels
      </span>
      <span>
        Tavily {s.tavilyUsedThisMonth}/{s.tavilyMonthlyBudget} credits this month
      </span>
      <span>YouTube {s.youtubeUsedToday}/10,000 units today</span>
    </div>
  );
}
