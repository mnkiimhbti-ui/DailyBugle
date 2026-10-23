"use client";

import { ChannelChips } from "@/components/ChannelChips";
import { LocationPicker } from "@/components/LocationPicker";
import type { DatePreset, useFilterState } from "@/hooks/useFilterState";
import type { ContentType } from "@/lib/feed-types";

type FS = ReturnType<typeof useFilterState>;

const PRESETS: { id: DatePreset; label: string }[] = [
  { id: "1d", label: "Today" },
  { id: "3d", label: "3 days" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "any", label: "Any" },
  { id: "custom", label: "Custom" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-rule py-4 first:border-t-0 first:pt-0">
      <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{title}</h2>
      {children}
    </section>
  );
}

export function FilterPanel({ fs, adminKey, onNeedKey, onChannelAdded }: { fs: FS; adminKey: string; onNeedKey: () => void; onChannelAdded: () => void }) {
  const { filters, update, toggleIn } = fs;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div>
      <Section title="Location">
        <LocationPicker selected={filters.locations} onToggle={(id) => toggleIn("locations", id)} onSet={(ids) => update({ locations: ids })} />
      </Section>

      <Section title="Content type">
        <div className="flex gap-4">
          {(["text", "video"] as ContentType[]).map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={filters.types.includes(t)}
                onChange={() => {
                  // Keep at least one type on, an empty feed by accident is confusing.
                  if (filters.types.length === 1 && filters.types[0] === t) return;
                  toggleIn("types", t);
                }}
                className="h-4 w-4 accent-[var(--color-accent)]"
              />
              {t === "text" ? "Articles" : "Videos"}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Date range">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => update({ datePreset: p.id })}
              className={`rounded-full border px-2.5 py-1 text-xs transition ${
                filters.datePreset === p.id ? "border-ink bg-ink text-paper" : "border-rule bg-card hover:border-ink/40"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {filters.datePreset === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <label className="text-xs text-muted">
              From
              <input
                type="date"
                max={filters.to ?? today}
                value={filters.from ?? ""}
                onChange={(e) => update({ from: e.target.value || null })}
                className="mt-1 w-full rounded-md border border-rule bg-card px-2 py-1.5 text-sm text-ink"
              />
            </label>
            <label className="text-xs text-muted">
              To
              <input
                type="date"
                min={filters.from ?? undefined}
                max={today}
                value={filters.to ?? ""}
                onChange={(e) => update({ to: e.target.value || null })}
                className="mt-1 w-full rounded-md border border-rule bg-card px-2 py-1.5 text-sm text-ink"
              />
            </label>
          </div>
        )}
        <p className="mt-2 text-[11px] text-muted">Stories are kept for 30 days.</p>
      </Section>

      <Section title="YouTube channels">
        <ChannelChips
          channels={filters.channels}
          activeIds={filters.activeChannelIds}
          adminKey={adminKey}
          onNeedKey={onNeedKey}
          onToggle={(id) => toggleIn("activeChannelIds", id)}
          onAdded={(c) => {
            fs.addChannel(c);
            onChannelAdded();
          }}
          onRemoved={(id) => {
            fs.removeChannel(id);
            onChannelAdded();
          }}
        />
      </Section>

      <div className="border-t border-rule pt-4">
        <button onClick={fs.reset} className="text-xs text-muted underline-offset-2 hover:text-accent hover:underline">
          Reset all filters
        </button>
      </div>
    </div>
  );
}
