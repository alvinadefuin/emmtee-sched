import { describe, expect, it } from "vitest";
import { canonicalJson, monthVersion, swapVersion, versionHash, type MonthSnapshot, type SwapSnapshot } from "@/lib/version";

const deadline = new Date("2026-10-30T15:59:00Z");
const before = new Date("2026-10-30T15:00:00Z");
const after = new Date("2026-10-30T16:00:00Z");

const month: MonthSnapshot = {
  month: { id: 1, year: 2026, month: 11, status: "open", deadline, theme: "teal", posterVolunteerId: 3, notes: "" },
  months: [{ id: 1, year: 2026, month: 11 }, { id: 0, year: 2026, month: 10 }],
  dates: [{ id: 10, date: "2026-11-01" }, { id: 11, date: "2026-11-08" }],
  slots: [
    { id: 100, dateId: 10, role: "laptop", volunteerId: 1 },
    { id: 101, dateId: 10, role: "assist", volunteerId: null },
    { id: 102, dateId: 11, role: "photog", volunteerId: 2 },
  ],
  swaps: [{ id: "a", status: "pending" }, { id: "b", status: "accepted" }],
  volunteers: [
    { id: 1, name: "Volunteer A", active: true, posterOrder: null, roles: ["laptop", "assist"] },
    { id: 2, name: "Volunteer B", active: true, posterOrder: 1, roles: ["photog"] },
  ],
};

const swap: SwapSnapshot = {
  id: "a",
  status: "pending",
  reason: null,
  monthStatus: "open",
  deadline,
  slots: [{ id: 100, volunteerId: 1 }, { id: 102, volunteerId: 2 }],
  volunteers: [{ id: 1, name: "Volunteer A", active: true }, { id: 2, name: "Volunteer B", active: true }],
};

describe("canonicalJson", () => {
  it("ignores object key order", () => {
    expect(canonicalJson({ a: 1, b: [2, 3] })).toBe(canonicalJson({ b: [2, 3], a: 1 }));
  });

  it("treats arrays as unordered sets", () => {
    expect(canonicalJson([{ id: 2 }, { id: 1 }])).toBe(canonicalJson([{ id: 1 }, { id: 2 }]));
  });

  it("serialises dates as ISO strings and keeps null distinct from missing", () => {
    expect(canonicalJson({ d: deadline })).toBe(canonicalJson({ d: deadline.toISOString() }));
    expect(canonicalJson({ a: null })).not.toBe(canonicalJson({}));
  });
});

describe("versionHash", () => {
  it("is 16 lowercase hex characters and stable", () => {
    const v = versionHash({ a: 1 });
    expect(v).toMatch(/^[0-9a-f]{16}$/);
    expect(versionHash({ a: 1 })).toBe(v);
    expect(versionHash({ a: 2 })).not.toBe(v);
  });
});

describe("monthVersion", () => {
  const base = monthVersion(month, before);
  const changed = (patch: Partial<MonthSnapshot>) => monthVersion({ ...month, ...patch }, before);
  const changedMonth = (patch: Partial<NonNullable<MonthSnapshot["month"]>>) =>
    changed({ month: { ...month.month!, ...patch } });

  it("does not depend on row order", () => {
    const shuffled: MonthSnapshot = {
      ...month,
      months: [...month.months].reverse(),
      dates: [...month.dates].reverse(),
      slots: [...month.slots].reverse(),
      swaps: [...month.swaps].reverse(),
      volunteers: [...month.volunteers].reverse().map((v) => ({ ...v, roles: [...v.roles].reverse() })),
    };
    expect(monthVersion(shuffled, before)).toBe(base);
  });

  it("changes when a slot holder changes", () => {
    expect(changed({ slots: month.slots.map((s) => (s.id === 101 ? { ...s, volunteerId: 2 } : s)) })).not.toBe(base);
  });

  it("changes with the stored status, deadline, theme, poster and notes", () => {
    expect(changedMonth({ status: "draft" })).not.toBe(base);
    expect(changedMonth({ deadline: new Date("2026-10-31T15:59:00Z") })).not.toBe(base);
    expect(changedMonth({ theme: "peach" })).not.toBe(base);
    expect(changedMonth({ posterVolunteerId: null })).not.toBe(base);
    expect(changedMonth({ notes: "x" })).not.toBe(base);
  });

  it("changes when an open month passes its deadline", () => {
    expect(monthVersion(month, after)).not.toBe(base);
    // Only the effective status matters, not the clock itself.
    expect(monthVersion(month, new Date("2026-10-30T15:30:00Z"))).toBe(base);
  });

  it("changes when service dates change", () => {
    expect(changed({ dates: month.dates.slice(1) })).not.toBe(base);
  });

  it("changes when a swap request is added or resolved", () => {
    expect(changed({ swaps: [...month.swaps, { id: "c", status: "pending" }] })).not.toBe(base);
    expect(changed({ swaps: month.swaps.map((s) => (s.id === "a" ? { ...s, status: "declined" } : s)) })).not.toBe(base);
  });

  it("changes with roster names, active flags and roles", () => {
    const vol = (patch: Partial<MonthSnapshot["volunteers"][number]>) =>
      changed({ volunteers: month.volunteers.map((v) => (v.id === 1 ? { ...v, ...patch } : v)) });
    expect(vol({ name: "Volunteer Z" })).not.toBe(base);
    expect(vol({ active: false })).not.toBe(base);
    expect(vol({ roles: ["laptop"] })).not.toBe(base);
  });

  it("changes when a month is added to the list", () => {
    expect(changed({ months: [...month.months, { id: 2, year: 2026, month: 12 }] })).not.toBe(base);
  });

  it("handles no month at all", () => {
    const none = changed({ month: null, dates: [], slots: [], swaps: [] });
    expect(none).toMatch(/^[0-9a-f]{16}$/);
    expect(none).not.toBe(base);
  });
});

describe("swapVersion", () => {
  const base = swapVersion(swap, before);

  it("does not depend on row order", () => {
    expect(swapVersion({ ...swap, slots: [...swap.slots].reverse(), volunteers: [...swap.volunteers].reverse() }, before)).toBe(base);
  });

  it("changes with the request status and reason", () => {
    expect(swapVersion({ ...swap, status: "accepted" }, before)).not.toBe(base);
    expect(swapVersion({ ...swap, reason: "Slot changed" }, before)).not.toBe(base);
  });

  it("changes when a slot holder changes", () => {
    expect(swapVersion({ ...swap, slots: [{ id: 100, volunteerId: 2 }, { id: 102, volunteerId: 1 }] }, before)).not.toBe(base);
  });

  it("changes with the month's effective status", () => {
    expect(swapVersion({ ...swap, monthStatus: "published" }, before)).not.toBe(base);
    expect(swapVersion(swap, after)).not.toBe(base);
  });

  it("changes with roster names and active flags", () => {
    expect(swapVersion({ ...swap, volunteers: [swap.volunteers[0], { id: 2, name: "Volunteer B", active: false }] }, before)).not.toBe(base);
  });
});
