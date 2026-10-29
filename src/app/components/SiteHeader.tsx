import Link from "next/link";
import { THEME_COLOR, THEME_KEY } from "@/app/theme";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-x mx-auto flex max-w-6xl items-center justify-between gap-3 py-1.5">
        <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg">
          <span aria-hidden="true" className="relative grid size-8 flex-none place-items-center rounded-lg bg-accent text-on-accent">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 4v16M5 10h14" />
            </svg>
            <span className="absolute -right-1 -bottom-1 size-3 rounded-full border-2 border-bg bg-peach" />
          </span>
          <span className="truncate font-display text-lg font-semibold tracking-tight">Volunteer Schedule</span>
        </Link>
        <ThemeToggle storageKey={THEME_KEY} colors={THEME_COLOR} />
      </div>
    </header>
  );
}
