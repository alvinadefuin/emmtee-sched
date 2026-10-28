import { canSwap } from "./month-status";
import type { MonthStatus, Role, SlotRole, SwapKind } from "./roles";

export type SwapSlot = { id: number; dateId: number; role: SlotRole; volunteerId: number | null };

export type SwapCheck = {
  kind: SwapKind;
  requesterId: number;
  requesterSlotId: number;
  targetId: number;
  targetSlotId: number | null;
  status: MonthStatus;
  /** Every slot in the month, as currently stored. */
  slots: SwapSlot[];
  eligibility: Map<number, readonly Role[]>;
};

export type SwapVerdict = { ok: true } | { ok: false; reason: string };

const no = (reason: string): SwapVerdict => ({ ok: false, reason });

export function validateSwap(c: SwapCheck): SwapVerdict {
  if (!canSwap(c.status)) return no("Swaps are paused while the organiser reviews the schedule.");
  if (c.requesterId === c.targetId) return no("You can't swap with yourself.");

  const mine = c.slots.find((s) => s.id === c.requesterSlotId);
  if (!mine || mine.volunteerId !== c.requesterId) return no("The requester no longer holds that slot.");

  const eligible = (vId: number, role: SlotRole) => (c.eligibility.get(vId) ?? []).includes(role);
  const busyOn = (vId: number, dateId: number, ignore: number[]) =>
    c.slots.some((s) => s.volunteerId === vId && s.dateId === dateId && !ignore.includes(s.id));

  if (c.kind === "handover") {
    if (c.targetSlotId !== null) return no("A hand-over cannot include a second slot.");
    if (!eligible(c.targetId, mine.role)) return no("They are not on the roster for this role.");
    if (busyOn(c.targetId, mine.dateId, [])) return no("They already have a role on that Sunday.");
    return { ok: true };
  }

  const theirs = c.slots.find((s) => s.id === c.targetSlotId);
  if (!theirs || theirs.volunteerId !== c.targetId) return no("That slot has changed hands since the request was made.");
  if (!eligible(c.targetId, mine.role)) return no("They are not on the roster for this role.");
  if (!eligible(c.requesterId, theirs.role)) return no("You are not on the roster for that role.");
  if (busyOn(c.requesterId, theirs.dateId, [mine.id, theirs.id])) return no("You already have another role on that Sunday.");
  if (busyOn(c.targetId, mine.dateId, [mine.id, theirs.id])) return no("They already have another role on that Sunday.");
  return { ok: true };
}
