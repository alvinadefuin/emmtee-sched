"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_MS = 10_000;
// While a refresh waits for the page to become safe, how often to look again (no network).
const RETRY_MS = 1_000;

/**
 * Keeps the page current: while the tab is visible, polls `url` (a version endpoint
 * returning `{ v }`) every 10 s and calls `router.refresh()` when the version changes.
 * Checks at once when the tab becomes visible again, gains focus or comes back online.
 * `pauseWhile` lets a page hold a refresh back (e.g. while a form is being edited);
 * the refresh is applied as soon as it returns false.
 */
export function LiveRefresh({ url, pauseWhile }: { url: string; pauseWhile?: () => boolean }) {
  const router = useRouter();
  // Read through a ref so a new function each render does not restart the polling.
  const pauseRef = useRef(pauseWhile);
  useEffect(() => {
    pauseRef.current = pauseWhile;
  }, [pauseWhile]);

  useEffect(() => {
    let known: string | null = null;
    let pending = false;
    let inFlight = false;
    let disposed = false;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setInterval> | null = null;

    const visible = () => document.visibilityState === "visible";

    const applyIfSafe = () => {
      if (!pending || disposed) return;
      if (pauseRef.current?.()) {
        retryTimer ??= setInterval(applyIfSafe, RETRY_MS);
        return;
      }
      pending = false;
      if (retryTimer) clearInterval(retryTimer);
      retryTimer = null;
      router.refresh();
    };

    const check = async () => {
      if (inFlight || disposed || !visible()) return;
      inFlight = true;
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) return;
        const { v } = (await res.json()) as { v?: unknown };
        if (typeof v !== "string" || disposed) return;
        if (known !== null && v !== known) {
          pending = true;
          applyIfSafe();
        }
        known = v;
      } catch {
        // Offline or a server hiccup: try again on the next tick.
      } finally {
        inFlight = false;
      }
    };

    const start = () => {
      pollTimer ??= setInterval(check, POLL_MS);
    };
    const stop = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const onVisibility = () => {
      if (visible()) {
        start();
        void check();
      } else {
        stop();
      }
    };
    const onWake = () => void check();

    if (visible()) start();
    void check();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onWake);
    window.addEventListener("online", onWake);
    return () => {
      disposed = true;
      stop();
      if (retryTimer) clearInterval(retryTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onWake);
      window.removeEventListener("online", onWake);
    };
  }, [url, router]);

  return null;
}
