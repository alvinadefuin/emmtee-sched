import { describe, expect, it } from "vitest";
import { hashIp, pinMatches, signSession, verifySession } from "@/lib/pin";

const SECRET = "test-secret-that-is-at-least-32-characters-long";

describe("pinMatches", () => {
  it("matches the same PIN", () => expect(pinMatches("123456", "123456")).toBe(true));
  it("rejects a different PIN", () => expect(pinMatches("123457", "123456")).toBe(false));
  it("rejects when no PIN is configured", () => expect(pinMatches("", "")).toBe(false));
});

describe("session tokens", () => {
  const now = 1_000_000;
  it("verifies before expiry", () => expect(verifySession(signSession(now + 1000, SECRET), SECRET, now)).toBe(true));
  it("rejects after expiry", () => expect(verifySession(signSession(now - 1, SECRET), SECRET, now)).toBe(false));
  it("rejects a tampered expiry", () => {
    const [, sig] = signSession(now + 1000, SECRET).split(".");
    expect(verifySession(`${now + 999_999}.${sig}`, SECRET, now)).toBe(false);
  });
  it("rejects a token signed with another secret", () => {
    expect(verifySession(signSession(now + 1000, `${SECRET}x`), SECRET, now)).toBe(false);
  });
  it("rejects garbage", () => expect(verifySession("nonsense", SECRET, now)).toBe(false));
  it("rejects a token with extra dot-separated parts", () => {
    expect(verifySession(`${signSession(now + 1000, SECRET)}.extra`, SECRET, now)).toBe(false);
  });
  it("refuses to sign or verify with a missing or short secret", () => {
    const token = signSession(now + 1000, SECRET);
    for (const weak of ["", "x".repeat(31)]) {
      expect(() => signSession(now + 1000, weak)).toThrow();
      expect(() => verifySession(token, weak, now)).toThrow();
    }
  });
});

describe("hashIp", () => {
  it("is stable and does not contain the address", () => {
    const h = hashIp("203.0.113.9", SECRET);
    expect(h).toBe(hashIp("203.0.113.9", SECRET));
    expect(h).not.toContain("203.0.113.9");
  });
});
