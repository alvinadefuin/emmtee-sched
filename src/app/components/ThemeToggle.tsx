"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { THEME_COLOR, THEME_KEY, type ThemeName } from "@/app/theme";

const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice lasts for this tab only.
let memory: ThemeName | null = null;

function stored(): ThemeName {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    // Storage blocked; fall through.
  }
  return memory ?? "dark";
}

const current = (): ThemeName => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark");

function apply(theme: ThemeName) {
  document.documentElement.setAttribute("data-theme", theme);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[theme]);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, current, () => "dark" as const);

  // The head script sets the theme before paint; this re-applies it after React's dev remount
  // resets <html> attributes, and syncs theme-color if the meta tag arrived after the script ran.
  useLayoutEffect(() => {
    apply(stored());
  }, []);

  function toggle() {
    const next: ThemeName = theme === "dark" ? "light" : "dark";
    memory = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked; `memory` keeps the choice for this tab.
    }
    apply(next);
  }

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className="btn rounded-full px-0">
      <svg className="theme-icon-sun" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg className="theme-icon-moon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
        <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
      </svg>
    </button>
  );
}
