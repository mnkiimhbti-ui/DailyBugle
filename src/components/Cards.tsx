"use client";

import { useState } from "react";
import { LOCATION_BY_ID } from "@/lib/locations";
import type { NewsDTO, VideoDTO } from "@/lib/feed-types";

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 7 * 86400) return `${Math.round(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/** Most specific tag first (district, then state, region...), at most two. */
function placeLabels(tags: string[]): string[] {
  const rank = (id: string) => (id.startsWith("district:") ? 0 : id.startsWith("state:") ? 1 : id.startsWith("country:") ? 2 : id.startsWith("region:") ? 3 : 4);
  return [...tags]
        .sort((a, b) => rank(a) - rank(b))
    .slice(0, 2)
    .map((t) => LOCATION_BY_ID.get(t)?.label ?? t);
}

export function NewsCard({ item }: { item: NewsDTO }) {
  const [imgOk, setImgOk] = useState(Boolean(item.imageUrl));
  return (
    <article className="overflow-hidden rounded-lg border border-rule bg-card transition hover:shadow-md">
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="block">
        {imgOk && item.imageUrl && (
          <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setImgOk(false)} className="aspect-[16/9] w-full object-cover" />
        )}
        <div className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted">
            {item.faviconUrl && <img src={item.faviconUrl} alt="" className="h-3.5 w-3.5" referrerPolicy="no-referrer" />}
            <span className="truncate">{item.source}</span>
            <span aria-hidden>·</span>
            <time dateTime={item.publishedAt} className="shrink-0">
              {timeAgo(item.publishedAt)}
            </time>
          </div>
          <h3 className="font-display text-lg font-semibold leading-snug">{item.title}</h3>
          {item.snippet && <p className="line-clamp-3 mt-2 text-sm text-muted">{item.snippet}</p>}
          <div className="mt-3 flex flex-wrap gap-1">
            {placeLabels(item.locations).map((l) => (
              <span key={l} className="rounded bg-paper px-1.5 py-0.5 text-[11px] text-muted">
                {l}
              </span>
            ))}
          </div>
        </div>
      </a>
    </article>
  );
}

export function VideoCard({ item }: { item: VideoDTO }) {
  const [playing, setPlaying] = useState(false);
  return (
    <article className="overflow-hidden rounded-lg border border-rule bg-card transition hover:shadow-md">
      <div className="relative aspect-video bg-black">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${item.videoId}?autoplay=1&rel=0`}
            title={item.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          // Thumbnail first, iframe on click: loading dozens of embeds would be slow and heavy.
          <button onClick={() => setPlaying(true)} className="group absolute inset-0" aria-label={`Play ${item.title}`}>
            {item.thumbnailUrl && <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
            <span className="absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/30">
              <span className="flex h-12 w-16 items-center justify-center rounded-xl bg-accent shadow-lg">
                <svg width="18" height="18" viewBox="0 0 20 20" fill="white" aria-hidden>
                  <path d="M6 4l10 6-10 6z" />
                </svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="p-4">
        <div className="mb-2 flex items-center gap-2 text-xs text-muted">
          <span className="rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">Video</span>
          <span className="truncate">{item.channelTitle}</span>
          <span aria-hidden>·</span>
          <time dateTime={item.publishedAt} className="shrink-0">
            {timeAgo(item.publishedAt)}
          </time>
        </div>
        <a href={`https://www.youtube.com/watch?v=${item.videoId}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
          <h3 className="font-display text-lg font-semibold leading-snug">{item.title}</h3>
        </a>
      </div>
    </article>
  );
}
