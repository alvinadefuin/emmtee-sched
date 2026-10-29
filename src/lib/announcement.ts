import { formatDeadline } from "./countdown";

/** The ready-to-paste group chat message that opens a month's poll. */
export function announcementText(input: { monthLabel: string; url: string; deadline: Date }): string {
  const url = input.url.replace(/\/+$/, "");
  return [
    `Guys, plot na tayo ng sched for ${input.monthLabel} 🙌`,
    `👉 ${url}`,
    'Pili lang ng name, tap "Claim" sa available Sundays mo. No login needed!',
    `⏰ Deadline: ${formatDeadline(input.deadline)} (PH time). Pag walang napili, auto-assign na 😉`,
  ].join("\n");
}
