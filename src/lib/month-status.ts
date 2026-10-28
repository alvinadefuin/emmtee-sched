import { fail, type Result } from "./result";
import type { MonthStatus } from "./roles";

/** The stored status, except an open poll past its deadline counts as locked. */
export function effectiveStatus(stored: MonthStatus, deadline: Date, now: Date): MonthStatus {
  return stored === "open" && now.getTime() > deadline.getTime() ? "locked" : stored;
}

export const canClaim = (status: MonthStatus): boolean => status === "open";

// Swaps pause while the organiser reviews, so the draft cannot change under them.
export const canSwap = (status: MonthStatus): boolean => status === "open" || status === "published";

export type MonthOp = "lock" | "reopen" | "publish" | "unpublish";

const TRANSITIONS: Record<MonthOp, { from: MonthStatus[]; to: MonthStatus }> = {
  lock: { from: ["open"], to: "locked" },
  reopen: { from: ["locked", "draft"], to: "open" },
  publish: { from: ["locked", "draft"], to: "published" },
  unpublish: { from: ["published"], to: "draft" },
};

export function nextStatus(current: MonthStatus, op: MonthOp): MonthStatus | null {
  const t = TRANSITIONS[op];
  return t.from.includes(current) ? t.to : null;
}

/** Works out a month transition from the stored status, with a message when it is not allowed. */
export function planTransition(stored: MonthStatus, deadline: Date, now: Date, op: MonthOp): Result<{ to: MonthStatus }> {
  // An open poll past its deadline already reads as locked; locking it just stores that.
  if (op === "lock" && stored === "open") return { ok: true, to: "locked" };
  const current = effectiveStatus(stored, deadline, now);
  const to = nextStatus(current, op);
  if (!to) return fail(op === "reopen" && current === "open" ? "The poll is already open." : `Can't ${op} from the current status.`);
  if (op === "reopen" && deadline.getTime() <= now.getTime()) return fail("Move the deadline later before reopening the poll.");
  return { ok: true, to };
}
