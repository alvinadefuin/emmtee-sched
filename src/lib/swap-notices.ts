import type { SwapStatus } from "./roles";

export type SwapLite = { id: string; requesterId: number; targetId: number; status: SwapStatus };

/**
 * What this device has already seen for one volunteer: pending requests addressed to them,
 * and pending requests they sent (watched so an accept or decline can be reported).
 */
export type SeenSwaps = { incoming: string[]; outgoing: string[] };

export type SwapNotice = { type: "incoming" | "accepted" | "declined"; id: string };

/**
 * Compares the swaps on the page with what this device saw before for `me`.
 * - A pending request to `me` not seen before -> "incoming".
 * - A watched request from `me` that is now accepted or declined -> "accepted" / "declined".
 * With no history (`seen` null) it records the current state and reports nothing,
 * so choosing a name does not flood the screen with old requests.
 * Returns the notices and the new state to store.
 */
export function diffSwapNotices(
  seen: SeenSwaps | null,
  swaps: readonly SwapLite[],
  me: number,
): { notices: SwapNotice[]; seen: SeenSwaps } {
  const pending = swaps.filter((s) => s.status === "pending");
  const next: SeenSwaps = {
    incoming: pending.filter((s) => s.targetId === me).map((s) => s.id),
    outgoing: pending.filter((s) => s.requesterId === me).map((s) => s.id),
  };
  if (!seen) return { notices: [], seen: next };

  const notices: SwapNotice[] = [];
  for (const id of next.incoming) {
    if (!seen.incoming.includes(id)) notices.push({ type: "incoming", id });
  }
  for (const id of seen.outgoing) {
    const s = swaps.find((x) => x.id === id && x.requesterId === me);
    if (s && (s.status === "accepted" || s.status === "declined")) notices.push({ type: s.status, id });
  }
  return { notices, seen: next };
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** Reads a stored SeenSwaps value; anything missing or malformed reads as null (no history). */
export function parseSeenSwaps(raw: string | null): SeenSwaps | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { incoming, outgoing } = v as Record<string, unknown>;
    return isStringArray(incoming) && isStringArray(outgoing) ? { incoming, outgoing } : null;
  } catch {
    return null;
  }
}
