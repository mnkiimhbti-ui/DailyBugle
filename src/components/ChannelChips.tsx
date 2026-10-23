"use client";

import { useState } from "react";
import type { ChannelDTO } from "@/lib/feed-types";

interface SearchResult extends ChannelDTO {
  tracked: boolean;
  description?: string;
}

interface Props {
  channels: ChannelDTO[];
  activeIds: string[];
  adminKey: string;
  onNeedKey: () => void;
  onToggle: (channelId: string) => void;
  onAdded: (c: ChannelDTO) => void;
  onRemoved: (channelId: string) => void;
}

/**
 * Add YouTube channels as chips.
 * Paste a channel URL or @handle for a 1 unit lookup. Free text uses YouTube
 * search (100 units), so it only runs when you press Search, never as you type.
 * Tap a chip to include or exclude it from the feed. No chips switched on means all.
 */
export function ChannelChips({ channels, activeIds, adminKey, onNeedKey, onToggle, onAdded, onRemoved }: Props) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [lastCost, setLastCost] = useState<number | null>(null);

  const headers = { "x-admin-key": adminKey, "Content-Type": "application/json" };

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!adminKey) return onNeedKey();
    if (q.trim().length < 2) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/channels/search?q=${encodeURIComponent(q.trim())}`, { headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      setResults(data.results);
      setLastCost(data.cost);
      if (data.results.length === 0) setError("No channel found.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function add(r: SearchResult) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/channels", { method: "POST", headers, body: JSON.stringify({ channelId: r.channelId, query: q }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not add channel");
      onAdded(data.channel);
      setResults(null);
      setQ("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: ChannelDTO) {
    if (!adminKey) return onNeedKey();
    if (!confirm(`Stop tracking ${c.title}? Its saved videos will be removed.`)) return;
    const res = await fetch(`/api/channels?channelId=${c.channelId}`, { method: "DELETE", headers });
    if (res.ok) onRemoved(c.channelId);
    else setError((await res.json()).error ?? "Could not remove");
  }

  const active = new Set(activeIds);
  const allOn = activeIds.length === 0;

  return (
    <div>
      <form onSubmit={search} className="flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="@handle, channel URL or name"
          className="min-w-0 flex-1 rounded-md border border-rule bg-card px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <button
          disabled={busy || q.trim().length < 2}
          className="rounded-md bg-ink px-3 py-2 text-sm font-medium text-paper disabled:opacity-40"
        >
          {busy ? "…" : "Find"}
        </button>
      </form>
      <p className="mt-1 text-[11px] text-muted">A URL or @handle costs 1 quota unit. A name search costs 100.</p>

      {error && <p className="mt-2 text-xs text-accent">{error}</p>}

      {results && results.length > 0 && (
        <ul className="mt-2 divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card">
          {results.map((r) => (
            <li key={r.channelId} className="flex items-center gap-2 p-2">
              {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="h-8 w-8 shrink-0 rounded-full" />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title}</div>
                {r.description && <div className="truncate text-xs text-muted">{r.description}</div>}
              </div>
              {r.tracked && channels.some((c) => c.channelId === r.channelId) ? (
                <span className="text-xs text-muted">Added</span>
              ) : (
                <button onClick={() => (r.tracked ? (onAdded(r), setResults(null), setQ("")) : add(r))} className="text-xs font-semibold text-accent hover:underline">
                  Add
                </button>
              )}
            </li>
          ))}
          {lastCost != null && <li className="p-2 text-[11px] text-muted">This lookup used {lastCost} units.</li>}
        </ul>
      )}

      {channels.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {channels.map((c) => {
            const on = allOn || active.has(c.channelId);
            return (
              <span
                key={c.channelId}
                className={`inline-flex items-center gap-1.5 rounded-full border py-0.5 pl-0.5 pr-2 text-xs transition ${
                  on ? "border-ink bg-ink text-paper" : "border-rule bg-card text-muted"
                }`}
              >
                <button onClick={() => onToggle(c.channelId)} className="inline-flex items-center gap-1.5" title={on ? "Hide this channel" : "Show this channel"}>
                  {c.thumbnailUrl ? <img src={c.thumbnailUrl} alt="" className="h-5 w-5 rounded-full" /> : <span className="h-5 w-5" />}
                  <span className="max-w-36 truncate">{c.title}</span>
                </button>
                <button onClick={() => remove(c)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${c.title}`}>
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
      {channels.length > 1 && (
        <p className="mt-1.5 text-[11px] text-muted">{allOn ? "Showing all channels. Tap a chip to show only that one." : `${activeIds.length} of ${channels.length} channels shown.`}</p>
      )}
    </div>
  );
}
