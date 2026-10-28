import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest();
const mac = (payload: string, secret: string) => createHmac("sha256", secret).update(payload).digest("base64url");

/** Constant-time comparison; hashing first makes the lengths equal. */
export function pinMatches(input: string, expected: string): boolean {
  if (!expected) return false;
  return timingSafeEqual(sha256(input), sha256(expected));
}

export function signSession(expiresAtMs: number, secret: string): string {
  const payload = String(expiresAtMs);
  return `${payload}.${mac(payload, secret)}`;
}

export function verifySession(token: string, secret: string, nowMs: number): boolean {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const a = Buffer.from(sig);
  const b = Buffer.from(mac(payload, secret));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(payload) > nowMs;
}

/** Rate-limit key; the raw address is never stored. */
export const hashIp = (ip: string, secret: string): string =>
  createHmac("sha256", secret).update(`ip:${ip}`).digest("hex");
