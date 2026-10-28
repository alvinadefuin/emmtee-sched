"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "emmtee:me";
const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice lasts for this tab only.
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The volunteer this device belongs to, remembered between visits. */
export function useMe(): [number | null, (id: number | null) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((id: number | null) => {
    memory = id === null ? null : String(id);
    try {
      if (id === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(id));
    } catch {
      // Storage blocked; `memory` still holds the choice.
    }
    listeners.forEach((l) => l());
  }, []);
  return [raw ? Number(raw) : null, set];
}
