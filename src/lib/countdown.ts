const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const MANILA_OFFSET_MS = 8 * HOUR;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type CountdownParts = { days: number; hours: number; minutes: number; seconds: number };
export type Urgency = "normal" | "soon" | "final" | "closed";

const clamp = (ms: number) => (Number.isFinite(ms) && ms > 0 ? ms : 0);

/** Whole days, hours, minutes and seconds left in `ms`; zero once the time has passed. */
export function splitCountdown(ms: number): CountdownParts {
  const total = Math.floor(clamp(ms) / SEC);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/** Normal with a day or more left, "soon" under 24 hours, "final" under 1 hour. */
export function countdownUrgency(ms: number): Urgency {
  const left = clamp(ms);
  if (left === 0) return "closed";
  if (left < HOUR) return "final";
  if (left < DAY) return "soon";
  return "normal";
}

/** A UTC instant as Manila wall-clock time, e.g. "Fri 30 Oct, 11:59 PM". */
export function formatDeadline(instant: Date): string {
  // Manila has no daylight saving, so a fixed +8h offset is exact.
  const d = new Date(instant.getTime() + MANILA_OFFSET_MS);
  const h = d.getUTCHours();
  const hour12 = h % 12 || 12;
  const mins = String(d.getUTCMinutes()).padStart(2, "0");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hour12}:${mins} ${h < 12 ? "AM" : "PM"}`;
}

/** Plain-words time left for screen readers, to the minute. */
export function countdownSummary(ms: number): string {
  if (countdownUrgency(ms) === "closed") return "Poll closed";
  const { days, hours, minutes } = splitCountdown(ms);
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  const parts = [
    days > 0 ? unit(days, "day") : null,
    hours > 0 ? unit(hours, "hour") : null,
    minutes > 0 ? unit(minutes, "minute") : null,
  ].filter((p): p is string => p !== null);
  if (parts.length === 0) return "Less than a minute left";
  const words = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${words} left`;
}
