import { addDateAction, autofillAction, removeDateAction, setSlotAction, transitionAction, updateMonthAction } from "@/app/actions/organiser";
import { manilaInputValue, monthLabel, shortDate, ym } from "@/lib/dates";
import { ROLE_LABEL, SLOT_ROLES, THEMES } from "@/lib/roles";
import { volunteerSummary } from "@/lib/summary";
import type { MonthView } from "@/server/month-view";

const btn = "rounded border px-3 py-1 text-sm";

export function MonthPanel({ view }: { view: MonthView }) {
  const key = ym(view.year, view.month);
  const hidden = (
    <>
      <input type="hidden" name="monthId" value={view.id} />
      <input type="hidden" name="ym" value={key} />
    </>
  );
  const allSlots = view.dates.flatMap((d) => SLOT_ROLES.map((r) => d.slots[r]));
  const unfilled = allSlots.filter((s) => s.volunteerId === null && s.role !== "assist");
  const posters = view.volunteers.filter((v) => v.roles.includes("poster"));
  const op = (name: string, label: string) => (
    <form action={transitionAction}>
      {hidden}
      <input type="hidden" name="op" value={name} />
      <button className={btn}>{label}</button>
    </form>
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">{monthLabel(view.year, view.month)} — {view.status}</h2>

      <div className="flex flex-wrap gap-2">
        {view.status === "open" && op("lock", "Lock poll now")}
        {(view.status === "locked" || view.status === "draft") && (
          <form action={autofillAction}>{hidden}<button className={btn}>Auto-fill (draft)</button></form>
        )}
        {(view.status === "locked" || view.status === "draft") && op("publish", "Publish")}
        {(view.status === "locked" || view.status === "draft") && op("reopen", "Reopen poll")}
        {view.status === "published" && op("unpublish", "Unpublish")}
        <a className={btn} href={`/api/months/${key}/image`} target="_blank" rel="noreferrer">Preview image</a>
      </div>

      <form action={updateMonthAction} className="grid gap-2 sm:grid-cols-2">
        {hidden}
        <label className="flex flex-col text-sm">Deadline (Philippine time)
          <input type="datetime-local" name="deadline" defaultValue={manilaInputValue(view.deadline)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">Poster
          <select name="posterVolunteerId" defaultValue={view.poster?.id ?? ""} className="rounded border px-2 py-1">
            <option value="">---</option>
            {posters.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm">Image theme
          <select name="theme" defaultValue={view.theme} className="rounded border px-2 py-1">
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">Notes
          <textarea name="notes" defaultValue={view.notes} rows={2} className="rounded border px-2 py-1" />
        </label>
        <button className={`${btn} justify-self-start`}>Save settings</button>
      </form>

      {unfilled.length > 0 && (
        <p className="rounded bg-amber-50 p-2 text-sm">
          Empty: {unfilled.map((s) => `${shortDate(s.date)} ${ROLE_LABEL[s.role]}`).join(", ")}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-500">
              <th>Date</th>
              {SLOT_ROLES.map((r) => <th key={r}>{ROLE_LABEL[r]}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {view.dates.map((d) => (
              <tr key={d.id} className="border-t align-top">
                <td className="py-2 font-medium">{shortDate(d.date)}</td>
                {SLOT_ROLES.map((r) => {
                  const s = d.slots[r];
                  const options = view.volunteers.filter((v) => v.roles.includes(r) && (v.active || v.id === s.volunteerId));
                  return (
                    <td key={r} className="py-2 pr-2">
                      <form action={setSlotAction} className="flex gap-1">
                        {hidden}
                        <input type="hidden" name="slotId" value={s.id} />
                        <select name="volunteerId" defaultValue={s.volunteerId ?? ""} className={`rounded border px-1 py-1 ${s.source === "auto" ? "bg-sky-50" : ""}`}>
                          <option value="">---</option>
                          {options.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <button className="text-xs underline">Set</button>
                      </form>
                      {s.source === "auto" && <span className="text-xs text-sky-700">auto</span>}
                    </td>
                  );
                })}
                <td className="py-2">
                  <form action={removeDateAction}>
                    {hidden}
                    <input type="hidden" name="dateId" value={d.id} />
                    <button className="text-xs text-red-700 underline">Remove date</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={addDateAction} className="flex items-end gap-2">
        {hidden}
        <label className="flex flex-col text-sm">Add a date
          <input type="date" name="date" className="rounded border px-2 py-1" />
        </label>
        <button className={btn}>Add</button>
      </form>

      <details>
        <summary className="cursor-pointer text-sm">Who has what</summary>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {volunteerSummary(allSlots).map((line) => <li key={line}>{line}</li>)}
        </ul>
      </details>
    </section>
  );
}
