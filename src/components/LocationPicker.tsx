"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DISTRICT_NODES, LOCATION_BY_ID, LOCATIONS, LOCATION_GROUPS, districtsOfState, type LocationNode } from "@/lib/locations";

interface Props {
  selected: string[];
  onToggle: (id: string) => void;
  onSet: (ids: string[]) => void;
}

/**
 * Searchable, grouped multi select:
 * Global, Regional (13), Country, States and UTs (36), Districts (700+).
 * Districts are listed for the states you've selected, or by search.
 */
export function LocationPicker({ selected, onToggle, onSet }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const sel = useMemo(() => new Set(selected), [selected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (l: LocationNode) =>
      !needle || l.label.toLowerCase().includes(needle) || (l.parentLabel ?? "").toLowerCase().includes(needle);

    const selectedStates = selected.filter((id) => id.startsWith("state:"));
    const districtPool = needle
      ? DISTRICT_NODES
      : selectedStates.flatMap((s) => districtsOfState(s));

    return LOCATION_GROUPS.map((g) => {
      const items = (g.kind === "district" ? districtPool : LOCATIONS.filter((l) => l.kind === g.kind)).filter(match);
      return { ...g, items: g.kind === "district" && needle ? items.slice(0, 80) : items };
    }).filter((g) => g.items.length);
  }, [q, selected]);

  const summary =
    selected.length === 0
      ? "Everywhere"
      : selected.length <= 2
        ? selected.map((id) => LOCATION_BY_ID.get(id)?.label ?? id).join(", ")
        : `${LOCATION_BY_ID.get(selected[0])?.label} +${selected.length - 1}`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-rule bg-card px-3 py-2 text-left text-sm hover:border-ink/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className="truncate">{summary}</span>
        <svg width="14" height="14" viewBox="0 0 20 20" className={`shrink-0 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          <path d="M5 7l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      </button>

      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selected.map((id) => (
            <button
              key={id}
              onClick={() => onToggle(id)}
              className="group inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-ink"
              title="Remove"
            >
              {LOCATION_BY_ID.get(id)?.label}
              <span className="text-muted group-hover:text-accent" aria-hidden>
                ×
              </span>
            </button>
          ))}
          <button onClick={() => onSet([])} className="text-xs text-muted underline-offset-2 hover:underline">
            Clear
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-30 mt-1 w-full min-w-72 overflow-hidden rounded-md border border-rule bg-card shadow-xl">
          <div className="border-b border-rule p-2">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search region, state or district"
              className="w-full rounded border border-rule bg-paper px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div className="max-h-96 overflow-y-auto py-1">
            {groups.map((g) => (
              <div key={g.kind} className="py-1">
                <div className="flex items-center justify-between px-3 py-1">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{g.title}</span>
                  {g.kind === "region" && !q && (
                    <button
                      className="text-[11px] text-accent hover:underline"
                      onClick={() => {
                        const ids = g.items.map((i) => i.id);
                        const all = ids.every((id) => sel.has(id));
                        onSet(all ? selected.filter((id) => !ids.includes(id)) : [...new Set([...selected, ...ids])]);
                      }}
                    >
                      {g.items.every((i) => sel.has(i.id)) ? "None" : "All"}
                    </button>
                  )}
                </div>
                {g.items.map((l) => (
                  <label key={l.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm hover:bg-paper">
                    <input type="checkbox" checked={sel.has(l.id)} onChange={() => onToggle(l.id)} className="accent-[var(--color-accent)]" />
                    <span className="truncate">{l.label}</span>
                    {l.parentLabel && <span className="ml-auto shrink-0 text-xs text-muted">{l.parentLabel}</span>}
                  </label>
                ))}
              </div>
            ))}
            {!q && !selected.some((id) => id.startsWith("state:")) && (
              <p className="px-3 py-2 text-xs text-muted">Select a state to list its districts, or search any district by name.</p>
            )}
            {groups.length === 0 && <p className="px-3 py-4 text-sm text-muted">No match.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
