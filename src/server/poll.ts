import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { slots, volunteerRoles } from "@/db/schema";
import { canClaim, effectiveStatus } from "@/lib/month-status";
import { fail, type Result } from "@/lib/result";
import { isUniqueViolation } from "./errors";
import { cancelPendingSwaps, slotContext, volunteerProblem } from "./queries";

export async function claimSlot(slotId: number, volunteerId: number, now = new Date()): Promise<Result> {
  const ctx = await slotContext(db, slotId);
  if (!ctx) return fail("Slot not found.");
  if (!canClaim(effectiveStatus(ctx.status, ctx.deadline, now))) return fail("The poll is closed.");
  const problem = await volunteerProblem(db, volunteerId, "you");
  if (problem) return fail(problem);

  const roles = await db.select().from(volunteerRoles).where(eq(volunteerRoles.volunteerId, volunteerId));
  if (!roles.some((r) => r.role === ctx.role)) return fail("You are not on the roster for this role.");

  try {
    const updated = await db
      .update(slots)
      .set({ volunteerId, source: "claimed", updatedAt: now })
      .where(and(eq(slots.id, slotId), isNull(slots.volunteerId)))
      .returning({ id: slots.id });
    if (!updated.length) return fail("Someone else already took this slot.");
  } catch (e) {
    if (isUniqueViolation(e)) return fail("You already have a role on that Sunday.");
    throw e;
  }
  return { ok: true };
}

export async function releaseSlot(slotId: number, volunteerId: number, now = new Date()): Promise<Result> {
  const ctx = await slotContext(db, slotId);
  if (!ctx) return fail("Slot not found.");
  if (!canClaim(effectiveStatus(ctx.status, ctx.deadline, now))) return fail("The poll is closed.");

  const updated = await db
    .update(slots)
    .set({ volunteerId: null, source: null, updatedAt: now })
    .where(and(eq(slots.id, slotId), eq(slots.volunteerId, volunteerId)))
    .returning({ id: slots.id });
  if (!updated.length) return fail("This slot is not yours.");

  await cancelPendingSwaps(db, [slotId], "The slot was released.", now);
  return { ok: true };
}
