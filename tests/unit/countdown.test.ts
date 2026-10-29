import { describe, expect, it } from "vitest";
import { countdownSummary, countdownUrgency, formatDeadline, splitCountdown } from "@/lib/countdown";

const SEC = 1000;
const MIN = 60 * SEC;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("splitCountdown", () => {
  it("splits a duration into days, hours, minutes and seconds", () => {
    expect(splitCountdown(2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC)).toEqual({ days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it("drops partial seconds", () => {
    expect(splitCountdown(59 * SEC + 999)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 59 });
  });

  it("clamps past and invalid durations to zero", () => {
    const zero = { days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(splitCountdown(-5 * SEC)).toEqual(zero);
    expect(splitCountdown(Number.NaN)).toEqual(zero);
  });
});

describe("countdownUrgency", () => {
  it("is normal with a day or more left", () => {
    expect(countdownUrgency(DAY)).toBe("normal");
    expect(countdownUrgency(10 * DAY)).toBe("normal");
  });

  it("is soon under 24 hours", () => {
    expect(countdownUrgency(DAY - 1)).toBe("soon");
    expect(countdownUrgency(HOUR)).toBe("soon");
  });

  it("is final under 1 hour", () => {
    expect(countdownUrgency(HOUR - 1)).toBe("final");
    expect(countdownUrgency(1)).toBe("final");
  });

  it("is closed at or past zero", () => {
    expect(countdownUrgency(0)).toBe("closed");
    expect(countdownUrgency(-1)).toBe("closed");
    expect(countdownUrgency(Number.NaN)).toBe("closed");
  });
});

describe("formatDeadline", () => {
  it("shows the Philippine wall-clock time of a UTC deadline", () => {
    // 15:59 UTC is 23:59 in Manila.
    expect(formatDeadline(new Date("2026-10-30T15:59:00Z"))).toBe("Fri 30 Oct, 11:59 PM");
  });

  it("rolls over to the next Manila day", () => {
    expect(formatDeadline(new Date("2026-10-30T16:05:00Z"))).toBe("Sat 31 Oct, 12:05 AM");
  });

  it("formats noon and morning hours", () => {
    expect(formatDeadline(new Date("2026-11-02T04:00:00Z"))).toBe("Mon 2 Nov, 12:00 PM");
    expect(formatDeadline(new Date("2026-11-02T01:07:00Z"))).toBe("Mon 2 Nov, 9:07 AM");
  });
});

describe("countdownSummary", () => {
  it("reads days, hours and minutes in words", () => {
    expect(countdownSummary(2 * DAY + 3 * HOUR + 4 * MIN + 5 * SEC)).toBe("2 days, 3 hours and 4 minutes left");
  });

  it("uses singular units and skips zero parts", () => {
    expect(countdownSummary(DAY + MIN)).toBe("1 day and 1 minute left");
    expect(countdownSummary(HOUR)).toBe("1 hour left");
  });

  it("handles the last minute and the closed state", () => {
    expect(countdownSummary(30 * SEC)).toBe("Less than a minute left");
    expect(countdownSummary(0)).toBe("Poll closed");
  });
});
