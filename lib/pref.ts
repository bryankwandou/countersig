import { useSyncExternalStore } from "react";

type Pref<T extends string> = { use: () => T | null; set: (v: T) => void };

// A localStorage-backed value read through useSyncExternalStore. The server snapshot is the fallback,
// so static prerendering and the first client render agree.
export function createPref<T extends string>(key: string, fallback: () => T, allowed: (v: string) => v is T): Pref<T> {
  const listeners = new Set<() => void>();
  let cached: T | null = null;
  const read = (): T => {
    if (cached) return cached;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(key);
    } catch {}
    cached = saved && allowed(saved) ? saved : fallback();
    return cached;
  };
  const subscribe = (fn: () => void) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
  };
  return {
    use: () => useSyncExternalStore<T | null>(subscribe, read, () => null),
    set: (v: T) => {
      cached = v;
      try {
        localStorage.setItem(key, v);
      } catch {}
      listeners.forEach((fn) => fn());
    },
  };
}
