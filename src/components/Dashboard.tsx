"use client";

import { useEffect, useState } from "react";
import { Feed } from "@/components/Feed";
import { FilterPanel } from "@/components/FilterPanel";
import { StatusBar } from "@/components/StatusBar";
import { useAdminKey } from "@/hooks/useAdminKey";
import { useFilterState } from "@/hooks/useFilterState";
import type { ChannelDTO } from "@/lib/feed-types";

export function Dashboard() {
  const fs = useFilterState();
  const { adminKey, setAdminKey } = useAdminKey();
  const [drawer, setDrawer] = useState(false);
  const [keyDialog, setKeyDialog] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  // Pull channels tracked on the server (database read only) so a new device sees your chips.
  const { mergeServerChannels, hydrated } = fs;
  useEffect(() => {
    if (!hydrated) return;
    fetch("/api/channels")
      .then((r) => (r.ok ? r.json() : { channels: [] }))
      .then((d: { channels: ChannelDTO[] }) => mergeServerChannels(d.channels))
      .catch(() => {});
  }, [hydrated, mergeServerChannels]);

  const activeCount =
    fs.filters.locations.length + (fs.filters.types.length < 2 ? 1 : 0) + (fs.filters.datePreset !== "any" ? 1 : 0) + fs.filters.activeChannelIds.length;

  const panel = (
    <FilterPanel fs={fs} adminKey={adminKey} onNeedKey={() => setKeyDialog(true)} onChannelAdded={() => setRefreshToken(Date.now())} />
  );

  const dateline = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-[1400px] px-4 sm:px-6">
      <header className="border-b-4 border-double border-ink pb-3 pt-6 text-center">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-muted">
          <span className="hidden sm:inline">{dateline}</span>
          <span className="sm:hidden">{new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
          <button onClick={() => setKeyDialog(true)} className="hover:text-accent">
            {adminKey ? "Admin ✓" : "Admin"}
          </button>
        </div>
        <h1 className="font-display mt-2 text-4xl font-black tracking-tight sm:text-6xl">The Daily Bugle</h1>
        <p className="mt-1 text-xs italic text-muted">From the world to your district. Updated at dawn and dusk.</p>
      </header>

      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between border-b border-rule bg-paper/95 px-4 py-2 backdrop-blur lg:hidden">
        <button onClick={() => setDrawer(true)} className="rounded-md border border-rule bg-card px-3 py-1.5 text-sm">
          Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        <StatusBar compact />
      </div>

      <div className="grid gap-8 py-6 lg:grid-cols-[300px_1fr]">
        <aside className="hidden lg:block">
          <div className="sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto pr-1">{panel}</div>
        </aside>
        <main>
          <Feed query={fs.query} enabled={fs.hydrated} refreshToken={refreshToken} />
        </main>
      </div>

      <footer className="hidden border-t border-rule py-4 lg:block">
        <StatusBar />
      </footer>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 w-[88%] max-w-sm overflow-y-auto bg-paper p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-xl font-bold">Filters</span>
              <button onClick={() => setDrawer(false)} className="text-sm text-muted">
                Done
              </button>
            </div>
            {panel}
          </div>
        </div>
      )}

      {keyDialog && <AdminKeyDialog value={adminKey} onSave={setAdminKey} onClose={() => setKeyDialog(false)} />}
    </div>
  );
}

function AdminKeyDialog({ value, onSave, onClose }: { value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave(v.trim());
          onClose();
        }}
        className="relative w-full max-w-sm rounded-lg border border-rule bg-card p-5 shadow-2xl"
      >
        <h2 className="font-display text-xl font-bold">Admin key</h2>
        <p className="mt-1 text-sm text-muted">
          Needed to add or remove channels, since those spend YouTube quota. It is the ADMIN_KEY you set in Vercel, and is saved only in this browser.
        </p>
        <input
          type="password"
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          className="mt-3 w-full rounded-md border border-rule bg-paper px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <div className="mt-4 flex justify-end gap-2">
          {value && (
            <button type="button" onClick={() => (onSave(""), onClose())} className="mr-auto text-sm text-muted hover:text-accent">
              Forget key
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-md px-3 py-1.5 text-sm">
            Cancel
          </button>
          <button className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper">Save</button>
        </div>
      </form>
    </div>
  );
}
