import { describe, expect, it } from "vitest";
import {
  generateShortCode,
  isShortCode,
  normaliseShortCode,
  SHORT_CODE_ALPHABET,
  SHORT_CODE_LENGTH,
} from "@/lib/short-code";

describe("short codes", () => {
  it("uses an unambiguous alphabet of at least 28 symbols", () => {
    expect(SHORT_CODE_ALPHABET.length).toBeGreaterThanOrEqual(28);
    expect(new Set(SHORT_CODE_ALPHABET).size).toBe(SHORT_CODE_ALPHABET.length);
    for (const c of "01OILU") expect(SHORT_CODE_ALPHABET).not.toContain(c);
    expect(SHORT_CODE_LENGTH).toBe(8);
  });

  it("generates codes from the injected random source", () => {
    const picks = [0, 1, 2, 3, 4, 5, 6, SHORT_CODE_ALPHABET.length - 1];
    let i = 0;
    const code = generateShortCode((max) => {
      expect(max).toBe(SHORT_CODE_ALPHABET.length);
      return picks[i++];
    });
    expect(code).toBe(SHORT_CODE_ALPHABET.slice(0, 7) + SHORT_CODE_ALPHABET.at(-1));
  });

  it("generates valid, varied codes by default", () => {
    const codes = Array.from({ length: 50 }, () => generateShortCode());
    for (const c of codes) expect(isShortCode(c)).toBe(true);
    expect(new Set(codes).size).toBe(50);
  });

  it("validates exactly 8 alphabet characters", () => {
    expect(isShortCode("K7P2QX9M")).toBe(true);
    expect(isShortCode("K7P2QX9")).toBe(false);
    expect(isShortCode("K7P2QX9MM")).toBe(false);
    expect(isShortCode("k7p2qx9m")).toBe(false);
    expect(isShortCode("K7P2QX0M")).toBe(false);
    expect(isShortCode("K7P2QXOM")).toBe(false);
    expect(isShortCode("")).toBe(false);
  });

  it("normalises case and surrounding space, rejecting anything else", () => {
    expect(normaliseShortCode(" k7p2qx9m ")).toBe("K7P2QX9M");
    expect(normaliseShortCode("K7P2QX9M")).toBe("K7P2QX9M");
    expect(normaliseShortCode("K7P2-QX9M")).toBeNull();
    expect(normaliseShortCode("k7p2qxom")).toBeNull();
    expect(normaliseShortCode("abc")).toBeNull();
  });
});
