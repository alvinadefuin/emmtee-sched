import { addVolunteerAction, updateVolunteerAction } from "@/app/actions/organiser";
import { ROLE_LABEL, ROLES } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";

export function RosterPanel({ volunteers, ymKey }: { volunteers: VolunteerView[]; ymKey: string | null }) {
  const ymInput = ymKey ? <input type="hidden" name="ym" value={ymKey} /> : null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Roster</h2>
      {volunteers.map((v) => (
        <form key={v.id} action={updateVolunteerAction} className="flex flex-wrap items-center gap-3 border-t pt-2 text-sm">
          {ymInput}
          <input type="hidden" name="volunteerId" value={v.id} />
          <strong className="w-28">{v.name}</strong>
          <label><input type="checkbox" name="active" defaultChecked={v.active} /> active</label>
          {ROLES.map((r) => (
            <label key={r}><input type="checkbox" name="roles" value={r} defaultChecked={v.roles.includes(r)} /> {ROLE_LABEL[r]}</label>
          ))}
          <label>Poster order <input type="number" name="posterOrder" min={1} defaultValue={v.posterOrder ?? ""} className="w-16 rounded border px-1" /></label>
          <button className="rounded border px-2 py-1">Save</button>
        </form>
      ))}
      <form action={addVolunteerAction} className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
        {ymInput}
        <input name="name" required placeholder="New volunteer name" className="rounded border px-2 py-1" />
        {ROLES.map((r) => (
          <label key={r}><input type="checkbox" name="roles" value={r} /> {ROLE_LABEL[r]}</label>
        ))}
        <label>Poster order <input type="number" name="posterOrder" min={1} className="w-16 rounded border px-1" /></label>
        <button className="rounded bg-black px-3 py-1 text-white">Add</button>
      </form>
    </section>
  );
}
