import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { months, serviceDates, slots } from "@/db/schema";
import { autofill } from "@/lib/autofill";
import { defaultDeadline, sundaysInMonth } from "@/lib/dates";
import { effectiveStatus, nextStatus, type MonthOp } from "@/lib/month-status";
import { nextPoster } from "@/lib/poster-rotation";
import { fail, type Result } from "@/lib/result";
import { isSlotRole, SLOT_ROLES, type Theme } from "@/lib/roles";
import { isUniqueViolation } from "./errors";
import { listVolunteers } from "./roster";

async function insertDate(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], monthId: number, date: string) {
  const [d] = await tx.insert(serviceDates).values({ monthId, date }).returning({ id: serviceDates.id });
  await tx.insert(slots).values(SLOT_ROLES.map((role) => ({ serviceDateId: d.id, role })));
}

export async function createMonth(year: number, month: number): Promise<Result<{ id: number }>> {
  if (month < 1 || month > 12 || year < 2024 || year > 2100) return fail("Pick a valid month.");
  const vols = await listVolunteers();
  const rotation = vols
    .filter((v) => v.active && v.roles.includes("poster") && v.posterOrder !== null)
    .sort((a, b) => a.posterOrder! - b.posterOrder!)
    .map((v) => v.id);
  const [prev] = await db
    .select({ posterVolunteerId: months.posterVolunteerId })
    .from(months)
    .where(or(lt(months.year, year), and(eq(months.year, year), lt(months.month, month))))
    .orderBy(desc(months.year), desc(months.month))
    .limit(1);

  try {
    return await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(months)
        .values({
          year,
          month,
          deadline: defaultDeadline(year, month),
          posterVolunteerId: nextPoster(rotation, prev?.posterVolunteerId ?? null),
        })
        .returning({ id: months.id });
      for (const date of sundaysInMonth(year, month)) await insertDate(tx, m.id, date);
      return { ok: true as const, id: m.id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("That month already exists.");
    throw e;
  }
}

export async function updateMonthSettings(
  monthId: number,
  input: { deadline: Date; posterVolunteerId: number | null; theme: Theme; notes: string },
): Promise<Result> {
  await db.update(months).set(input).where(eq(months.id, monthId));
  return { ok: true };
}

export async function addServiceDate(monthId: number, date: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  try {
    await db.transaction((tx) => insertDate(tx, monthId, date));
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return fail("That date is already in the schedule.");
    throw e;
  }
}

export async function removeServiceDate(dateId: number): Promise<Result> {
  await db.delete(serviceDates).where(eq(serviceDates.id, dateId));
  return { ok: true };
}

export async function setSlotManually(slotId: number, volunteerId: number | null): Promise<Result> {
  try {
    await db
      .update(slots)
      .set({ volunteerId, source: volunteerId === null ? null : "manual", updatedAt: new Date() })
      .where(eq(slots.id, slotId));
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return fail("That person already has a role on that Sunday.");
    throw e;
  }
}

export async function transitionMonth(monthId: number, op: MonthOp, now = new Date()): Promise<Result> {
  const [m] = await db.select().from(months).where(eq(months.id, monthId));
  if (!m) return fail("Month not found.");
  const to = nextStatus(effectiveStatus(m.status, m.deadline, now), op);
  if (!to) return fail(`Can't ${op} from the current status.`);
  if (op === "reopen" && m.deadline.getTime() <= now.getTime()) {
    return fail("Move the deadline later before reopening the poll.");
  }
  await db.update(months).set({ status: to }).where(eq(months.id, monthId));
  return { ok: true };
}

export async function runAutofill(monthId: number, seed: number, now = new Date()): Promise<Result<{ unfilled: number }>> {
  const [m] = await db.select().from(months).where(eq(months.id, monthId));
  if (!m) return fail("Month not found.");
  const status = effectiveStatus(m.status, m.deadline, now);
  if (status !== "locked" && status !== "draft") return fail("Lock the poll before running auto-fill.");

  const rows = await db
    .select({ id: slots.id, date: serviceDates.date, role: slots.role, volunteerId: slots.volunteerId, source: slots.source })
    .from(slots)
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .where(eq(serviceDates.monthId, monthId));
  const vols = (await listVolunteers())
    .filter((v) => v.active)
    .map((v) => ({ id: v.id, roles: v.roles.filter(isSlotRole) }));
  const result = autofill(rows, vols, seed);

  await db.transaction(async (tx) => {
    // Clear old auto picks before writing new ones so the one-role-per-day index
    // never sees a transient duplicate.
    await tx
      .update(slots)
      .set({ volunteerId: null, source: null })
      .where(and(inArray(slots.id, rows.map((r) => r.id)), eq(slots.source, "auto")));
    for (const s of result.slots) {
      if (s.source !== "auto") continue;
      await tx.update(slots).set({ volunteerId: s.volunteerId, source: "auto", updatedAt: now }).where(eq(slots.id, s.id));
    }
    await tx.update(months).set({ status: "draft", autofillSeed: seed }).where(eq(months.id, monthId));
  });
  return { ok: true, unfilled: result.unfilled.length };
}
