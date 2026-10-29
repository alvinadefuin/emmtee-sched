import { describe, expect, it } from "vitest";
import { announcementText } from "@/lib/announcement";

describe("announcementText", () => {
  it("fills in the month, link and Manila deadline", () => {
    expect(
      announcementText({
        monthLabel: "December 2026",
        url: "https://example.vercel.app",
        deadline: new Date("2026-11-27T15:59:00Z"),
      }),
    ).toBe(
      [
        "Guys, plot na tayo ng sched for December 2026 🙌",
        "👉 https://example.vercel.app",
        'Pili lang ng name, tap "Claim" sa available Sundays mo. No login needed!',
        "⏰ Deadline: Fri 27 Nov, 11:59 PM (PH time). Pag walang napili, auto-assign na 😉",
      ].join("\n"),
    );
  });

  it("drops a trailing slash from the link", () => {
    expect(
      announcementText({ monthLabel: "January 2027", url: "https://example.vercel.app/", deadline: new Date("2026-12-25T15:59:00Z") }),
    ).toContain("👉 https://example.vercel.app\n");
  });
});
