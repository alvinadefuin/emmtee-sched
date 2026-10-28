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
