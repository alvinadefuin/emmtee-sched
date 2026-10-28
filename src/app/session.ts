import "server-only";
import { cookies, headers } from "next/headers";
import { hashIp, signSession, verifySession } from "@/lib/pin";

const COOKIE = "organiser_session";
const TTL_MS = 12 * 60 * 60 * 1000;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error("SESSION_SECRET must be set to at least 32 characters");
  return s;
}

export async function isOrganiser(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE)?.value;
  return !!token && verifySession(token, secret(), Date.now());
}

export async function startSession(): Promise<void> {
  (await cookies()).set(COOKIE, signSession(Date.now() + TTL_MS, secret()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export async function clientIpHash(): Promise<string> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return hashIp(ip, secret());
}
