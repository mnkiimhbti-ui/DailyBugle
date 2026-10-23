"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * SSR safe localStorage state.
 * Renders `initial` on the server and first client paint (no hydration
 * mismatch), then loads the stored value and keeps it in sync, including
 * across tabs. Storage can throw (private mode, quota), so every access is
 * guarded and the app keeps working without persistence.
 */
export function useLocalStorage<T>(key: string, initial: T, migrate?: (stored: unknown) => T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);
  const initialRef = useRef(initial);
  const migrateRef = useRef(migrate);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw != null) {
        const parsed = JSON.parse(raw) as unknown;
        setValue(migrateRef.current ? migrateRef.current(parsed) : (parsed as T));
      }
    } catch {
      setValue(initialRef.current);
    }
    setHydrated(true);
  }, [key]);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value, hydrated]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue == null) return;
      try {
        const parsed = JSON.parse(e.newValue) as unknown;
        setValue(migrateRef.current ? migrateRef.current(parsed) : (parsed as T));
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [key]);

  const reset = useCallback(() => setValue(initialRef.current), []);
  return [value, setValue, { hydrated, reset }] as const;
}
