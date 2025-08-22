"use client";

import { useEffect, useState } from "react";

/**
 * Typed localStorage hook with SSR safety.
 */
export default function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => initial);

  // Read once on mount (guard for SSR)
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) {
        const parsed = JSON.parse(raw) as T;
        setValue(parsed);
      }
    } catch {
      // ignore parse/storage errors
    }
  }, [key]);

  // Persist whenever it changes
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // ignore quota/storage errors
    }
  }, [key, value]);

  return [value, setValue] as const;
}
