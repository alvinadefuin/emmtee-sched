import { describe, expect, it } from "vitest";
import { canClaim, canSwap, effectiveStatus, nextStatus, planTransition } from "@/lib/month-status";

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

describe("planTransition", () => {
  it("locks a stored open poll, even past its deadline", () => {
    expect(planTransition("open", deadline, before, "lock")).toEqual({ ok: true, to: "locked" });
    expect(planTransition("open", deadline, after, "lock")).toEqual({ ok: true, to: "locked" });
  });
  it("asks for a later deadline before reopening a poll past its deadline", () => {
    const msg = { ok: false, error: "Move the deadline later before reopening the poll." };
    expect(planTransition("open", deadline, after, "reopen")).toEqual(msg);
    expect(planTransition("locked", deadline, after, "reopen")).toEqual(msg);
  });
  it("reopens a locked poll whose deadline is in the future", () => {
    expect(planTransition("locked", deadline, before, "reopen")).toEqual({ ok: true, to: "open" });
  });
  it("says an open poll is already open", () => {
    expect(planTransition("open", deadline, before, "reopen")).toEqual({ ok: false, error: "The poll is already open." });
  });
  it("publishes a poll that closed by deadline", () => {
    expect(planTransition("open", deadline, after, "publish")).toEqual({ ok: true, to: "published" });
  });
  it("rejects other moves with a generic message", () => {
    expect(planTransition("published", deadline, after, "lock")).toEqual({ ok: false, error: "Can't lock from the current status." });
  });
});

describe("planTransition publish guard", () => {
  const empty = [{ date: "2026-11-08", role: "photog" as const, volunteerId: null }];
  it("blocks publish when required slots are empty", () => {
    const r = planTransition("draft", deadline, after, "publish", empty);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("Nov 8 Photog") });
  });
  it("allows publish when none are empty", () => {
    expect(planTransition("draft", deadline, after, "publish", [])).toEqual({ ok: true, to: "published" });
  });
  it("ignores empty slots for other ops", () => {
    expect(planTransition("published", deadline, after, "unpublish", empty)).toEqual({ ok: true, to: "draft" });
  });
});
