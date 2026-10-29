import { describe, expect, it } from "vitest";
import { buildImageModel } from "@/image/model";

describe("buildImageModel", () => {
  it("formats days, upper-cases names and fills gaps with ---", () => {
    const model = buildImageModel({
      year: 2026,
      month: 11,
      theme: "teal",
      posterName: "Volunteer E",
      dates: [
        { date: "2026-11-01", laptop: "Volunteer A", assist: null, photog: "Volunteer B" },
        { date: "2026-11-08", laptop: null, assist: "Volunteer C", photog: "Volunteer D" },
      ],
    });
    expect(model).toEqual({
      monthName: "NOVEMBER",
      year: "2026",
      theme: "teal",
      poster: "VOLUNTEER E",
      rows: [
        { day: "01", operator: "VOLUNTEER A", assist: "---", photog: "VOLUNTEER B" },
        { day: "08", operator: "---", assist: "VOLUNTEER C", photog: "VOLUNTEER D" },
      ],
    });
  });

  it("shows --- when there is no poster", () => {
    expect(buildImageModel({ year: 2026, month: 12, theme: "peach", posterName: null, dates: [] }).poster).toBe("---");
  });
});
