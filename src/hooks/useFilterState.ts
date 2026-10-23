"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { isValidLocationId } from "@/lib/locations";
import type { ChannelDTO, ContentType } from "@/lib/feed-types";

export type DatePreset = "any" | "1d" | "3d" | "7d" | "30d" | "custom";

export interface FilterState {
  version: 1;
  locations: string[];
  types: ContentType[];
  /** Relative presets are stored as presets, so "last 7 days" stays relative when you reopen the app. */
  datePreset: DatePreset;
  from: string | null; // YYYY-MM-DD, used when datePreset === "custom"
  to: string | null;
  /** Every channel chip you have added. */
  channels: ChannelDTO[];
  /** Chips currently switched on. Empty means show all channels. */
  activeChannelIds: string[];
}

export const DEFAULT_FILTERS: FilterState = {
  version: 1,
  locations: ["country:india"],
  types: ["text", "video"],
  datePreset: "7d",
  from: null,
  to: null,
  channels: [],
  activeChannelIds: [],
};

const STORAGE_KEY = "dailybugle:filters";

/** Accepts whatever is in storage and returns a valid state (drops unknown ids, fills missing fields). */
function migrate(raw: unknown): FilterState {
  if (!raw || typeof raw !== "object") return DEFAULT_FILTERS;
  const r = raw as Partial<FilterState>;
  const types = (Array.isArray(r.types) ? r.types : DEFAULT_FILTERS.types).filter((t): t is ContentType => t === "text" || t === "video");
  const channels = Array.isArray(r.channels) ? r.channels.filter((c) => c && typeof c.channelId === "string") : [];
  const ids = new Set(channels.map((c) => c.channelId));
  return {
    version: 1,
    locations: (Array.isArray(r.locations) ? r.locations : DEFAULT_FILTERS.locations).filter(isValidLocationId),
    types: types.length ? types : DEFAULT_FILTERS.types,
    datePreset: (["any", "1d", "3d", "7d", "30d", "custom"] as const).includes(r.datePreset as DatePreset)
      ? (r.datePreset as DatePreset)
      : DEFAULT_FILTERS.datePreset,
    from: typeof r.from === "string" ? r.from : null,
    to: typeof r.to === "string" ? r.to : null,
    channels,
    activeChannelIds: (Array.isArray(r.activeChannelIds) ? r.activeChannelIds : []).filter((id) => ids.has(id)),
  };
}

function localDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Turns the stored preset into concrete dates at request time. */
export function resolveDateRange(f: Pick<FilterState, "datePreset" | "from" | "to">): { from?: string; to?: string } {
  if (f.datePreset === "custom") return { from: f.from ?? undefined, to: f.to ?? undefined };
  if (f.datePreset === "any") return {};
  const days = { "1d": 1, "3d": 3, "7d": 7, "30d": 30 }[f.datePreset];
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  return { from: localDay(start) };
}

export function useFilterState() {
  const [filters, setFilters, { hydrated, reset }] = useLocalStorage<FilterState>(STORAGE_KEY, DEFAULT_FILTERS, migrate);

  const update = useCallback((patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch })), [setFilters]);

  const toggleIn = useCallback(
    <K extends "locations" | "types" | "activeChannelIds">(key: K, value: FilterState[K][number]) =>
      setFilters((f) => {
        const arr = f[key] as string[];
        const next = arr.includes(value as string) ? arr.filter((v) => v !== value) : [...arr, value as string];
        return { ...f, [key]: next };
      }),
    [setFilters],
  );

  const addChannel = useCallback(
    (c: ChannelDTO) =>
      setFilters((f) =>
        f.channels.some((x) => x.channelId === c.channelId)
          ? f
          : { ...f, channels: [...f.channels, c], activeChannelIds: f.activeChannelIds.length ? [...f.activeChannelIds, c.channelId] : [] },
      ),
    [setFilters],
  );

  const removeChannel = useCallback(
    (channelId: string) =>
      setFilters((f) => ({
        ...f,
        channels: f.channels.filter((c) => c.channelId !== channelId),
        activeChannelIds: f.activeChannelIds.filter((id) => id !== channelId),
      })),
    [setFilters],
  );

  /** Adds channels tracked on the server that this browser hasn't seen yet (e.g. added from your phone). */
  const mergeServerChannels = useCallback(
    (server: ChannelDTO[]) =>
      setFilters((f) => {
        const known = new Set(f.channels.map((c) => c.channelId));
        const extra = server.filter((c) => !known.has(c.channelId));
        return extra.length ? { ...f, channels: [...f.channels, ...extra] } : f;
      }),
    [setFilters],
  );

  /** Query string for /api/feed. */
  const query = useMemo(() => {
    const p = new URLSearchParams();
    p.set("types", filters.types.join(","));
    if (filters.locations.length) p.set("locations", filters.locations.join(","));
    const { from, to } = resolveDateRange(filters);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    const active = filters.activeChannelIds.length ? filters.activeChannelIds : filters.channels.map((c) => c.channelId);
    if (active.length) p.set("channels", active.join(","));
    return p.toString();
  }, [filters]);

  return { filters, hydrated, update, toggleIn, addChannel, removeChannel, mergeServerChannels, reset, query };
}
