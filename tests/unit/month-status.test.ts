import { describe, expect, it } from "vitest";
import { canClaim, canSwap, effectiveStatus, nextStatus } from "@/lib/month-status";

const deadline = new Date("2026-10-30T15:59:00Z");
const before = new Date("2026-10-30T15:00:00Z");
const after = new Date("2026-10-30T16:00:00Z");

describe("effectiveStatus", () => {
  it("open before the deadline stays open", () => expect(effectiveStatus("open", deadline, before)).toBe("open"));
  it("open after the deadline is locked", () => expect(effectiveStatus("open", deadline, after)).toBe("locked"));
  it("published ignores the deadline", () => expect(effectiveStatus("published", deadline, after)).toBe("published"));
});

describe("permissions", () => {
  it("claims only while open", () => {
    expect(canClaim("open")).toBe(true);
    expect(canClaim("locked")).toBe(false);
    expect(canClaim("published")).toBe(false);
  });

  it("swaps while open or published, not during review", () => {
    expect(canSwap("open")).toBe(true);
    expect(canSwap("published")).toBe(true);
    expect(canSwap("locked")).toBe(false);
    expect(canSwap("draft")).toBe(false);
  });
});

describe("nextStatus", () => {
  it("allows lock from open", () => expect(nextStatus("open", "lock")).toBe("locked"));
  it("allows publish from draft", () => expect(nextStatus("draft", "publish")).toBe("published"));
  it("allows unpublish back to draft", () => expect(nextStatus("published", "unpublish")).toBe("draft"));
  it("rejects publish from open", () => expect(nextStatus("open", "publish")).toBeNull());
});
