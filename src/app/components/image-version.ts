import { SLOT_ROLES } from "@/lib/roles";
import type { MonthView } from "@/server/month-view";

/** Changes whenever anything drawn on the schedule image changes; used to cache-bust it. */
export function imageVersion(view: MonthView): string {
  return [
    view.theme,
    view.poster?.id ?? "",
    ...view.dates.map((d) => `${d.date}:${SLOT_ROLES.map((r) => d.slots[r].volunteerId ?? "").join(",")}`),
  ].join("|");
}
