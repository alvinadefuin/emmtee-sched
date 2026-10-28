import { describe, expect, it } from "vitest";
import { nextPoster } from "@/lib/poster-rotation";

describe("nextPoster", () => {
  const rotation = [5, 6, 7];
  it("moves to the next person", () => expect(nextPoster(rotation, 6)).toBe(7));
  it("wraps around", () => expect(nextPoster(rotation, 7)).toBe(5));
  it("starts at the top with no previous poster", () => expect(nextPoster(rotation, null)).toBe(5));
  it("starts at the top if the previous poster left the rotation", () => expect(nextPoster(rotation, 99)).toBe(5));
  it("returns null for an empty rotation", () => expect(nextPoster([], 6)).toBeNull());
});
