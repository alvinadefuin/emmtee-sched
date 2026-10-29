import { addVolunteerAction, updateVolunteerAction } from "@/app/actions/organiser";
import { ROLE_LABEL, ROLES, type Role } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";

const check = "inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm";
const summary =
  "flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden";
const fields = "flex flex-col gap-3 pb-4";

const SHORT_ROLE: Record<Role, string> = { laptop: "Operator", assist: "Assist", photog: "Photog", poster: "Poster" };

function Chevron() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted transition-transform group-open:rotate-180">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function RoleChecks({ selected = [] }: { selected?: Role[] }) {
  return (
    <div className="flex flex-wrap gap-x-5">
      {ROLES.map((r) => (
        <label key={r} className={check}><input type="checkbox" name="roles" value={r} defaultChecked={selected.includes(r)} className="check" /> {ROLE_LABEL[r]}</label>
      ))}
    </div>
  );
}

// Collapsed by default: the roster changes rarely, and on phones the month controls above matter more.
export function RosterPanel({ volunteers, ymKey }: { volunteers: VolunteerView[]; ymKey: string | null }) {
  const ymInput = ymKey ? <input type="hidden" name="ym" value={ymKey} /> : null;
  return (
    <details className="card group/roster min-w-0 p-4 sm:p-6">
      <summary className={`${summary}`}>
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          Roster <span className="text-base font-normal text-muted">· {volunteers.length} volunteers</span>
        </h2>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-muted transition-transform group-open/roster:rotate-180">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>

      <ul className="mt-3 flex flex-col gap-2">
        {volunteers.map((v) => (
          <li key={v.id}>
            <details className={`group rounded-2xl border border-line bg-bg px-4 ${v.active ? "" : "opacity-80"}`}>
              <summary className={summary}>
                <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 py-2">
                  <strong className="[overflow-wrap:anywhere]">{v.name}</strong>
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {v.roles.length ? v.roles.map((r) => SHORT_ROLE[r]).join(" · ") : "No roles"}
                  </span>
                  {!v.active && <span className="badge border border-line-strong text-muted">inactive</span>}
                  {v.posterOrder !== null && <span className="tnum text-xs text-muted">Poster #{v.posterOrder}</span>}
                </span>
                <Chevron />
              </summary>
              <form action={updateVolunteerAction} className={fields}>
                {ymInput}
                <input type="hidden" name="volunteerId" value={v.id} />
                <label className={check}><input type="checkbox" name="active" defaultChecked={v.active} className="check" /> active</label>
                <RoleChecks selected={v.roles} />
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1.5 text-sm font-semibold">Poster order <input type="number" name="posterOrder" min={1} defaultValue={v.posterOrder ?? ""} className="field tnum w-24" /></label>
                  <button className="btn text-sm">Save</button>
                </div>
              </form>
            </details>
          </li>
        ))}
        <li>
          <details className="group rounded-2xl border border-dashed border-line-strong bg-bg px-4">
            <summary className={`${summary} font-semibold`}>
              + Add volunteer
              <Chevron />
            </summary>
            <form action={addVolunteerAction} className={fields}>
              {ymInput}
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">
                <span className="sr-only">New volunteer name</span>
                <input name="name" required placeholder="New volunteer name" className="field" />
              </label>
              <RoleChecks />
              <div className="flex flex-wrap items-end gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-semibold">Poster order <input type="number" name="posterOrder" min={1} className="field tnum w-24" /></label>
                <button className="btn btn-primary text-sm">Add</button>
              </div>
            </form>
          </details>
        </li>
      </ul>
    </details>
  );
}
