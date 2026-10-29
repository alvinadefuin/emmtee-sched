import { describe, expect, it } from "vitest";
import { clearSlotError, emptyRequiredSlots, publishBlockMessage } from "@/lib/required-slots";
import { REQUIRED_ROLES } from "@/lib/roles";

const s = (date: string, role: "laptop" | "assist" | "photog", volunteerId: number | null) => ({ date, role, volunteerId });

describe("REQUIRED_ROLES", () => {
  it("is Operator and Photog, not Assist", () => expect([...REQUIRED_ROLES]).toEqual(["laptop", "photog"]));
});

describe("emptyRequiredSlots", () => {
  it("ignores empty assist slots", () => {
    expect(emptyRequiredSlots([s("2026-11-01", "assist", null)])).toEqual([]);
  });
  it("ignores filled required slots", () => {
    expect(emptyRequiredSlots([s("2026-11-01", "laptop", 1), s("2026-11-01", "photog", 2)])).toEqual([]);
  });
  it("returns empty required slots in date order, then role order", () => {
    const out = emptyRequiredSlots([
      s("2026-11-22", "photog", null),
      s("2026-11-08", "photog", null),
      s("2026-11-08", "laptop", null),
      s("2026-11-15", "laptop", 3),
    ]);
    expect(out.map((x) => `${x.date} ${x.role}`)).toEqual(["2026-11-08 laptop", "2026-11-08 photog", "2026-11-22 photog"]);
  });
});

describe("publishBlockMessage", () => {
  it("is null when nothing is empty", () => expect(publishBlockMessage([])).toBeNull());
  it("names the empty slots", () => {
    expect(publishBlockMessage([s("2026-11-08", "photog", null), s("2026-11-22", "laptop", null)])).toBe(
      "Fill every Laptop Operator and Photog slot before publishing. Empty: Nov 8 Photog, Nov 22 Laptop — Operator.",
    );
  });
  it("shortens a long list", () => {
    const many = ["01", "08", "15", "22", "29"].map((d) => s(`2026-11-${d}`, "photog", null));
    const msg = publishBlockMessage(many)!;
    expect(msg).toContain("Nov 1 Photog, Nov 8 Photog, Nov 15 Photog and 2 more.");
  });
});

describe("clearSlotError", () => {
  const msg = "Operator and Photog can't be left empty on a published schedule. Pick someone else instead.";
  it("refuses clearing a required slot when published", () => {
    expect(clearSlotError("laptop", "published", null)).toBe(msg);
    expect(clearSlotError("photog", "published", null)).toBe(msg);
  });
  it("allows clearing assist when published", () => expect(clearSlotError("assist", "published", null)).toBeNull());
  it("allows clearing a required slot before publishing", () => expect(clearSlotError("laptop", "draft", null)).toBeNull());
  it("allows replacing a required slot when published", () => expect(clearSlotError("photog", "published", 4)).toBeNull());
});
