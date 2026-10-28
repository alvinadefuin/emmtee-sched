import { describe, expect, it } from "vitest";
import { validateSwap, type SwapCheck, type SwapSlot } from "@/lib/swap-rules";
import type { Role } from "@/lib/roles";

// Two Sundays (dateId 100, 200). A=1, B=2, C=3, D=4.
const baseSlots: SwapSlot[] = [
  { id: 1, dateId: 100, role: "laptop", volunteerId: 1 },
  { id: 2, dateId: 100, role: "photog", volunteerId: 3 },
  { id: 3, dateId: 200, role: "laptop", volunteerId: 2 },
  { id: 4, dateId: 200, role: "photog", volunteerId: 4 },
];
const eligibility = (extra: Record<number, Role[]> = {}) =>
  new Map<number, Role[]>(
    Object.entries({ 1: ["laptop"], 2: ["laptop"], 3: ["laptop", "photog"], 4: ["photog"], ...extra }).map(
      ([k, v]): [number, Role[]] => [Number(k), v as Role[]],
    ),
  );

const exchange = (over: Partial<SwapCheck> = {}): SwapCheck => ({
  kind: "exchange",
  requesterId: 1,
  requesterSlotId: 1,
  targetId: 2,
  targetSlotId: 3,
  status: "open",
  slots: baseSlots,
  eligibility: eligibility(),
  ...over,
});

describe("validateSwap", () => {
  it("accepts a plain exchange between two laptop operators", () => {
    expect(validateSwap(exchange())).toEqual({ ok: true });
  });

  it("is blocked while the organiser reviews the draft", () => {
    expect(validateSwap(exchange({ status: "draft" }))).toMatchObject({ ok: false });
  });

  it("rejects swapping with yourself", () => {
    expect(validateSwap(exchange({ targetId: 1 }))).toMatchObject({ ok: false });
  });

  it("rejects when the target is not eligible for the requester's role", () => {
    const r = validateSwap(exchange({ targetId: 4, targetSlotId: 4 }));
    expect(r).toEqual({ ok: false, reason: "They are not on the roster for this role." });
  });

  it("rejects when the target slot has changed hands", () => {
    const slots = baseSlots.map((s) => (s.id === 3 ? { ...s, volunteerId: 4 } : s));
    expect(validateSwap(exchange({ slots }))).toEqual({
      ok: false,
      reason: "That slot has changed hands since the request was made.",
    });
  });

  it("allows two people to trade roles on the same Sunday", () => {
    const r = validateSwap(
      exchange({ targetId: 3, targetSlotId: 2, eligibility: eligibility({ 1: ["laptop", "photog"] }) }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("accepts a hand-over to someone free that Sunday", () => {
    expect(validateSwap(exchange({ kind: "handover", targetSlotId: null }))).toEqual({ ok: true });
  });

  it("rejects a hand-over to someone already serving that Sunday", () => {
    const r = validateSwap(exchange({ kind: "handover", targetId: 3, targetSlotId: null }));
    expect(r).toEqual({ ok: false, reason: "They already have a role on that Sunday." });
  });
});
