import { describe, expect, it } from "vitest";
import {
  defaultDeadline,
  formatCountdown,
  manilaInputValue,
  monthLabel,
  parseManilaInput,
  parseYm,
  shortDate,
  sundaysInMonth,
  ym,
} from "@/lib/dates";

describe("sundaysInMonth", () => {
  it("lists five Sundays in November 2026", () => {
    expect(sundaysInMonth(2026, 11)).toEqual([
      "2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29",
    ]);
  });

  it("lists four Sundays in December 2026", () => {
    expect(sundaysInMonth(2026, 12)).toEqual(["2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"]);
  });

  it("matches the August 2026 poster", () => {
    expect(sundaysInMonth(2026, 8)).toEqual([
      "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30",
    ]);
  });
});

describe("defaultDeadline (last Friday before the 1st, 23:59 Manila)", () => {
  it("December 2026 → Fri 27 Nov 23:59 PHT", () => {
    expect(defaultDeadline(2026, 12).toISOString()).toBe("2026-11-27T15:59:00.000Z");
  });

  it("November 2026 (1st is Sunday) → Fri 30 Oct", () => {
    expect(defaultDeadline(2026, 11).toISOString()).toBe("2026-10-30T15:59:00.000Z");
  });

  it("August 2026 (1st is Saturday) → the day before", () => {
    expect(defaultDeadline(2026, 8).toISOString()).toBe("2026-07-31T15:59:00.000Z");
  });

  it("January 2027 (1st is Friday) → the Friday a week before", () => {
    expect(defaultDeadline(2027, 1).toISOString()).toBe("2026-12-25T15:59:00.000Z");
  });
});

describe("Manila input conversion", () => {
  it("formats a UTC instant as a Manila datetime-local value", () => {
    expect(manilaInputValue(new Date("2026-11-27T15:59:00Z"))).toBe("2026-11-27T23:59");
  });

  it("parses a Manila datetime-local value back to the same instant", () => {
    expect(parseManilaInput("2026-11-27T23:59")?.toISOString()).toBe("2026-11-27T15:59:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(parseManilaInput("27/11/2026")).toBeNull();
  });
});

describe("formatCountdown", () => {
  const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR;
  it("days and hours", () => expect(formatCountdown(2 * DAY + 4 * HR + 5 * MIN)).toBe("2 days 4 hrs"));
  it("singular units", () => expect(formatCountdown(DAY + HR)).toBe("1 day 1 hr"));
  it("hours and minutes", () => expect(formatCountdown(3 * HR + 12 * MIN)).toBe("3 hrs 12 mins"));
  it("minutes only", () => expect(formatCountdown(12 * MIN + 30_000)).toBe("12 mins"));
  it("under a minute", () => expect(formatCountdown(30_000)).toBe("under 1 min"));
  it("closed", () => expect(formatCountdown(0)).toBe("Closed"));
});

describe("labels", () => {
  it("shortDate", () => expect(shortDate("2026-11-08")).toBe("Nov 8"));
  it("monthLabel", () => expect(monthLabel(2026, 11)).toBe("November 2026"));
  it("ym round-trips", () => {
    expect(ym(2026, 3)).toBe("2026-03");
    expect(parseYm("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(parseYm("2026-13")).toBeNull();
  });
});
