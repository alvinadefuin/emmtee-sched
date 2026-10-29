import { addVolunteerAction, updateVolunteerAction } from "@/app/actions/organiser";
import { ROLE_LABEL, ROLES } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";

const check = "inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm";
const row = "grid min-w-0 gap-2 rounded-2xl border bg-bg p-3 sm:p-4 lg:grid-cols-[11rem_minmax(0,1fr)_auto] lg:items-center lg:gap-4";

export function RosterPanel({ volunteers, ymKey }: { volunteers: VolunteerView[]; ymKey: string | null }) {
  const ymInput = ymKey ? <input type="hidden" name="ym" value={ymKey} /> : null;
  return (
    <section className="card flex min-w-0 flex-col gap-3 p-4 sm:p-6">
      <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Roster</h2>
      {volunteers.map((v) => (
        <form key={v.id} action={updateVolunteerAction} className={`${row} border-line`}>
          {ymInput}
          <input type="hidden" name="volunteerId" value={v.id} />
          <strong className="min-w-0 [overflow-wrap:anywhere]">{v.name}</strong>
          <div className="flex flex-wrap gap-x-5">
            <label className={check}><input type="checkbox" name="active" defaultChecked={v.active} className="check" /> active</label>
            {ROLES.map((r) => (
              <label key={r} className={check}><input type="checkbox" name="roles" value={r} defaultChecked={v.roles.includes(r)} className="check" /> {ROLE_LABEL[r]}</label>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-semibold">Poster order <input type="number" name="posterOrder" min={1} defaultValue={v.posterOrder ?? ""} className="field tnum w-24" /></label>
            <button className="btn text-sm">Save</button>
          </div>
        </form>
      ))}
      <form action={addVolunteerAction} className={`${row} border-dashed border-line-strong`}>
        {ymInput}
        <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold">
          <span className="sr-only">New volunteer name</span>
          <input name="name" required placeholder="New volunteer name" className="field" />
        </label>
        <div className="flex flex-wrap gap-x-5">
          {ROLES.map((r) => (
            <label key={r} className={check}><input type="checkbox" name="roles" value={r} className="check" /> {ROLE_LABEL[r]}</label>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Poster order <input type="number" name="posterOrder" min={1} className="field tnum w-24" /></label>
          <button className="btn btn-primary text-sm">Add</button>
        </div>
      </form>
    </section>
  );
}
