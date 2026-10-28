import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { organiserAttempts } from "@/db/schema";

const WINDOW_MS = 15 * 60_000;
const MAX_FAILURES = 5;

/**
 * Atomically counts one login attempt for this IP and says whether it may proceed.
 * Call before checking the PIN, and `clearFailures` on success, so parallel guesses
 * each take a slot instead of racing past a read-then-write check.
 *
 * `count` is the number of attempts in the current window. When the MAX_FAILURES-th
 * attempt is reserved, `window_start` moves to that moment, so the lockout lasts
 * WINDOW_MS from the fifth failure. Later attempts while locked do not extend it.
 */
export async function reserveAttempt(ipHash: string, now: Date): Promise<boolean> {
  const at = sql`${now.toISOString()}::timestamptz`;
  const expired = sql`${organiserAttempts.windowStart} <= ${new Date(now.getTime() - WINDOW_MS).toISOString()}::timestamptz`;
  const [row] = await db
    .insert(organiserAttempts)
    .values({ ipHash, windowStart: now, count: 1 })
    .onConflictDoUpdate({
      target: organiserAttempts.ipHash,
      set: {
        count: sql`case when ${expired} then 1 else ${organiserAttempts.count} + 1 end`,
        windowStart: sql`case when ${expired} or ${organiserAttempts.count} + 1 = ${MAX_FAILURES} then ${at} else ${organiserAttempts.windowStart} end`,
      },
    })
    .returning({ count: organiserAttempts.count });
  return row.count <= MAX_FAILURES;
}

export async function clearFailures(ipHash: string): Promise<void> {
  await db.delete(organiserAttempts).where(eq(organiserAttempts.ipHash, ipHash));
}
