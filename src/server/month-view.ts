import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { months, serviceDates, slots, swapRequests, volunteers } from "@/db/schema";
import { effectiveStatus } from "@/lib/month-status";
import { SLOT_ROLES, type MonthStatus, type SlotRole, type SlotSource, type SwapKind, type SwapStatus, type Theme } from "@/lib/roles";
import { listVolunteers, type VolunteerView } from "./roster";

export type SlotView = {
  id: number;
  dateId: number;
  date: string;
  role: SlotRole;
  volunteerId: number | null;
  volunteerName: string | null;
  source: SlotSource | null;
};
export type DateView = { id: number; date: string; slots: Record<SlotRole, SlotView> };
export type SwapView = {
  id: string;
  kind: SwapKind;
  requesterId: number;
  targetId: number;
  requesterSlotId: number;
  targetSlotId: number | null;
};
export type MonthView = {
  id: number;
  year: number;
  month: number;
  deadline: Date;
  /** Effective status: an open poll past its deadline reads as "locked". */
  status: MonthStatus;
  theme: Theme;
  notes: string;
  poster: { id: number; name: string } | null;
  dates: DateView[];
  volunteers: VolunteerView[];
  pendingSwaps: SwapView[];
  /** Requests in this month that were accepted or declined, so a requester can be told the outcome. */
  resolvedSwaps: (SwapView & { status: Extract<SwapStatus, "accepted" | "declined"> })[];
};

/** Every month, newest first, with its effective status (an open poll past its deadline reads as "locked"). */
export async function listMonths(now = new Date()) {
  const rows = await db
    .select({ id: months.id, year: months.year, month: months.month, status: months.status, deadline: months.deadline })
    .from(months)
    .orderBy(desc(months.year), desc(months.month));
  return rows.map(({ deadline, ...m }) => ({ ...m, status: effectiveStatus(m.status, deadline, now) }));
}

export async function getLatestMonthId(): Promise<number | null> {
  const [row] = await listMonths();
  return row?.id ?? null;
}

export async function getMonthIdByYm(year: number, month: number): Promise<number | null> {
  const [row] = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.year, year), eq(months.month, month)));
  return row?.id ?? null;
}

export async function getMonthView(monthId: number, now = new Date()): Promise<MonthView | null> {
  const [m] = await db.select().from(months).where(eq(months.id, monthId));
  if (!m) return null;

  const dateRows = await db
    .select()
    .from(serviceDates)
    .where(eq(serviceDates.monthId, monthId))
    .orderBy(asc(serviceDates.date));
  const dateIds = dateRows.map((d) => d.id);

  const slotRows = dateIds.length
    ? await db
        .select({
          id: slots.id,
          dateId: slots.serviceDateId,
          role: slots.role,
          volunteerId: slots.volunteerId,
          source: slots.source,
          volunteerName: volunteers.name,
        })
        .from(slots)
        .leftJoin(volunteers, eq(slots.volunteerId, volunteers.id))
        .where(inArray(slots.serviceDateId, dateIds))
    : [];

  const slotIds = slotRows.map((s) => s.id);
  const swapRows = slotIds.length
    ? await db
        .select()
        .from(swapRequests)
        .where(
          and(
            inArray(swapRequests.status, ["pending", "accepted", "declined"]),
            inArray(swapRequests.requesterSlotId, slotIds),
          ),
        )
    : [];

  const vols = await listVolunteers();
  const poster = vols.find((v) => v.id === m.posterVolunteerId);

  return {
    id: m.id,
    year: m.year,
    month: m.month,
    deadline: m.deadline,
    status: effectiveStatus(m.status, m.deadline, now),
    theme: m.theme,
    notes: m.notes,
    poster: poster ? { id: poster.id, name: poster.name } : null,
    dates: dateRows.map((d) => ({
      id: d.id,
      date: d.date,
      slots: Object.fromEntries(
        SLOT_ROLES.map((role) => {
          const s = slotRows.find((x) => x.dateId === d.id && x.role === role)!;
          return [role, { ...s, date: d.date }];
        }),
      ) as Record<SlotRole, SlotView>,
    })),
    volunteers: vols,
    pendingSwaps: swapRows.filter((s) => s.status === "pending").map(swapView),
    resolvedSwaps: swapRows.flatMap((s) =>
      s.status === "accepted" || s.status === "declined" ? [{ ...swapView(s), status: s.status }] : [],
    ),
  };
}

function swapView(s: typeof swapRequests.$inferSelect): SwapView {
  return {
    id: s.id,
    kind: s.kind,
    requesterId: s.requesterId,
    targetId: s.targetId,
    requesterSlotId: s.requesterSlotId,
    targetSlotId: s.targetSlotId,
  };
}
