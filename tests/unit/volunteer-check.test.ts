import { describe, expect, it } from "vitest";
import { volunteerError } from "@/lib/volunteer-check";

describe("volunteerError", () => {
  it("is null for an active volunteer", () => {
    expect(volunteerError({ active: true }, "you")).toBeNull();
  });

  it("explains a missing volunteer", () => {
    expect(volunteerError(undefined, "you")).toBe("We couldn't find you on the roster. Pick your name again.");
    expect(volunteerError(undefined, "them")).toBe("We couldn't find that person on the roster.");
  });

  it("explains an inactive volunteer", () => {
    expect(volunteerError({ active: false }, "you")).toBe("You are no longer on the active roster.");
    expect(volunteerError({ active: false }, "them")).toBe("That person is no longer on the active roster.");
  });
});
