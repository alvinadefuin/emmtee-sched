const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function sundaysInMonth(year: number, month: number): string[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];
  for (let day = 1; day <= days; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDay() === 0) out.push(toIso(d));
  }
  return out;
}

/** Last Friday strictly before the 1st of the month, 23:59 Asia/Manila. */
export function defaultDeadline(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const back = (first.getUTCDay() - 5 + 7) % 7 || 7;
  const friday = new Date(first);
  friday.setUTCDate(first.getUTCDate() - back);
  // 23:59 in Manila is 15:59 UTC the same day.
  return new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate(), 15, 59));
}

/** Value for <input type="datetime-local"> showing Manila wall-clock time. */
export function manilaInputValue(instant: Date): string {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 16);
}

export function parseManilaInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatManila(instant: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Closed";
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins === 0) return "under 1 min";
  const days = Math.floor(totalMins / 1440);
  const hrs = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (days > 0) return `${unit(days, "day")} ${unit(hrs, "hr")}`;
  if (hrs > 0) return `${unit(hrs, "hr")} ${unit(mins, "min")}`;
  return unit(mins, "min");
}

export function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

export const monthName = (month: number): string => MONTHS[month - 1];

export const monthLabel = (year: number, month: number): string => `${MONTHS[month - 1]} ${year}`;

export const ym = (year: number, month: number): string => `${year}-${String(month).padStart(2, "0")}`;

export function parseYm(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}
