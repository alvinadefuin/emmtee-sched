import { shortDate } from "./dates";
import { isRequiredRole, ROLE_LABEL, SLOT_ROLES, type MonthStatus, type SlotRole } from "./roles";

export type SlotLike = { date: string; role: SlotRole; volunteerId: number | null };

/** Empty Operator and Photog slots, in date order (then Operator before Photog). */
export function emptyRequiredSlots<T extends SlotLike>(slots: readonly T[]): T[] {
  return slots
    .filter((s) => s.volunteerId === null && isRequiredRole(s.role))
    .sort((a, b) => a.date.localeCompare(b.date) || SLOT_ROLES.indexOf(a.role) - SLOT_ROLES.indexOf(b.role));
}

const MAX_NAMED = 3;

/** Why publishing is blocked by these empty required slots, or null when none are empty. */
export function publishBlockMessage(empty: readonly SlotLike[]): string | null {
  if (empty.length === 0) return null;
  const named = empty.slice(0, MAX_NAMED).map((s) => `${shortDate(s.date)} ${ROLE_LABEL[s.role]}`);
  const more = empty.length - named.length;
  const list = more > 0 ? `${named.join(", ")} and ${more} more` : named.join(", ");
  return `Fill every Laptop Operator and Photog slot before publishing. Empty: ${list}.`;
}

/** The refusal when clearing this slot would leave a required role blank on a published month. */
export function clearSlotError(role: SlotRole, status: MonthStatus, volunteerId: number | null): string | null {
  if (volunteerId !== null || status !== "published" || !isRequiredRole(role)) return null;
  return "Operator and Photog can't be left empty on a published schedule. Pick someone else instead.";
}
