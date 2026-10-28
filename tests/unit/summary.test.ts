import { describe, expect, it } from "vitest";
import { volunteerSummary } from "@/lib/summary";

describe("volunteerSummary", () => {
  it("counts each person's dates per role, sorted by name", () => {
    const lines = volunteerSummary(
      [
        { date: "2026-11-01", role: "photog", volunteerName: "Volunteer B" },
        { date: "2026-11-29", role: "photog", volunteerName: "Volunteer B" },
        { date: "2026-11-01", role: "laptop", volunteerName: "Volunteer A" },
        { date: "2026-11-08", role: "laptop", volunteerName: null },
      ],
    );
    expect(lines).toEqual(["Volunteer A: Laptop ×1 (Nov 1)", "Volunteer B: Photog ×2 (Nov 1, Nov 29)"]);
  });
});
