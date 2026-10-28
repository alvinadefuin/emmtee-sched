import { describe, expect, it } from "vitest";
import { autofill, type AutofillSlot, type AutofillVolunteer } from "@/lib/autofill";
import type { SlotRole } from "@/lib/roles";

const NOV = ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"];

function makeSlots(dates: string[], roles: SlotRole[]): AutofillSlot[] {
  let id = 1;
  return dates.flatMap((date) => roles.map((role) => ({ id: id++, date, role, volunteerId: null, source: null })));
}

const gapDays = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

function expectNoSameDayDoubles(out: AutofillSlot[]) {
  for (const date of new Set(out.map((s) => s.date))) {
    const ids = out.filter((s) => s.date === date && s.volunteerId !== null).map((s) => s.volunteerId);
    expect(new Set(ids).size).toBe(ids.length);
  }
}

/** Brute force: can every non-assist slot be filled under the hard rules alone? */
function completeFillExists(slots: AutofillSlot[], vols: AutofillVolunteer[]): boolean {
  for (const date of new Set(slots.map((s) => s.date))) {
    const onDate = slots.filter((s) => s.date === date);
    const busy = new Set(onDate.filter((s) => s.source === "claimed" || s.source === "manual").map((s) => s.volunteerId));
    const open = onDate.filter((s) => s.volunteerId === null && s.role !== "assist");
    const match = (i: number, used: Set<number>): boolean =>
      i === open.length ||
      vols.some(
        (v) =>
          !busy.has(v.id) && !used.has(v.id) && v.roles.includes(open[i].role) && match(i + 1, new Set([...used, v.id])),
      );
    if (!match(0, new Set())) return false;
  }
  return true;
}

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

  it("does not depend on the order volunteers are passed in", () => {
    const vols: AutofillVolunteer[] = [
      { id: 1, roles: ["laptop"] },
      { id: 2, roles: ["laptop", "photog"] },
      { id: 3, roles: ["photog"] },
      { id: 4, roles: ["laptop", "assist"] },
      { id: 5, roles: ["assist", "photog"] },
    ];
    for (const seed of [1, 2, 3, 42]) {
      const a = autofill(makeSlots(NOV, ["laptop", "assist", "photog"]), vols, seed);
      const b = autofill(makeSlots(NOV, ["laptop", "assist", "photog"]).reverse(), [...vols].reverse(), seed);
      expect(b).toEqual(a);
    }
  });

  describe("fills every slot when a complete fill exists", () => {
    it("a: a two-role volunteer is not stuck on the role someone else could cover", () => {
      const vols: AutofillVolunteer[] = [{ id: 1, roles: ["photog"] }, { id: 2, roles: ["laptop", "photog"] }];
      const { slots: out, unfilled } = autofill(makeSlots(NOV, ["laptop", "photog"]), vols, 1);
      expect(unfilled).toHaveLength(0);
      expectNoSameDayDoubles(out);
    });

    it("b: 14-day preference does not block the only remaining photog", () => {
      const vols: AutofillVolunteer[] = [{ id: 1, roles: ["laptop", "photog"] }, { id: 2, roles: ["laptop"] }];
      const { slots: out, unfilled } = autofill(makeSlots(NOV.slice(0, 4), ["laptop", "photog"]), vols, 1);
      expect(unfilled).toHaveLength(0);
      expectNoSameDayDoubles(out);
    });

    it("c: the only laptop volunteer is not spent on a photog date", () => {
      const vols: AutofillVolunteer[] = [
        { id: 3, roles: ["laptop", "photog"] },
        { id: 4, roles: ["photog"] },
        { id: 5, roles: ["photog"] },
        { id: 6, roles: ["photog"] },
      ];
      const { slots: out, unfilled } = autofill(makeSlots(NOV, ["laptop", "photog"]), vols, 1);
      expect(unfilled).toHaveLength(0);
      expectNoSameDayDoubles(out);
    });

    it("moves a volunteer off an assist date when only they can take the laptop", () => {
      const vols: AutofillVolunteer[] = [{ id: 1, roles: ["laptop", "assist"] }];
      const { slots: out, unfilled } = autofill(makeSlots(NOV.slice(0, 1), ["laptop", "assist"]), vols, 1);
      expect(unfilled).toHaveLength(0);
      expectNoSameDayDoubles(out);
    });

    it("holds across random small rosters", () => {
      const roles: SlotRole[] = ["laptop", "assist", "photog"];
      let checked = 0;
      for (let seed = 1; seed <= 400; seed++) {
        let s = seed;
        const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
        const vols: AutofillVolunteer[] = [1, 2, 3, 4]
          .slice(0, 2 + Math.floor(rnd() * 3))
          .map((id) => ({ id, roles: roles.filter(() => rnd() < 0.5) }));
        const claimedOn = new Set<string>();
        const slots = makeSlots(NOV.slice(0, 4), roles).map((slot) => {
          if (claimedOn.has(slot.date) || rnd() >= 0.15) return slot;
          claimedOn.add(slot.date);
          return { ...slot, volunteerId: vols[0].id, source: "claimed" as const };
        });
        if (!completeFillExists(slots, vols)) continue;
        checked++;
        const { slots: out, unfilled } = autofill(slots, vols, seed);
        expect(unfilled, `seed ${seed}`).toHaveLength(0);
        expectNoSameDayDoubles(out);
        for (const slot of slots.filter((x) => x.source === "claimed")) {
          expect(out.find((x) => x.id === slot.id)).toMatchObject({ volunteerId: slot.volunteerId, source: "claimed" });
        }
      }
      expect(checked).toBeGreaterThan(50);
    });
  });
});
