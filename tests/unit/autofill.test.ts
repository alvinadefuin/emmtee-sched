import { describe, expect, it } from "vitest";
import { autofill, type AutofillSlot, type AutofillVolunteer } from "@/lib/autofill";
import type { SlotRole } from "@/lib/roles";

const NOV = ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"];

function makeSlots(dates: string[], roles: SlotRole[]): AutofillSlot[] {
  let id = 1;
  return dates.flatMap((date) => roles.map((role) => ({ id: id++, date, role, volunteerId: null, source: null })));
}

const gapDays = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

describe("autofill", () => {
  it("keeps claimed slots untouched", () => {
    const slots = makeSlots(NOV, ["photog"]);
    slots[0] = { ...slots[0], volunteerId: 10, source: "claimed" };
    const vols: AutofillVolunteer[] = [{ id: 10, roles: ["photog"] }, { id: 11, roles: ["photog"] }];
    const { slots: out } = autofill(slots, vols, 1);
    expect(out.find((s) => s.id === slots[0].id)).toMatchObject({ volunteerId: 10, source: "claimed" });
  });

  it("gives every eligible volunteer at least one date and fills every laptop slot", () => {
    const vols: AutofillVolunteer[] = [1, 2, 3, 4].map((id) => ({ id, roles: ["laptop"] }));
    const { slots: out, unfilled } = autofill(makeSlots(NOV, ["laptop"]), vols, 7);
    for (const v of vols) expect(out.some((s) => s.volunteerId === v.id)).toBe(true);
    expect(unfilled).toHaveLength(0);
  });

  it("never gives one person two roles on the same Sunday", () => {
    const vols: AutofillVolunteer[] = [
      { id: 1, roles: ["laptop"] },
      { id: 2, roles: ["laptop"] },
      { id: 3, roles: ["laptop", "photog"] },
      { id: 4, roles: ["photog"] },
    ];
    const { slots: out } = autofill(makeSlots(NOV, ["laptop", "photog"]), vols, 3);
    for (const date of NOV) {
      const ids = out.filter((s) => s.date === date && s.volunteerId !== null).map((s) => s.volunteerId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("spaces a person's dates in one role at least 14 days apart when possible", () => {
    const vols: AutofillVolunteer[] = [{ id: 10, roles: ["photog"] }, { id: 11, roles: ["photog"] }];
    const { slots: out, unfilled } = autofill(makeSlots(NOV, ["photog"]), vols, 5);
    expect(unfilled).toHaveLength(0);
    for (const v of vols) {
      const dates = out.filter((s) => s.volunteerId === v.id).map((s) => s.date).sort();
      for (let i = 1; i < dates.length; i++) expect(gapDays(dates[i - 1], dates[i])).toBeGreaterThanOrEqual(14);
    }
  });

  it("relaxes to a 7-day gap rather than leave a slot empty", () => {
    const { unfilled } = autofill(makeSlots(NOV, ["photog"]), [{ id: 10, roles: ["photog"] }], 1);
    expect(unfilled).toHaveLength(0);
  });

  it("leaves slots empty when nobody is eligible", () => {
    const { unfilled } = autofill(makeSlots(NOV, ["photog"]), [{ id: 1, roles: ["laptop"] }], 1);
    expect(unfilled).toHaveLength(5);
  });

  it("gives interns one date each and does not force-fill the rest", () => {
    const vols: AutofillVolunteer[] = [{ id: 20, roles: ["assist"] }, { id: 21, roles: ["assist"] }];
    const { slots: out, unfilled } = autofill(makeSlots(NOV, ["assist"]), vols, 1);
    expect(out.filter((s) => s.volunteerId !== null)).toHaveLength(2);
    expect(unfilled).toHaveLength(0); // empty assist slots are normal, not "unfilled"
  });

  it("re-running discards earlier auto picks but keeps claims", () => {
    const slots = makeSlots(NOV, ["laptop"]);
    slots[0] = { ...slots[0], volunteerId: 1, source: "claimed" };
    slots[1] = { ...slots[1], volunteerId: 99, source: "auto" }; // 99 is no longer active
    const vols: AutofillVolunteer[] = [1, 2, 3].map((id) => ({ id, roles: ["laptop"] }));
    const { slots: out } = autofill(slots, vols, 2);
    expect(out.some((s) => s.volunteerId === 99)).toBe(false);
    expect(out[0]).toMatchObject({ volunteerId: 1, source: "claimed" });
  });

  it("is deterministic for a given seed", () => {
    const vols: AutofillVolunteer[] = [1, 2, 3, 4].map((id) => ({ id, roles: ["laptop"] }));
    const a = autofill(makeSlots(NOV, ["laptop"]), vols, 42).slots.map((s) => s.volunteerId);
    const b = autofill(makeSlots(NOV, ["laptop"]), vols, 42).slots.map((s) => s.volunteerId);
    expect(a).toEqual(b);
  });
});
