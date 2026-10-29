import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { months, serviceDates, slots, swapRequests, volunteerRoles, volunteers } from "@/db/schema";
import { monthVersion, swapVersion, type MonthSnapshot } from "@/lib/version";

async function roster(): Promise<MonthSnapshot["volunteers"]> {
  const [vs, rs] = await Promise.all([
    db.select({ id: volunteers.id, name: volunteers.name, active: volunteers.active, posterOrder: volunteers.posterOrder }).from(volunteers),
    db.select().from(volunteerRoles),
  ]);
  return vs.map((v) => ({ ...v, roles: rs.filter((r) => r.volunteerId === v.id).map((r) => r.role) }));
}

/**
 * Fingerprint of everything the poll and organiser pages show for a month: `ym` picks
 * one month, `"latest"` follows whichever month the poll page shows. Null when the
 * requested month does not exist.
 */
export async function getMonthVersion(ym: { year: number; month: number } | "latest", now = new Date()): Promise<string | null> {
  const [monthList, vols] = await Promise.all([
    db.select({ id: months.id, year: months.year, month: months.month }).from(months).orderBy(desc(months.year), desc(months.month)),
    roster(),
  ]);
  const picked = ym === "latest" ? monthList[0] : monthList.find((m) => m.year === ym.year && m.month === ym.month);
  if (!picked) {
    if (ym !== "latest") return null;
    return monthVersion({ month: null, months: monthList, dates: [], slots: [], swaps: [], volunteers: vols }, now);
  }

  const [[m], dates, slotRows, swaps] = await Promise.all([
    db
      .select({
        id: months.id,
        year: months.year,
        month: months.month,
        status: months.status,
        deadline: months.deadline,
        theme: months.theme,
        posterVolunteerId: months.posterVolunteerId,
        notes: months.notes,
      })
      .from(months)
      .where(eq(months.id, picked.id)),
    db.select({ id: serviceDates.id, date: serviceDates.date }).from(serviceDates).where(eq(serviceDates.monthId, picked.id)),
    db
      .select({ id: slots.id, dateId: slots.serviceDateId, role: slots.role, volunteerId: slots.volunteerId })
      .from(slots)
      .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
      .where(eq(serviceDates.monthId, picked.id)),
    db
      .select({ id: swapRequests.id, status: swapRequests.status })
      .from(swapRequests)
      .innerJoin(slots, eq(swapRequests.requesterSlotId, slots.id))
      .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
      .where(eq(serviceDates.monthId, picked.id)),
  ]);
  // Deleted between the two reads: report it as missing, the next poll settles it.
  if (!m) return null;
  return monthVersion({ month: m, months: monthList, dates, slots: slotRows, swaps, volunteers: vols }, now);
}

/** Fingerprint of what the swap page shows for one request, or null if it does not exist. */
export async function getSwapVersion(id: string, now = new Date()): Promise<string | null> {
  const [req] = await db
    .select({
      id: swapRequests.id,
      status: swapRequests.status,
      reason: swapRequests.reason,
      requesterSlotId: swapRequests.requesterSlotId,
      targetSlotId: swapRequests.targetSlotId,
      monthStatus: months.status,
      deadline: months.deadline,
    })
    .from(swapRequests)
    .innerJoin(slots, eq(swapRequests.requesterSlotId, slots.id))
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .innerJoin(months, eq(serviceDates.monthId, months.id))
    .where(eq(swapRequests.id, id));
  if (!req) return null;
  const slotIds = [req.requesterSlotId, req.targetSlotId].filter((x): x is number => x !== null);
  const [slotRows, vols] = await Promise.all([
    db.select({ id: slots.id, volunteerId: slots.volunteerId }).from(slots).where(inArray(slots.id, slotIds)),
    db.select({ id: volunteers.id, name: volunteers.name, active: volunteers.active }).from(volunteers),
  ]);
  return swapVersion(
    { id: req.id, status: req.status, reason: req.reason, monthStatus: req.monthStatus, deadline: req.deadline, slots: slotRows, volunteers: vols },
    now,
  );
}
