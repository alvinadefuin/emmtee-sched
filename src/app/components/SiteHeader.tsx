import Image from "next/image";
import Link from "next/link";
import { THEME_COLOR, THEME_KEY } from "@/app/theme";
import { ThemeToggle } from "./ThemeToggle";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="page-x mx-auto flex max-w-6xl items-center justify-between gap-3 py-1.5">
        <Link href="/" className="inline-flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg">
          <span aria-hidden="true" className="grid size-9 flex-none place-items-center rounded-lg border border-line bg-logo-tile">
            <Image src="/logo-mark.png" alt="" width={24} height={24} preload />
          </span>
          <span className="truncate font-display text-lg font-semibold tracking-tight">Volunteer Schedule</span>
        </Link>
        <ThemeToggle storageKey={THEME_KEY} colors={THEME_COLOR} />
      </div>
    </header>
  );
}
