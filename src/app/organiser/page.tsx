import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { createMonthAction, logoutAction } from "@/app/actions/organiser";
import { isOrganiser } from "@/app/session";
import { monthLabel, parseYm, ym } from "@/lib/dates";
import { getMonthIdByYm, getMonthView, listMonths } from "@/server/month-view";
import { listVolunteers } from "@/server/roster";
import { LoginForm } from "./LoginForm";
import { MonthPanel } from "./MonthPanel";
import { OrganiserFlash } from "./OrganiserFlash";
import { OrganiserLiveRefresh } from "./OrganiserLiveRefresh";
import { RosterPanel } from "./RosterPanel";

export default async function OrganiserPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await connection();
  if (!(await isOrganiser())) return <LoginForm />;

  const { m } = await searchParams;
  const all = await listMonths();
  const picked = m ? parseYm(m) : null;
  const selectedId = picked ? await getMonthIdByYm(picked.year, picked.month) : (all[0]?.id ?? null);
  const view = selectedId ? await getMonthView(selectedId) : null;
  const volunteers = await listVolunteers();
  // The poll's public address for the announcement, taken from this request so it is right on any deployment.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const siteUrl = `${proto}://${host}`;
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return (
    <main className="page-x page-bottom mx-auto flex w-full max-w-6xl flex-col gap-6 pt-6 sm:pt-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">Behind the PIN</p>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Organiser</h1>
        </div>
        <form action={logoutAction}><button className="btn">Log out</button></form>
      </header>
      <Suspense fallback={null}>
        <OrganiserFlash />
      </Suspense>

      <section className="card flex flex-col gap-4 p-4 sm:p-6">
        <h2 className="eyebrow">Months</h2>
        <nav aria-label="Months" className="flex flex-wrap gap-2">
          {all.map((row) => {
            const selected = row.id === selectedId;
            return (
              <Link
                key={row.id}
                href={`/organiser?m=${ym(row.year, row.month)}`}
                aria-current={selected ? "page" : undefined}
                className={`btn text-sm ${selected ? "btn-primary" : ""}`}
              >
                {monthLabel(row.year, row.month)}
              </Link>
            );
          })}
        </nav>

        <form action={createMonthAction} className="grid grid-cols-2 items-end gap-3 border-t border-line pt-4 sm:flex sm:flex-wrap">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Year<input name="year" type="number" defaultValue={nextMonth.getFullYear()} className="field tnum sm:w-28" /></label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Month<input name="month" type="number" min={1} max={12} defaultValue={nextMonth.getMonth() + 1} className="field tnum sm:w-24" /></label>
          <button className="btn btn-primary col-span-2">Create month</button>
        </form>
      </section>

      {view && <MonthPanel view={view} siteUrl={siteUrl} />}
      <RosterPanel volunteers={volunteers} ymKey={view ? ym(view.year, view.month) : null} />
      <OrganiserLiveRefresh url={`/api/months/${view ? ym(view.year, view.month) : "latest"}/version`} />
    </main>
  );
}
