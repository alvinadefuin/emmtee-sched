import { addDateAction, autofillAction, removeDateAction, setSlotAction, transitionAction, updateMonthAction } from "@/app/actions/organiser";
import { manilaInputValue, monthLabel, shortDate, ym } from "@/lib/dates";
import { ROLE_LABEL, SLOT_ROLES, THEMES } from "@/lib/roles";
import { volunteerSummary } from "@/lib/summary";
import type { MonthView } from "@/server/month-view";

const btn = "btn text-sm";
const label = "flex min-w-0 flex-col gap-1.5 text-sm font-semibold";

const STATUS_TONE = {
  open: "bg-accent-soft text-accent-text",
  locked: "bg-warn-soft text-warn-text",
  draft: "bg-peach-soft text-peach-text",
  published: "bg-accent text-on-accent",
} as const;

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
    <section className="card flex min-w-0 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">{monthLabel(view.year, view.month)}</h2>
        <span className={`badge ${STATUS_TONE[view.status]}`}>{view.status}</span>
      </div>

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

      <form action={updateMonthAction} className="grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-3">
        {hidden}
        <label className={label}>Deadline (Philippine time)
          <input type="datetime-local" name="deadline" defaultValue={manilaInputValue(view.deadline)} className="field" />
        </label>
        <label className={label}>Poster
          <select name="posterVolunteerId" defaultValue={view.poster?.id ?? ""} className="field">
            <option value="">---</option>
            {posters.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className={label}>Image theme
          <select name="theme" defaultValue={view.theme} className="field">
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className={`${label} sm:col-span-2 lg:col-span-3`}>Notes
          <textarea name="notes" defaultValue={view.notes} rows={2} className="field resize-y" />
        </label>
        <button className="btn btn-primary w-full sm:w-auto sm:justify-self-start">Save settings</button>
      </form>

      {unfilled.length > 0 && (
        <p className="rounded-xl border border-warn bg-warn-soft p-3 text-sm text-warn-text">
          <strong>Empty:</strong> {unfilled.map((s) => `${shortDate(s.date)} ${ROLE_LABEL[s.role]}`).join(", ")}
        </p>
      )}

      <div className="flex flex-col gap-3">
        <h3 className="eyebrow">Sundays</h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {view.dates.map((d) => (
            <li key={d.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-bg p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-display text-xl font-semibold">{shortDate(d.date)}</h4>
                <form action={removeDateAction}>
                  {hidden}
                  <input type="hidden" name="dateId" value={d.id} />
                  <button className="btn btn-danger text-sm">Remove date</button>
                </form>
              </div>
              {SLOT_ROLES.map((r) => {
                const s = d.slots[r];
                const options = view.volunteers.filter((v) => v.roles.includes(r) && (v.active || v.id === s.volunteerId));
                const id = `slot-${s.id}`;
                return (
                  <form key={r} action={setSlotAction} className="flex min-w-0 flex-col gap-1.5">
                    {hidden}
                    <input type="hidden" name="slotId" value={s.id} />
                    <div className="flex items-center justify-between gap-2">
                      <label htmlFor={id} className="eyebrow">{ROLE_LABEL[r]}</label>
                      {s.source === "auto" && <span className="badge bg-peach-soft py-0.5 text-xs text-peach-text">auto</span>}
                    </div>
                    <div className="flex gap-2">
                      <select id={id} name="volunteerId" defaultValue={s.volunteerId ?? ""} className={`field flex-1 ${s.source === "auto" ? "field-auto" : ""}`}>
                        <option value="">---</option>
                        {options.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                      <button className={btn}>Set</button>
                    </div>
                  </form>
                );
              })}
            </li>
          ))}
        </ul>
      </div>

      <form action={addDateAction} className="flex flex-wrap items-end gap-3 border-t border-line pt-5">
        {hidden}
        <label className={`${label} flex-1 sm:max-w-xs`}>Add a date
          <input type="date" name="date" className="field" />
        </label>
        <button className={btn}>Add</button>
      </form>

      <details className="group rounded-2xl border border-line bg-bg px-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 font-semibold [&::-webkit-details-marker]:hidden">
          Who has what
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted transition-transform group-open:rotate-180">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>
        <ul className="list-disc pb-4 pl-5 text-sm [overflow-wrap:anywhere]">
          {volunteerSummary(allSlots).map((line) => <li key={line} className="py-0.5">{line}</li>)}
        </ul>
      </details>
    </section>
  );
}
