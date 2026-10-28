import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organiserAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

export async function isLockedOut(ipHash: string, now: Date): Promise<boolean> {
  const [row] = await db.select().from(organiserAttempts).where(eq(organiserAttempts.ipHash, ipHash));
  return !!row && now.getTime() - row.windowStart.getTime() < WINDOW_MS && row.count >= MAX_FAILURES;
}

export async function recordFailure(ipHash: string, now: Date): Promise<void> {
  const [row] = await db.select().from(organiserAttempts).where(eq(organiserAttempts.ipHash, ipHash));
  const expired = !row || now.getTime() - row.windowStart.getTime() >= WINDOW_MS;
  await db
    .insert(organiserAttempts)
    .values({ ipHash, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: organiserAttempts.ipHash,
      set: expired ? { windowStart: now, count: 1 } : { count: row.count + 1 },
    });
}

export async function clearFailures(ipHash: string): Promise<void> {
  await db.delete(organiserAttempts).where(eq(organiserAttempts.ipHash, ipHash));
}
