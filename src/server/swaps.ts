import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { serviceDates, slots, swapRequests, volunteers } from "@/db/schema";
import { effectiveStatus } from "@/lib/month-status";
import { fail, notNull, type Result } from "@/lib/result";
import type { SlotRole, SwapKind, SwapStatus } from "@/lib/roles";
import { validateSwap } from "@/lib/swap-rules";
import { isUniqueViolation } from "./errors";
import { eligibilityMap, monthSlots, slotContext } from "./queries";

const PENDING_CLASH = "There is already a pending swap for one of these slots.";

export type CreateSwapInput = {
  kind: SwapKind;
  requesterId: number;
  requesterSlotId: number;
  targetId: number;
  targetSlotId: number | null;
};

export async function createSwap(input: CreateSwapInput, now = new Date()): Promise<Result<{ id: string }>> {
  const ctx = await slotContext(db, input.requesterSlotId);
  if (!ctx) return fail("Slot not found.");
  if (input.targetSlotId !== null) {
    const target = await slotContext(db, input.targetSlotId);
    if (!target || target.monthId !== ctx.monthId) return fail("Both slots must be in the same month.");
  }

  const verdict = validateSwap({
    ...input,
    status: effectiveStatus(ctx.status, ctx.deadline, now),
    slots: await monthSlots(db, ctx.monthId),
    eligibility: await eligibilityMap(db),
  });
  if (!verdict.ok) return fail(verdict.reason);

  const slotIds = [input.requesterSlotId, input.targetSlotId].filter(notNull);
  const clash = await db
    .select({ id: swapRequests.id })
    .from(swapRequests)
    .where(
      and(
        eq(swapRequests.status, "pending"),
        or(inArray(swapRequests.requesterSlotId, slotIds), inArray(swapRequests.targetSlotId, slotIds)),
      ),
    )
    .limit(1);
  if (clash.length) return fail(PENDING_CLASH);

  try {
    const [row] = await db.insert(swapRequests).values(input).returning({ id: swapRequests.id });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isUniqueViolation(e)) return fail(PENDING_CLASH);
    throw e;
  }
}

export async function acceptSwap(id: string, actorId: number, now = new Date()): Promise<Result> {
  try {
    return await acceptInTransaction(id, actorId, now);
  } catch (e) {
    // A claim committed between validation and the slot updates; nothing was written.
    if (isUniqueViolation(e)) return fail("One of you already has a role on that Sunday.");
    throw e;
  }
}

function acceptInTransaction(id: string, actorId: number, now: Date): Promise<Result> {
  return db.transaction(async (tx) => {
    const [first] = await tx.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!first) return fail("Swap request not found.");
    const slotIds = [first.requesterSlotId, first.targetSlotId].filter(notNull);

    // Lock order is always slots (by id) then requests (by id). Two accepts that share
    // a slot therefore queue on the same first lock instead of deadlocking.
    await tx.select({ id: slots.id }).from(slots).where(inArray(slots.id, slotIds)).orderBy(asc(slots.id)).for("update");
    await tx
      .select({ id: swapRequests.id })
      .from(swapRequests)
      .where(
        or(
          eq(swapRequests.id, id),
          inArray(swapRequests.requesterSlotId, slotIds),
          inArray(swapRequests.targetSlotId, slotIds),
        ),
      )
      .orderBy(asc(swapRequests.id))
      .for("update");

    // Re-read now that we hold the locks; another accept may have just committed.
    const [req] = await tx.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!req) return fail("Swap request not found."); // e.g. its date was removed meanwhile
    if (req.status !== "pending") return fail(`This request is already ${req.status}.`);
    if (req.targetId !== actorId) return fail("Only the person being asked can accept.");

    const ctx = await slotContext(tx, req.requesterSlotId);
    if (!ctx) return fail("Slot not found.");
    const verdict = validateSwap({
      kind: req.kind,
      requesterId: req.requesterId,
      requesterSlotId: req.requesterSlotId,
      targetId: req.targetId,
      targetSlotId: req.targetSlotId,
      status: effectiveStatus(ctx.status, ctx.deadline, now),
      slots: await monthSlots(tx, ctx.monthId),
      eligibility: await eligibilityMap(tx),
    });
    if (!verdict.ok) {
      await tx
        .update(swapRequests)
        .set({ status: "invalid", reason: verdict.reason, resolvedAt: now })
        .where(eq(swapRequests.id, id));
      return fail(verdict.reason);
    }

    if (req.kind === "handover") {
      await tx
        .update(slots)
        .set({ volunteerId: req.targetId, source: "claimed", updatedAt: now })
        .where(eq(slots.id, req.requesterSlotId));
    } else {
      // Clear both first: if the two slots are on the same Sunday, assigning either
      // before the other is cleared would briefly give one person two roles that day.
      await tx.update(slots).set({ volunteerId: null }).where(inArray(slots.id, slotIds));
      await tx
        .update(slots)
        .set({ volunteerId: req.targetId, source: "claimed", updatedAt: now })
        .where(eq(slots.id, req.requesterSlotId));
      await tx
        .update(slots)
        .set({ volunteerId: req.requesterId, source: "claimed", updatedAt: now })
        .where(eq(slots.id, req.targetSlotId!));
    }

    await tx
      .update(swapRequests)
      .set({ status: "cancelled", reason: "Another swap for this slot was accepted.", resolvedAt: now })
      .where(
        and(
          eq(swapRequests.status, "pending"),
          ne(swapRequests.id, id),
          or(inArray(swapRequests.requesterSlotId, slotIds), inArray(swapRequests.targetSlotId, slotIds)),
        ),
      );
    await tx.update(swapRequests).set({ status: "accepted", resolvedAt: now }).where(eq(swapRequests.id, id));
    return { ok: true };
  });
}

async function close(id: string, actorId: number, who: "target" | "requester", status: SwapStatus, now: Date) {
  const [req] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
  if (!req) return fail("Swap request not found.");
  if (req.status !== "pending") return fail(`This request is already ${req.status}.`);
  const allowed = who === "target" ? req.targetId : req.requesterId;
  if (allowed !== actorId) return fail(who === "target" ? "Only the person being asked can decline." : "Only the requester can cancel.");
  await db
    .update(swapRequests)
    .set({ status, resolvedAt: now })
    .where(and(eq(swapRequests.id, id), eq(swapRequests.status, "pending")));
  return { ok: true } as const;
}

export const declineSwap = (id: string, actorId: number, now = new Date()): Promise<Result> =>
  close(id, actorId, "target", "declined", now);

export const cancelSwap = (id: string, actorId: number, now = new Date()): Promise<Result> =>
  close(id, actorId, "requester", "cancelled", now);

export type SwapDetail = {
  id: string;
  kind: SwapKind;
  status: SwapStatus;
  reason: string | null;
  requester: { id: number; name: string };
  target: { id: number; name: string };
  requesterSlot: { date: string; role: SlotRole };
  targetSlot: { date: string; role: SlotRole } | null;
};

export async function getSwapDetail(id: string): Promise<SwapDetail | null> {
  const [req] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
  if (!req) return null;
  const slotRows = await db
    .select({ id: slots.id, role: slots.role, date: serviceDates.date })
    .from(slots)
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .where(inArray(slots.id, [req.requesterSlotId, req.targetSlotId].filter(notNull)));
  const people = await db
    .select({ id: volunteers.id, name: volunteers.name })
    .from(volunteers)
    .where(inArray(volunteers.id, [req.requesterId, req.targetId]));
  const slot = (sid: number | null) => {
    const s = slotRows.find((x) => x.id === sid);
    return s ? { date: s.date, role: s.role } : null;
  };
  const person = (pid: number) => people.find((p) => p.id === pid) ?? { id: pid, name: "Unknown" };
  const requesterSlot = slot(req.requesterSlotId);
  if (!requesterSlot) return null;
  return {
    id: req.id,
    kind: req.kind,
    status: req.status,
    reason: req.reason,
    requester: person(req.requesterId),
    target: person(req.targetId),
    requesterSlot,
    targetSlot: slot(req.targetSlotId),
  };
}
