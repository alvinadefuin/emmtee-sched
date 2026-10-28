import Link from "next/link";
import { connection } from "next/server";
import { createMonthAction, logoutAction } from "@/app/actions/organiser";
import { isOrganiser } from "@/app/session";
import { monthLabel, parseYm, ym } from "@/lib/dates";
import { getMonthIdByYm, getMonthView, listMonths } from "@/server/month-view";
import { listVolunteers } from "@/server/roster";
import { LoginForm } from "./LoginForm";
import { MonthPanel } from "./MonthPanel";
import { RosterPanel } from "./RosterPanel";

export default async function OrganiserPage({ searchParams }: { searchParams: Promise<{ m?: string; msg?: string }> }) {
  await connection();
  if (!(await isOrganiser())) return <LoginForm />;

  const { m, msg } = await searchParams;
  const all = await listMonths();
  const picked = m ? parseYm(m) : null;
  const selectedId = picked ? await getMonthIdByYm(picked.year, picked.month) : (all[0]?.id ?? null);
  const view = selectedId ? await getMonthView(selectedId) : null;
  const volunteers = await listVolunteers();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organiser</h1>
        <form action={logoutAction}><button className="text-sm underline">Log out</button></form>
      </header>
      {msg && <p role="status" className="rounded bg-neutral-100 p-3 text-sm">{msg}</p>}

      <nav className="flex flex-wrap gap-2 text-sm">
        {all.map((row) => (
          <Link key={row.id} href={`/organiser?m=${ym(row.year, row.month)}`} className={`rounded border px-2 py-1 ${row.id === selectedId ? "bg-black text-white" : ""}`}>
            {monthLabel(row.year, row.month)}
          </Link>
        ))}
      </nav>

      <form action={createMonthAction} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">Year<input name="year" type="number" defaultValue={nextMonth.getFullYear()} className="w-24 rounded border px-2 py-1" /></label>
        <label className="flex flex-col">Month<input name="month" type="number" min={1} max={12} defaultValue={nextMonth.getMonth() + 1} className="w-20 rounded border px-2 py-1" /></label>
        <button className="rounded bg-black px-3 py-1 text-white">Create month</button>
      </form>

      {view && <MonthPanel view={view} />}
      <RosterPanel volunteers={volunteers} ymKey={view ? ym(view.year, view.month) : null} />
    </main>
  );
}
