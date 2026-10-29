/** The Postgres unique_violation (23505) in `error`; drizzle may wrap the driver error in `cause`. */
function findUniqueViolation(error: unknown): { constraint?: unknown } | null {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current === "object" && (current as { code?: string }).code === "23505") return current;
    current = (current as { cause?: unknown }).cause;
  }
  return null;
}

/** Postgres unique_violation (23505); drizzle may wrap the driver error in `cause`. */
export const isUniqueViolation = (error: unknown): boolean => findUniqueViolation(error) !== null;

/** Name of the constraint or unique index a unique_violation hit, or null if not reported (or not one). */
export function uniqueViolationConstraint(error: unknown): string | null {
  const constraint = findUniqueViolation(error)?.constraint;
  return typeof constraint === "string" ? constraint : null;
}
