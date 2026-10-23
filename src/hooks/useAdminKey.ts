"use client";

import { useLocalStorage } from "@/hooks/useLocalStorage";

/** Stored only in this browser. Sent as x-admin-key for quota spending actions. */
export function useAdminKey() {
  const [key, setKey] = useLocalStorage<string>("dailybugle:admin-key", "");
  return { adminKey: key, setAdminKey: setKey };
}
