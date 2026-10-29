import { describe, expect, it } from "vitest";
import { swapMessage } from "@/lib/swap-message";

const url = "https://example.vercel.app/s/K7P2QX9M";

describe("swapMessage", () => {
  it("describes an exchange", () => {
    expect(
      swapMessage({
        kind: "exchange",
        targetName: "Volunteer B",
        requesterSlot: { date: "2026-11-08", role: "laptop" },
        targetSlot: { date: "2026-11-22", role: "laptop" },
        url,
      }),
    ).toBe(`Hi Volunteer B, can we swap? My Nov 8 Laptop for your Nov 22 Laptop. Tap to accept or decline: ${url}`);
  });

  it("describes a hand-over", () => {
    expect(
      swapMessage({
        kind: "handover",
        targetName: "Volunteer C",
        requesterSlot: { date: "2026-11-15", role: "photog" },
        targetSlot: null,
        url,
      }),
    ).toBe(`Hi Volunteer C, could you take my Nov 15 Photog? Tap to accept or decline: ${url}`);
  });
});
