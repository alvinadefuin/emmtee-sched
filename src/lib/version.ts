import { createHash } from "node:crypto";
import { effectiveStatus } from "./month-status";
import type { MonthStatus, SwapStatus, Theme } from "./roles";

/**
 * JSON with object keys sorted and every array treated as an unordered set (its
 * canonical elements are sorted), so the result does not depend on row order.
 * Dates become ISO strings.
 */
export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonicalJson).sort().join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

/** A short opaque fingerprint: the first 16 hex characters of the SHA-256 of the canonical JSON. */
export function versionHash(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex").slice(0, 16);
}

/** Everything the poll and organiser pages show for one month (or the latest one). */
export type MonthSnapshot = {
  month: {
    id: number;
    year: number;
    month: number;
    status: MonthStatus;
    deadline: Date;
    theme: Theme;
    posterVolunteerId: number | null;
    notes: string;
  } | null;
  months: { id: number; year: number; month: number }[];
  dates: { id: number; date: string }[];
  slots: { id: number; dateId: number; role: string; volunteerId: number | null }[];
  swaps: { id: string; status: SwapStatus }[];
  volunteers: { id: number; name: string; active: boolean; posterOrder: number | null; roles: string[] }[];
};

export function monthVersion(s: MonthSnapshot, now: Date): string {
  const month = s.month && { ...s.month, effective: effectiveStatus(s.month.status, s.month.deadline, now) };
  return versionHash({ ...s, month });
}

/** Everything the swap page shows for one request. */
export type SwapSnapshot = {
  id: string;
  status: SwapStatus;
  reason: string | null;
  monthStatus: MonthStatus;
  deadline: Date;
  slots: { id: number; volunteerId: number | null }[];
  volunteers: { id: number; name: string; active: boolean }[];
};

export function swapVersion(s: SwapSnapshot, now: Date): string {
  const { deadline, ...rest } = s;
  return versionHash({ ...rest, effective: effectiveStatus(s.monthStatus, deadline, now) });
}
