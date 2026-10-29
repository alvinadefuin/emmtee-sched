import { effectiveStatus } from "./month-status";

/** What the organiser must type before a month is reset. */
export const RESET_PHRASE = "RESET";

export const confirmsReset = (typed: string | null | undefined): boolean =>
  (typed ?? "").trim().toUpperCase() === RESET_PHRASE;

/** Success message after a reset: the month is stored as open, but a passed deadline still reads as locked. */
export function resetMessage(deadline: Date, now: Date): string {
  return effectiveStatus("open", deadline, now) === "open"
    ? "Month reset. The poll is open again."
    : "Month reset. Move the deadline later to reopen the poll.";
}
