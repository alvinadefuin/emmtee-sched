import { shortDate } from "./dates";
import { ROLE_SHORT, SLOT_ROLES, type SlotRole } from "./roles";

type Assignment = { date: string; role: SlotRole; volunteerName: string | null };

/** One line per person, e.g. "Volunteer B: Photog ×2 (Nov 1, Nov 29)". */
export function volunteerSummary(assignments: Assignment[]): string[] {
  const byName = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!a.volunteerName) continue;
    byName.set(a.volunteerName, [...(byName.get(a.volunteerName) ?? []), a]);
  }
  return [...byName.keys()].sort().map((name) => {
    const parts = SLOT_ROLES.flatMap((role) => {
      const dates = byName.get(name)!.filter((a) => a.role === role).map((a) => a.date).sort();
      return dates.length ? [`${ROLE_SHORT[role]} ×${dates.length} (${dates.map(shortDate).join(", ")})`] : [];
    });
    return `${name}: ${parts.join("; ")}`;
  });
}
