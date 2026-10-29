import { describe, expect, it } from "vitest";
import { isUniqueViolation, uniqueViolationConstraint } from "@/server/errors";

describe("unique violation helpers", () => {
  const direct = Object.assign(new Error("dup"), { code: "23505", constraint: "swap_requests_short_code" });
  const wrapped = Object.assign(new Error("query failed"), { cause: direct });

  it("reads the violated constraint, also through a wrapping error", () => {
    expect(uniqueViolationConstraint(direct)).toBe("swap_requests_short_code");
    expect(uniqueViolationConstraint(wrapped)).toBe("swap_requests_short_code");
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("returns null when the name is missing or the error is something else", () => {
    expect(uniqueViolationConstraint(Object.assign(new Error("dup"), { code: "23505" }))).toBeNull();
    expect(uniqueViolationConstraint(Object.assign(new Error("bad"), { code: "22P02", constraint: "x" }))).toBeNull();
    expect(uniqueViolationConstraint(new Error("plain"))).toBeNull();
  });
});
