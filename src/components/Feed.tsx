"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NewsCard, VideoCard } from "@/components/Cards";
import type { FeedItem, FeedResponse } from "@/lib/feed-types";

/** Fetches /api/feed (our own database only) with infinite scroll. */
export function Feed({ query, enabled, refreshToken }: { query: string; enabled: boolean; refreshToken: number }) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const load = useCallback(
    async (reset: boolean, from: string | null) => {
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const p = new URLSearchParams(query);
        if (!reset && from) p.set("cursor", from);
        if (refreshToken) p.set("r", String(refreshToken)); // bypasses the CDN cache after adding a channel
        const res = await fetch(`/api/feed?${p}`);
        if (!res.ok) throw new Error(`Feed failed (${res.status})`);
        const data = (await res.json()) as FeedResponse;
        if (id !== reqId.current) return; // a newer filter change won
        setItems((prev) => (reset ? data.items : [...prev, ...data.items.filter((i) => !prev.some((p) => p.id === i.id))]));
        setCursor(data.nextCursor);
        setDone(!data.nextCursor);
      } catch (e) {
        if (id === reqId.current) setError((e as Error).message);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [query, refreshToken],
  );

  // Filters changed: start over. Waits for localStorage to load so we don't fetch the defaults first.
  useEffect(() => {
    if (!enabled) return;
    setItems([]);
    setDone(false);
    load(true, null);
  }, [enabled, load]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || loading || !cursor) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && load(false, cursor), { rootMargin: "800px" });
    io.observe(el);
    return () => io.disconnect();
  }, [cursor, done, loading, load]);

  if (!enabled) return <Skeleton />;

  return (
    <div>
      {items.length === 0 && loading && <Skeleton />}
      {items.length === 0 && !loading && !error && (
        <div className="rounded-lg border border-dashed border-rule p-10 text-center">
          <p className="font-display text-xl">Nothing on the wire yet.</p>
          <p className="mt-2 text-sm text-muted">
            Try a wider date range or more locations. If this is a fresh install, run the sync workflow once from GitHub Actions.
          </p>
        </div>
      )}
      <div className="masonry">
        {items.map((it) => (it.kind === "text" ? <NewsCard key={it.id} item={it} /> : <VideoCard key={it.id} item={it} />))}
      </div>
      {error && (
        <p className="py-6 text-center text-sm text-accent">
          {error}.{" "}
          <button className="underline" onClick={() => load(items.length === 0, cursor)}>
            Retry
          </button>
        </p>
      )}
      <div ref={sentinel} className="h-8" />
      {loading && items.length > 0 && <p className="py-4 text-center text-sm text-muted">Loading more…</p>}
      {done && items.length > 0 && <p className="py-6 text-center text-xs uppercase tracking-widest text-muted">End of edition</p>}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="masonry">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-rule bg-card p-4">
          <div className="mb-3 aspect-video rounded bg-rule/60" />
          <div className="mb-2 h-4 w-3/4 rounded bg-rule/60" />
          <div className="h-3 w-1/2 rounded bg-rule/60" />
        </div>
      ))}
    </div>
  );
}
