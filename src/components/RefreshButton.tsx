"use client";

import { useState } from "react";

interface Report {
  newsAdded: number;
  videosAdded: number;
  tavilyUsed: number;
  errors: string[];
}

/**
 * Manual sync. Only shown once the admin key is saved, because each press
 * spends about 16 Tavily credits (1,000 free a month).
 */
export function RefreshButton({ adminKey, onDone }: { adminKey: string; onDone: () => void }) {
  const [state, setState] = useState<"idle" | "running">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (!confirm("Fetch fresh news and videos now? This uses about 16 of your 1,000 monthly Tavily credits.")) return;
    setState("running");
    setMsg(null);
    try {
      const res = await fetch("/api/sync", { method: "POST", headers: { "x-admin-key": adminKey } });
      const data = (await res.json()) as Report & { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Refresh failed (${res.status})`);
      setMsg(`${data.newsAdded} new articles, ${data.videosAdded} new videos${data.errors.length ? `, ${data.errors.length} warnings` : ""}`);
      onDone();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setState("idle");
      setTimeout(() => setMsg(null), 8000);
    }
  }

  return (
    <span className="relative inline-flex items-center">
      <button onClick={run} disabled={state === "running"} className="hover:text-accent disabled:opacity-50">
        {state === "running" ? "Refreshing…" : "Refresh now"}
      </button>
      {msg && (
        <span className="absolute right-0 top-6 z-30 w-64 rounded-md border border-rule bg-card p-2 text-left text-xs normal-case tracking-normal text-ink shadow-lg">
          {msg}
        </span>
      )}
    </span>
  );
}
