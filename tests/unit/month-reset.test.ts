import { describe, expect, it } from "vitest";
import { RESET_PHRASE, confirmsReset, resetMessage } from "@/lib/month-reset";

describe("confirmsReset", () => {
  it("accepts the phrase, ignoring case and surrounding spaces", () => {
    expect(RESET_PHRASE).toBe("RESET");
    expect(confirmsReset("RESET")).toBe(true);
    expect(confirmsReset("  reset ")).toBe(true);
  });
  it("rejects anything else", () => {
    expect(confirmsReset("")).toBe(false);
    expect(confirmsReset("rest")).toBe(false);
    expect(confirmsReset("RESET now")).toBe(false);
    expect(confirmsReset(null)).toBe(false);
  });
});

describe("resetMessage", () => {
  const deadline = new Date("2026-10-30T15:59:00Z");
  it("says the poll is open when the deadline is ahead", () => {
    expect(resetMessage(deadline, new Date("2026-10-30T15:00:00Z"))).toBe("Month reset. The poll is open again.");
  });
  it("says to move the deadline when it has passed", () => {
    expect(resetMessage(deadline, new Date("2026-10-30T16:00:00Z"))).toBe("Month reset. Move the deadline later to reopen the poll.");
  });
});
