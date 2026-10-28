# emmtee-sched Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A no-login Next.js app where volunteers claim monthly Sunday duties from a shared link, swap with each other by consent, and the organiser auto-fills, publishes and shares the schedule as a poster-style PNG.

**Architecture:** Next.js 16 App Router on Vercel. Pure domain logic (dates, auto-fill, swap rules, image model, PIN crypto) lives in `src/lib` and is unit-tested with Vitest. Database logic lives in `src/server` (Drizzle + Neon WebSocket driver, so swaps can run in row-locked transactions). Thin `"use server"` wrappers in `src/app/actions` connect the UI to `src/server`. The schedule image is rendered with `next/og`.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Tailwind CSS 4, Drizzle ORM 0.45, `@neondatabase/serverless` (Pool), Vitest 4, `tsx` for scripts.

**Spec:** `docs/superpowers/specs/2026-10-28-emmtee-sched-design.md`

**Public-repo rule (applies to every task):** never commit real volunteer names, `.env*` files, or connection strings. Tests and examples use "Volunteer A/B/…". The real roster lives in `local/` (gitignored).

**Next 16 notes for the engineer:** this is not the Next.js in most training data. Before Task 14, skim `node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md` and `.../03-api-reference/04-functions/image-response.md`. Key facts used below: page `params`/`searchParams` are Promises; `cookies()`/`headers()` are async; call `await connection()` from `next/server` in pages that read the database so they render per request.

---

## File structure

```
emmtee-sched/
  .env.example                      env var names, empty values
  drizzle.config.ts                 drizzle-kit config (dev or test branch)
  next.config.ts                    ships font files with the image route
  vitest.config.ts                  loads .env.local, @ alias
  assets/fonts/                     OFL fonts + licences (committed)
  scripts/seed.ts                   loads local/roster.json into the DB
  local/                            gitignored: roster.json, roster-notes.md
  src/
    db/schema.ts                    tables + enums
    db/index.ts                     Pool-backed drizzle client, Executor type
    lib/                            pure, unit-tested
      roles.ts                      role/theme/source constants and types
      result.ts                     Result type + fail()
      dates.ts                      Sundays, deadline, Manila formatting, countdown
      month-status.ts               effective status, permissions, transitions
      poster-rotation.ts            next poster in rotation
      autofill.ts                   the auto-fill algorithm
      swap-rules.ts                 swap validation
      swap-message.ts               share text for Messenger
      summary.ts                    per-volunteer counts for draft review
      pin.ts                        PIN compare, session signing, IP hashing
      ids.ts                        uuid check
    server/                         database logic, no Next imports
      errors.ts                     unique-violation detection
      queries.ts                    shared lookups (slot context, month slots, eligibility)
      roster.ts                     volunteers CRUD
      month-view.ts                 read model for pages
      poll.ts                       claim / release
      swaps.ts                      create / accept / decline / cancel / detail
      organiser.ts                  month ops, manual edits, auto-fill
      rate-limit.ts                 PIN attempt limiting
    image/                          schedule PNG
      themes.ts  svg.ts  model.ts  fonts.ts  ScheduleImage.tsx
    app/
      layout.tsx  globals.css  page.tsx
      session.ts                    organiser cookie (next/headers)
      actions/poll.ts               "use server" wrappers for volunteers
      actions/organiser.ts          "use server" wrappers for organiser
      components/                   client components for the poll
      swap/[id]/page.tsx  swap/[id]/SwapResponder.tsx
      organiser/page.tsx  organiser/*.tsx
      api/months/[ym]/image/route.tsx
  tests/unit/*.test.ts
  tests/integration/swaps.int.test.ts
```

---

### Task 1: Scaffold the project

**Files:**
- Create: Next.js scaffold, `vitest.config.ts`, `drizzle.config.ts`, `.env.example`
- Modify: `package.json`, `.gitignore`, `next.config.ts`

- [ ] **Step 1: Initialise git (the user may need to run this; the Claude sandbox blocked writes to `.git`)**

```bash
cd /Users/alvinadefuin/Desktop/dev_projects/emmtee-sched
git init -b main
git add .gitignore docs
git commit -m "docs: add design spec and implementation plan"
```

- [ ] **Step 2: Scaffold Next.js into a temp folder and copy it in (the target folder is not empty)**

```bash
cd "$TMPDIR" && rm -rf emmtee-scaffold
npx create-next-app@16.3.0 emmtee-scaffold --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
cd /Users/alvinadefuin/Desktop/dev_projects/emmtee-sched
rsync -a --exclude .git --exclude .gitignore --exclude node_modules "$TMPDIR/emmtee-scaffold/" ./
npm install
```

Expected: `src/app/page.tsx`, `package.json`, `next.config.ts` exist. Our `.gitignore` is untouched.

- [ ] **Step 3: Install dependencies**

```bash
npm install @neondatabase/serverless@^1.1.0 drizzle-orm@^0.45.2 ws@^8
npm install -D drizzle-kit@^0.31.10 vitest@^4.1.10 dotenv@^17 tsx@^4 @types/ws@^8
```

- [ ] **Step 4: Add scripts to `package.json`** (replace the `"scripts"` block)

```json
"scripts": {
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run tests/unit",
  "test:int": "vitest run tests/integration",
  "db:generate": "drizzle-kit generate",
  "db:migrate": "drizzle-kit migrate",
  "db:migrate:test": "DRIZZLE_TARGET=test drizzle-kit migrate",
  "seed": "tsx scripts/seed.ts"
}
```

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import { config } from "dotenv";
import path from "node:path";

// Integration tests read TEST_DATABASE_URL from here; unit tests never touch it.
config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 6: Create `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";

config({ path: ".env.local" });

// DRIZZLE_TARGET=test points migrations at the throwaway test branch used by
// integration tests; otherwise DATABASE_URL (the dev branch locally).
const url =
  process.env.DRIZZLE_TARGET === "test"
    ? process.env.TEST_DATABASE_URL
    : process.env.DATABASE_URL;

if (!url) {
  throw new Error("Database URL is not set in .env.local");
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
});
```

- [ ] **Step 7: Create `.env.example`**

```
# Neon connection string (dev branch locally; production branch on Vercel)
DATABASE_URL=
# Neon test branch, used only by `npm run test:int`
TEST_DATABASE_URL=
# Six-digit organiser PIN
ORGANISER_PIN=
# Random string, 32+ characters: openssl rand -base64 48
SESSION_SECRET=
```

- [ ] **Step 8: Replace `next.config.ts`**

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The image route reads fonts from disk at runtime (they are too large for the
  // 500 KB ImageResponse bundle), so they must be traced into the deployment.
  outputFileTracingIncludes: {
    "/api/months/[ym]/image": ["./assets/fonts/**"],
  },
};

export default nextConfig;
```

- [ ] **Step 9: Verify the scaffold builds and the empty test run works**

Run: `npm run build && npx vitest run tests/unit --passWithNoTests`
Expected: build succeeds; vitest reports no test files and exits 0.

- [ ] **Step 10: Commit**

```bash
git add -A
git status --short | grep -E '\.env($|\.local)|local/' && echo "STOP: secret or local file staged" || true
git commit -m "chore: scaffold Next.js 16 app with Drizzle, Neon and Vitest"
```

---

### Task 2: Domain constants and Result type

**Files:**
- Create: `src/lib/roles.ts`, `src/lib/result.ts`, `src/lib/ids.ts`

No tests: these are constants and types; they are exercised by every later test.

- [ ] **Step 1: Create `src/lib/roles.ts`**

```ts
export const SLOT_ROLES = ["laptop", "assist", "photog"] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];

export const ROLES = ["laptop", "assist", "photog", "poster"] as const;
export type Role = (typeof ROLES)[number];

export const isSlotRole = (role: Role): role is SlotRole => role !== "poster";

export const ROLE_LABEL: Record<Role, string> = {
  laptop: "Laptop — Operator",
  assist: "Laptop — Assist",
  photog: "Photog",
  poster: "Poster",
};

export const ROLE_SHORT: Record<SlotRole, string> = {
  laptop: "Laptop",
  assist: "Laptop Assist",
  photog: "Photog",
};

export const SLOT_SOURCES = ["claimed", "auto", "manual"] as const;
export type SlotSource = (typeof SLOT_SOURCES)[number];

export const SWAP_KINDS = ["exchange", "handover"] as const;
export type SwapKind = (typeof SWAP_KINDS)[number];

export const SWAP_STATUSES = ["pending", "accepted", "declined", "cancelled", "invalid"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

export const MONTH_STATUSES = ["open", "locked", "draft", "published"] as const;
export type MonthStatus = (typeof MONTH_STATUSES)[number];

export const THEMES = ["teal", "peach"] as const;
export type Theme = (typeof THEMES)[number];
```

- [ ] **Step 2: Create `src/lib/result.ts`**

```ts
export type Result<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string };

export const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export const notNull = <T>(value: T | null): value is T => value !== null;
```

- [ ] **Step 3: Create `src/lib/ids.ts`**

```ts
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value);

export const isId = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;
```

- [ ] **Step 4: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/lib
git commit -m "feat: add domain constants and Result type"
```

---

### Task 3: Dates (Sundays, deadline, Manila time, countdown)

**Files:**
- Create: `src/lib/dates.ts`
- Test: `tests/unit/dates.test.ts`

Dates are handled as `YYYY-MM-DD` strings so that server and browser time zones never shift a Sunday. Philippine time is UTC+8 with no daylight saving, so a fixed offset is exact.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  defaultDeadline,
  formatCountdown,
  manilaInputValue,
  monthLabel,
  parseManilaInput,
  parseYm,
  shortDate,
  sundaysInMonth,
  ym,
} from "@/lib/dates";

describe("sundaysInMonth", () => {
  it("lists five Sundays in November 2026", () => {
    expect(sundaysInMonth(2026, 11)).toEqual([
      "2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29",
    ]);
  });

  it("lists four Sundays in December 2026", () => {
    expect(sundaysInMonth(2026, 12)).toEqual(["2026-12-06", "2026-12-13", "2026-12-20", "2026-12-27"]);
  });

  it("matches the August 2026 poster", () => {
    expect(sundaysInMonth(2026, 8)).toEqual([
      "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30",
    ]);
  });
});

describe("defaultDeadline (last Friday before the 1st, 23:59 Manila)", () => {
  it("December 2026 → Fri 27 Nov 23:59 PHT", () => {
    expect(defaultDeadline(2026, 12).toISOString()).toBe("2026-11-27T15:59:00.000Z");
  });

  it("November 2026 (1st is Sunday) → Fri 30 Oct", () => {
    expect(defaultDeadline(2026, 11).toISOString()).toBe("2026-10-30T15:59:00.000Z");
  });

  it("August 2026 (1st is Saturday) → the day before", () => {
    expect(defaultDeadline(2026, 8).toISOString()).toBe("2026-07-31T15:59:00.000Z");
  });

  it("January 2027 (1st is Friday) → the Friday a week before", () => {
    expect(defaultDeadline(2027, 1).toISOString()).toBe("2026-12-25T15:59:00.000Z");
  });
});

describe("Manila input conversion", () => {
  it("formats a UTC instant as a Manila datetime-local value", () => {
    expect(manilaInputValue(new Date("2026-11-27T15:59:00Z"))).toBe("2026-11-27T23:59");
  });

  it("parses a Manila datetime-local value back to the same instant", () => {
    expect(parseManilaInput("2026-11-27T23:59")?.toISOString()).toBe("2026-11-27T15:59:00.000Z");
  });

  it("rejects malformed input", () => {
    expect(parseManilaInput("27/11/2026")).toBeNull();
  });
});

describe("formatCountdown", () => {
  const MIN = 60_000, HR = 60 * MIN, DAY = 24 * HR;
  it("days and hours", () => expect(formatCountdown(2 * DAY + 4 * HR + 5 * MIN)).toBe("2 days 4 hrs"));
  it("singular units", () => expect(formatCountdown(DAY + HR)).toBe("1 day 1 hr"));
  it("hours and minutes", () => expect(formatCountdown(3 * HR + 12 * MIN)).toBe("3 hrs 12 mins"));
  it("minutes only", () => expect(formatCountdown(12 * MIN + 30_000)).toBe("12 mins"));
  it("under a minute", () => expect(formatCountdown(30_000)).toBe("under 1 min"));
  it("closed", () => expect(formatCountdown(0)).toBe("Closed"));
});

describe("labels", () => {
  it("shortDate", () => expect(shortDate("2026-11-08")).toBe("Nov 8"));
  it("monthLabel", () => expect(monthLabel(2026, 11)).toBe("November 2026"));
  it("ym round-trips", () => {
    expect(ym(2026, 3)).toBe("2026-03");
    expect(parseYm("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(parseYm("2026-13")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/dates.test.ts`
Expected: FAIL, cannot resolve `@/lib/dates`.

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function sundaysInMonth(year: number, month: number): string[] {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const out: string[] = [];
  for (let day = 1; day <= days; day++) {
    const d = new Date(Date.UTC(year, month - 1, day));
    if (d.getUTCDay() === 0) out.push(toIso(d));
  }
  return out;
}

/** Last Friday strictly before the 1st of the month, 23:59 Asia/Manila. */
export function defaultDeadline(year: number, month: number): Date {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const back = (first.getUTCDay() - 5 + 7) % 7 || 7;
  const friday = new Date(first);
  friday.setUTCDate(first.getUTCDate() - back);
  // 23:59 in Manila is 15:59 UTC the same day.
  return new Date(Date.UTC(friday.getUTCFullYear(), friday.getUTCMonth(), friday.getUTCDate(), 15, 59));
}

/** Value for <input type="datetime-local"> showing Manila wall-clock time. */
export function manilaInputValue(instant: Date): string {
  return new Date(instant.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 16);
}

export function parseManilaInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const d = new Date(`${value}:00+08:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatManila(instant: Date): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(instant);
}

export function formatCountdown(ms: number): string {
  if (ms <= 0) return "Closed";
  const totalMins = Math.floor(ms / 60_000);
  if (totalMins === 0) return "under 1 min";
  const days = Math.floor(totalMins / 1440);
  const hrs = Math.floor((totalMins % 1440) / 60);
  const mins = totalMins % 60;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (days > 0) return `${unit(days, "day")} ${unit(hrs, "hr")}`;
  if (hrs > 0) return `${unit(hrs, "hr")} ${unit(mins, "min")}`;
  return unit(mins, "min");
}

export function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}`;
}

export const monthName = (month: number): string => MONTHS[month - 1];

export const monthLabel = (year: number, month: number): string => `${MONTHS[month - 1]} ${year}`;

export const ym = (year: number, month: number): string => `${year}-${String(month).padStart(2, "0")}`;

export function parseYm(value: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return null;
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year: Number(m[1]), month } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/dates.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/dates.ts tests/unit/dates.test.ts
git commit -m "feat: add date helpers for Sundays, deadline and Manila time"
```

---

### Task 4: Month status and poster rotation

**Files:**
- Create: `src/lib/month-status.ts`, `src/lib/poster-rotation.ts`
- Test: `tests/unit/month-status.test.ts`, `tests/unit/poster-rotation.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/month-status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canClaim, canSwap, effectiveStatus, nextStatus } from "@/lib/month-status";

const deadline = new Date("2026-10-30T15:59:00Z");
const before = new Date("2026-10-30T15:00:00Z");
const after = new Date("2026-10-30T16:00:00Z");

describe("effectiveStatus", () => {
  it("open before the deadline stays open", () => expect(effectiveStatus("open", deadline, before)).toBe("open"));
  it("open after the deadline is locked", () => expect(effectiveStatus("open", deadline, after)).toBe("locked"));
  it("published ignores the deadline", () => expect(effectiveStatus("published", deadline, after)).toBe("published"));
});

describe("permissions", () => {
  it("claims only while open", () => {
    expect(canClaim("open")).toBe(true);
    expect(canClaim("locked")).toBe(false);
    expect(canClaim("published")).toBe(false);
  });

  it("swaps while open or published, not during review", () => {
    expect(canSwap("open")).toBe(true);
    expect(canSwap("published")).toBe(true);
    expect(canSwap("locked")).toBe(false);
    expect(canSwap("draft")).toBe(false);
  });
});

describe("nextStatus", () => {
  it("allows lock from open", () => expect(nextStatus("open", "lock")).toBe("locked"));
  it("allows publish from draft", () => expect(nextStatus("draft", "publish")).toBe("published"));
  it("allows unpublish back to draft", () => expect(nextStatus("published", "unpublish")).toBe("draft"));
  it("rejects publish from open", () => expect(nextStatus("open", "publish")).toBeNull());
});
```

`tests/unit/poster-rotation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextPoster } from "@/lib/poster-rotation";

describe("nextPoster", () => {
  const rotation = [5, 6, 7];
  it("moves to the next person", () => expect(nextPoster(rotation, 6)).toBe(7));
  it("wraps around", () => expect(nextPoster(rotation, 7)).toBe(5));
  it("starts at the top with no previous poster", () => expect(nextPoster(rotation, null)).toBe(5));
  it("starts at the top if the previous poster left the rotation", () => expect(nextPoster(rotation, 99)).toBe(5));
  it("returns null for an empty rotation", () => expect(nextPoster([], 6)).toBeNull());
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/month-status.test.ts tests/unit/poster-rotation.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/lib/month-status.ts`**

```ts
import type { MonthStatus } from "./roles";

/** The stored status, except an open poll past its deadline counts as locked. */
export function effectiveStatus(stored: MonthStatus, deadline: Date, now: Date): MonthStatus {
  return stored === "open" && now.getTime() > deadline.getTime() ? "locked" : stored;
}

export const canClaim = (status: MonthStatus): boolean => status === "open";

// Swaps pause while the organiser reviews, so the draft cannot change under them.
export const canSwap = (status: MonthStatus): boolean => status === "open" || status === "published";

export type MonthOp = "lock" | "reopen" | "publish" | "unpublish";

const TRANSITIONS: Record<MonthOp, { from: MonthStatus[]; to: MonthStatus }> = {
  lock: { from: ["open"], to: "locked" },
  reopen: { from: ["locked", "draft"], to: "open" },
  publish: { from: ["locked", "draft"], to: "published" },
  unpublish: { from: ["published"], to: "draft" },
};

export function nextStatus(current: MonthStatus, op: MonthOp): MonthStatus | null {
  const t = TRANSITIONS[op];
  return t.from.includes(current) ? t.to : null;
}
```

- [ ] **Step 4: Implement `src/lib/poster-rotation.ts`**

```ts
/** `rotation` is volunteer ids in poster order. */
export function nextPoster(rotation: number[], previousPosterId: number | null): number | null {
  if (rotation.length === 0) return null;
  const i = previousPosterId === null ? -1 : rotation.indexOf(previousPosterId);
  return i === -1 ? rotation[0] : rotation[(i + 1) % rotation.length];
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/month-status.test.ts tests/unit/poster-rotation.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/month-status.ts src/lib/poster-rotation.ts tests/unit/month-status.test.ts tests/unit/poster-rotation.test.ts
git commit -m "feat: add month status rules and poster rotation"
```

---

### Task 5: Auto-fill algorithm

**Files:**
- Create: `src/lib/autofill.ts`
- Test: `tests/unit/autofill.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { autofill, type AutofillSlot, type AutofillVolunteer } from "@/lib/autofill";
import type { SlotRole } from "@/lib/roles";

const NOV = ["2026-11-01", "2026-11-08", "2026-11-15", "2026-11-22", "2026-11-29"];

function makeSlots(dates: string[], roles: SlotRole[]): AutofillSlot[] {
  let id = 1;
  return dates.flatMap((date) => roles.map((role) => ({ id: id++, date, role, volunteerId: null, source: null })));
}

const gapDays = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 86_400_000;

describe("autofill", () => {
  it("keeps claimed slots untouched", () => {
    const slots = makeSlots(NOV, ["photog"]);
    slots[0] = { ...slots[0], volunteerId: 10, source: "claimed" };
    const vols: AutofillVolunteer[] = [{ id: 10, roles: ["photog"] }, { id: 11, roles: ["photog"] }];
    const { slots: out } = autofill(slots, vols, 1);
    expect(out.find((s) => s.id === slots[0].id)).toMatchObject({ volunteerId: 10, source: "claimed" });
  });

  it("gives every eligible volunteer at least one date and fills every laptop slot", () => {
    const vols: AutofillVolunteer[] = [1, 2, 3, 4].map((id) => ({ id, roles: ["laptop"] }));
    const { slots: out, unfilled } = autofill(makeSlots(NOV, ["laptop"]), vols, 7);
    for (const v of vols) expect(out.some((s) => s.volunteerId === v.id)).toBe(true);
    expect(unfilled).toHaveLength(0);
  });

  it("never gives one person two roles on the same Sunday", () => {
    const vols: AutofillVolunteer[] = [
      { id: 1, roles: ["laptop"] },
      { id: 2, roles: ["laptop"] },
      { id: 3, roles: ["laptop", "photog"] },
      { id: 4, roles: ["photog"] },
    ];
    const { slots: out } = autofill(makeSlots(NOV, ["laptop", "photog"]), vols, 3);
    for (const date of NOV) {
      const ids = out.filter((s) => s.date === date && s.volunteerId !== null).map((s) => s.volunteerId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("spaces a person's dates in one role at least 14 days apart when possible", () => {
    const vols: AutofillVolunteer[] = [{ id: 10, roles: ["photog"] }, { id: 11, roles: ["photog"] }];
    const { slots: out, unfilled } = autofill(makeSlots(NOV, ["photog"]), vols, 5);
    expect(unfilled).toHaveLength(0);
    for (const v of vols) {
      const dates = out.filter((s) => s.volunteerId === v.id).map((s) => s.date).sort();
      for (let i = 1; i < dates.length; i++) expect(gapDays(dates[i - 1], dates[i])).toBeGreaterThanOrEqual(14);
    }
  });

  it("relaxes to a 7-day gap rather than leave a slot empty", () => {
    const { unfilled } = autofill(makeSlots(NOV, ["photog"]), [{ id: 10, roles: ["photog"] }], 1);
    expect(unfilled).toHaveLength(0);
  });

  it("leaves slots empty when nobody is eligible", () => {
    const { unfilled } = autofill(makeSlots(NOV, ["photog"]), [{ id: 1, roles: ["laptop"] }], 1);
    expect(unfilled).toHaveLength(5);
  });

  it("gives interns one date each and does not force-fill the rest", () => {
    const vols: AutofillVolunteer[] = [{ id: 20, roles: ["assist"] }, { id: 21, roles: ["assist"] }];
    const { slots: out, unfilled } = autofill(makeSlots(NOV, ["assist"]), vols, 1);
    expect(out.filter((s) => s.volunteerId !== null)).toHaveLength(2);
    expect(unfilled).toHaveLength(0); // empty assist slots are normal, not "unfilled"
  });

  it("re-running discards earlier auto picks but keeps claims", () => {
    const slots = makeSlots(NOV, ["laptop"]);
    slots[0] = { ...slots[0], volunteerId: 1, source: "claimed" };
    slots[1] = { ...slots[1], volunteerId: 99, source: "auto" }; // 99 is no longer active
    const vols: AutofillVolunteer[] = [1, 2, 3].map((id) => ({ id, roles: ["laptop"] }));
    const { slots: out } = autofill(slots, vols, 2);
    expect(out.some((s) => s.volunteerId === 99)).toBe(false);
    expect(out[0]).toMatchObject({ volunteerId: 1, source: "claimed" });
  });

  it("is deterministic for a given seed", () => {
    const vols: AutofillVolunteer[] = [1, 2, 3, 4].map((id) => ({ id, roles: ["laptop"] }));
    const a = autofill(makeSlots(NOV, ["laptop"]), vols, 42).slots.map((s) => s.volunteerId);
    const b = autofill(makeSlots(NOV, ["laptop"]), vols, 42).slots.map((s) => s.volunteerId);
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/autofill.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/autofill.ts`**

```ts
import { SLOT_ROLES, type SlotRole, type SlotSource } from "./roles";

export type AutofillSlot = {
  id: number;
  date: string;
  role: SlotRole;
  volunteerId: number | null;
  source: SlotSource | null;
};
export type AutofillVolunteer = { id: number; roles: SlotRole[] };
export type AutofillResult = { slots: AutofillSlot[]; unfilled: AutofillSlot[] };

const DAY_MS = 86_400_000;
const daysBetween = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / DAY_MS;

/** Small seeded PRNG so a draft can be reproduced from its stored seed. */
function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fills empty slots. `volunteers` must contain only active volunteers.
 * Previous `auto` picks are discarded; `claimed` and `manual` slots are kept.
 */
export function autofill(input: AutofillSlot[], volunteers: AutofillVolunteer[], seed: number): AutofillResult {
  const rand = mulberry32(seed);
  const tieRank = new Map(
    volunteers
      .map((v) => ({ id: v.id, r: rand() }))
      .sort((a, b) => a.r - b.r)
      .map((x, i) => [x.id, i] as const),
  );

  const slots = input
    .map((s) => (s.source === "auto" ? { ...s, volunteerId: null, source: null } : { ...s }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);

  const held = (vId: number) => slots.filter((s) => s.volunteerId === vId);
  const roleCount = (vId: number, role: SlotRole) => held(vId).filter((s) => s.role === role).length;
  const canPlace = (v: AutofillVolunteer, slot: AutofillSlot, minGap: number) =>
    v.roles.includes(slot.role) &&
    !held(v.id).some((s) => s.date === slot.date) &&
    held(v.id)
      .filter((s) => s.role === slot.role)
      .every((s) => daysBetween(s.date, slot.date) >= minGap);
  const byLoad = (role: SlotRole) => (a: AutofillVolunteer, b: AutofillVolunteer) =>
    roleCount(a.id, role) - roleCount(b.id, role) ||
    held(a.id).length - held(b.id).length ||
    tieRank.get(a.id)! - tieRank.get(b.id)!;
  const place = (slot: AutofillSlot, v: AutofillVolunteer) => {
    slot.volunteerId = v.id;
    slot.source = "auto";
  };

  // 1. Everyone once: each eligible volunteer with no date in a role gets one.
  for (const role of SLOT_ROLES) {
    const zeros = volunteers
      .filter((v) => v.roles.includes(role) && roleCount(v.id, role) === 0)
      .sort(byLoad(role));
    for (const v of zeros) {
      const slot = slots.find((s) => s.role === role && s.volunteerId === null && canPlace(v, s, 0));
      if (slot) place(slot, v);
    }
  }

  // 2. Remaining laptop/photog gaps go to the least-loaded person, two weeks apart
  //    if possible, one week if not. Assist slots are never force-filled.
  for (const slot of slots) {
    if (slot.volunteerId !== null || slot.role === "assist") continue;
    for (const minGap of [14, 7]) {
      const pick = volunteers.filter((v) => canPlace(v, slot, minGap)).sort(byLoad(slot.role))[0];
      if (pick) {
        place(slot, pick);
        break;
      }
    }
  }

  const unfilled = slots.filter((s) => s.volunteerId === null && s.role !== "assist");
  return { slots, unfilled };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/autofill.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/autofill.ts tests/unit/autofill.test.ts
git commit -m "feat: add seeded auto-fill with spacing and same-day rules"
```

---

### Task 6: Swap validation

**Files:**
- Create: `src/lib/swap-rules.ts`
- Test: `tests/unit/swap-rules.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { validateSwap, type SwapCheck, type SwapSlot } from "@/lib/swap-rules";
import type { Role } from "@/lib/roles";

// Two Sundays (dateId 100, 200). A=1, B=2, C=3, D=4.
const baseSlots: SwapSlot[] = [
  { id: 1, dateId: 100, role: "laptop", volunteerId: 1 },
  { id: 2, dateId: 100, role: "photog", volunteerId: 3 },
  { id: 3, dateId: 200, role: "laptop", volunteerId: 2 },
  { id: 4, dateId: 200, role: "photog", volunteerId: 4 },
];
const eligibility = (extra: Record<number, Role[]> = {}) =>
  new Map<number, Role[]>(
    Object.entries({ 1: ["laptop"], 2: ["laptop"], 3: ["laptop", "photog"], 4: ["photog"], ...extra }).map(
      ([k, v]) => [Number(k), v],
    ),
  );

const exchange = (over: Partial<SwapCheck> = {}): SwapCheck => ({
  kind: "exchange",
  requesterId: 1,
  requesterSlotId: 1,
  targetId: 2,
  targetSlotId: 3,
  status: "open",
  slots: baseSlots,
  eligibility: eligibility(),
  ...over,
});

describe("validateSwap", () => {
  it("accepts a plain exchange between two laptop operators", () => {
    expect(validateSwap(exchange())).toEqual({ ok: true });
  });

  it("is blocked while the organiser reviews the draft", () => {
    expect(validateSwap(exchange({ status: "draft" }))).toMatchObject({ ok: false });
  });

  it("rejects swapping with yourself", () => {
    expect(validateSwap(exchange({ targetId: 1 }))).toMatchObject({ ok: false });
  });

  it("rejects when the target is not eligible for the requester's role", () => {
    const r = validateSwap(exchange({ targetId: 4, targetSlotId: 4 }));
    expect(r).toEqual({ ok: false, reason: "They are not on the roster for this role." });
  });

  it("rejects when the target slot has changed hands", () => {
    const slots = baseSlots.map((s) => (s.id === 3 ? { ...s, volunteerId: 4 } : s));
    expect(validateSwap(exchange({ slots }))).toEqual({
      ok: false,
      reason: "That slot has changed hands since the request was made.",
    });
  });

  it("allows two people to trade roles on the same Sunday", () => {
    const r = validateSwap(
      exchange({ targetId: 3, targetSlotId: 2, eligibility: eligibility({ 1: ["laptop", "photog"] }) }),
    );
    expect(r).toEqual({ ok: true });
  });

  it("accepts a hand-over to someone free that Sunday", () => {
    expect(validateSwap(exchange({ kind: "handover", targetSlotId: null }))).toEqual({ ok: true });
  });

  it("rejects a hand-over to someone already serving that Sunday", () => {
    const r = validateSwap(exchange({ kind: "handover", targetId: 3, targetSlotId: null }));
    expect(r).toEqual({ ok: false, reason: "They already have a role on that Sunday." });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/swap-rules.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/swap-rules.ts`**

```ts
import { canSwap } from "./month-status";
import type { MonthStatus, Role, SlotRole, SwapKind } from "./roles";

export type SwapSlot = { id: number; dateId: number; role: SlotRole; volunteerId: number | null };

export type SwapCheck = {
  kind: SwapKind;
  requesterId: number;
  requesterSlotId: number;
  targetId: number;
  targetSlotId: number | null;
  status: MonthStatus;
  /** Every slot in the month, as currently stored. */
  slots: SwapSlot[];
  eligibility: Map<number, readonly Role[]>;
};

export type SwapVerdict = { ok: true } | { ok: false; reason: string };

const no = (reason: string): SwapVerdict => ({ ok: false, reason });

export function validateSwap(c: SwapCheck): SwapVerdict {
  if (!canSwap(c.status)) return no("Swaps are paused while the organiser reviews the schedule.");
  if (c.requesterId === c.targetId) return no("You can't swap with yourself.");

  const mine = c.slots.find((s) => s.id === c.requesterSlotId);
  if (!mine || mine.volunteerId !== c.requesterId) return no("The requester no longer holds that slot.");

  const eligible = (vId: number, role: SlotRole) => (c.eligibility.get(vId) ?? []).includes(role);
  const busyOn = (vId: number, dateId: number, ignore: number[]) =>
    c.slots.some((s) => s.volunteerId === vId && s.dateId === dateId && !ignore.includes(s.id));

  if (c.kind === "handover") {
    if (c.targetSlotId !== null) return no("A hand-over cannot include a second slot.");
    if (!eligible(c.targetId, mine.role)) return no("They are not on the roster for this role.");
    if (busyOn(c.targetId, mine.dateId, [])) return no("They already have a role on that Sunday.");
    return { ok: true };
  }

  const theirs = c.slots.find((s) => s.id === c.targetSlotId);
  if (!theirs || theirs.volunteerId !== c.targetId) return no("That slot has changed hands since the request was made.");
  if (!eligible(c.targetId, mine.role)) return no("They are not on the roster for this role.");
  if (!eligible(c.requesterId, theirs.role)) return no("You are not on the roster for that role.");
  if (busyOn(c.requesterId, theirs.dateId, [mine.id, theirs.id])) return no("You already have another role on that Sunday.");
  if (busyOn(c.targetId, mine.dateId, [mine.id, theirs.id])) return no("They already have another role on that Sunday.");
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/swap-rules.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/swap-rules.ts tests/unit/swap-rules.test.ts
git commit -m "feat: add swap validation rules"
```

---

### Task 7: PIN, session signing and IP hashing

**Files:**
- Create: `src/lib/pin.ts`
- Test: `tests/unit/pin.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
});

describe("hashIp", () => {
  it("is stable and does not contain the address", () => {
    const h = hashIp("203.0.113.9", SECRET);
    expect(h).toBe(hashIp("203.0.113.9", SECRET));
    expect(h).not.toContain("203.0.113.9");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/pin.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement `src/lib/pin.ts`**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/pin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/pin.ts tests/unit/pin.test.ts
git commit -m "feat: add organiser PIN check and signed session tokens"
```

---

### Task 8: Swap share message and draft summary

**Files:**
- Create: `src/lib/swap-message.ts`, `src/lib/summary.ts`
- Test: `tests/unit/swap-message.test.ts`, `tests/unit/summary.test.ts`

- [ ] **Step 1: Write the failing tests**

`tests/unit/swap-message.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { swapMessage } from "@/lib/swap-message";

const url = "https://example.vercel.app/swap/abc";

describe("swapMessage", () => {
  it("describes an exchange", () => {
    expect(
      swapMessage({
        kind: "exchange",
        targetName: "Volunteer B",
        requesterSlot: { date: "2026-11-08", role: "laptop" },
        targetSlot: { date: "2026-11-22", role: "laptop" },
        url,
      }),
    ).toBe(`Hi Volunteer B, can we swap? My Nov 8 Laptop for your Nov 22 Laptop. Tap to accept or decline: ${url}`);
  });

  it("describes a hand-over", () => {
    expect(
      swapMessage({
        kind: "handover",
        targetName: "Volunteer C",
        requesterSlot: { date: "2026-11-15", role: "photog" },
        targetSlot: null,
        url,
      }),
    ).toBe(`Hi Volunteer C, could you take my Nov 15 Photog? Tap to accept or decline: ${url}`);
  });
});
```

`tests/unit/summary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { volunteerSummary } from "@/lib/summary";

describe("volunteerSummary", () => {
  it("counts each person's dates per role, sorted by name", () => {
    const lines = volunteerSummary(
      [
        { date: "2026-11-01", role: "photog", volunteerName: "Volunteer B" },
        { date: "2026-11-29", role: "photog", volunteerName: "Volunteer B" },
        { date: "2026-11-01", role: "laptop", volunteerName: "Volunteer A" },
        { date: "2026-11-08", role: "laptop", volunteerName: null },
      ],
    );
    expect(lines).toEqual(["Volunteer A: Laptop ×1 (Nov 1)", "Volunteer B: Photog ×2 (Nov 1, Nov 29)"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/unit/swap-message.test.ts tests/unit/summary.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `src/lib/swap-message.ts`**

```ts
import { shortDate } from "./dates";
import { ROLE_SHORT, type SlotRole, type SwapKind } from "./roles";

type SlotRef = { date: string; role: SlotRole };

const describe = (s: SlotRef) => `${shortDate(s.date)} ${ROLE_SHORT[s.role]}`;

export function swapMessage(input: {
  kind: SwapKind;
  targetName: string;
  requesterSlot: SlotRef;
  targetSlot: SlotRef | null;
  url: string;
}): string {
  const { kind, targetName, requesterSlot, targetSlot, url } = input;
  const ask =
    kind === "exchange" && targetSlot
      ? `can we swap? My ${describe(requesterSlot)} for your ${describe(targetSlot)}.`
      : `could you take my ${describe(requesterSlot)}?`;
  return `Hi ${targetName}, ${ask} Tap to accept or decline: ${url}`;
}
```

- [ ] **Step 4: Implement `src/lib/summary.ts`**

```ts
import { shortDate } from "./dates";
import { ROLE_SHORT, SLOT_ROLES, type SlotRole } from "./roles";

type Assignment = { date: string; role: SlotRole; volunteerName: string | null };

/** One line per person, e.g. "Volunteer B: Photog ×2 (Nov 1, Nov 29)". */
export function volunteerSummary(assignments: Assignment[]): string[] {
  const byName = new Map<string, Assignment[]>();
  for (const a of assignments) {
    if (!a.volunteerName) continue;
    byName.set(a.volunteerName, [...(byName.get(a.volunteerName) ?? []), a]);
  }
  return [...byName.keys()].sort().map((name) => {
    const parts = SLOT_ROLES.flatMap((role) => {
      const dates = byName.get(name)!.filter((a) => a.role === role).map((a) => a.date).sort();
      return dates.length ? [`${ROLE_SHORT[role]} ×${dates.length} (${dates.map(shortDate).join(", ")})`] : [];
    });
    return `${name}: ${parts.join("; ")}`;
  });
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/unit/swap-message.test.ts tests/unit/summary.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/swap-message.ts src/lib/summary.ts tests/unit/swap-message.test.ts tests/unit/summary.test.ts
git commit -m "feat: add swap share message and draft summary"
```

---

### Task 9: Database schema, client and Neon setup

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `drizzle/` (generated)
- Local only: `.env.local`

- [ ] **Step 1: Create the Neon project and branches**

Using the Neon console or Neon MCP tools (ask the user before creating anything):
1. Create project `emmtee-sched` in region **AWS Asia Pacific (Singapore) `aws-ap-southeast-1`**, closest to the Philippines.
2. The default branch (`main`) is production.
3. Create branch `dev` (for local development) and branch `test` (for integration tests; its data is wiped on every run).
4. Copy the **pooled** connection strings into `.env.local`. Never paste them into chat, commits or logs.

```
DATABASE_URL=<dev branch pooled connection string>
TEST_DATABASE_URL=<test branch pooled connection string>
ORGANISER_PIN=<six digits>
SESSION_SECRET=<output of: openssl rand -base64 48>
```

- [ ] **Step 2: Create `src/db/schema.ts`**

```ts
import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { MONTH_STATUSES, ROLES, SLOT_ROLES, SLOT_SOURCES, SWAP_KINDS, SWAP_STATUSES, THEMES } from "@/lib/roles";

export const roleEnum = pgEnum("role", ROLES);
export const slotRoleEnum = pgEnum("slot_role", SLOT_ROLES);
export const monthStatusEnum = pgEnum("month_status", MONTH_STATUSES);
export const themeEnum = pgEnum("theme", THEMES);
export const slotSourceEnum = pgEnum("slot_source", SLOT_SOURCES);
export const swapKindEnum = pgEnum("swap_kind", SWAP_KINDS);
export const swapStatusEnum = pgEnum("swap_status", SWAP_STATUSES);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const volunteers = pgTable("volunteers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  active: boolean("active").notNull().default(true),
  posterOrder: integer("poster_order"),
  createdAt: createdAt(),
});

export const volunteerRoles = pgTable(
  "volunteer_roles",
  {
    volunteerId: integer("volunteer_id")
      .notNull()
      .references(() => volunteers.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.volunteerId, t.role] })],
);

export const months = pgTable(
  "months",
  {
    id: serial("id").primaryKey(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    status: monthStatusEnum("status").notNull().default("open"),
    posterVolunteerId: integer("poster_volunteer_id").references(() => volunteers.id, { onDelete: "set null" }),
    theme: themeEnum("theme").notNull().default("teal"),
    autofillSeed: integer("autofill_seed"),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("months_year_month").on(t.year, t.month)],
);

export const serviceDates = pgTable(
  "service_dates",
  {
    id: serial("id").primaryKey(),
    monthId: integer("month_id")
      .notNull()
      .references(() => months.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [uniqueIndex("service_dates_month_date").on(t.monthId, t.date)],
);

export const slots = pgTable(
  "slots",
  {
    id: serial("id").primaryKey(),
    serviceDateId: integer("service_date_id")
      .notNull()
      .references(() => serviceDates.id, { onDelete: "cascade" }),
    role: slotRoleEnum("role").notNull(),
    volunteerId: integer("volunteer_id").references(() => volunteers.id, { onDelete: "set null" }),
    source: slotSourceEnum("source"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("slots_date_role").on(t.serviceDateId, t.role),
    // One role per person per Sunday, enforced by the database as well as the app.
    uniqueIndex("slots_one_role_per_day")
      .on(t.serviceDateId, t.volunteerId)
      .where(sql`${t.volunteerId} is not null`),
  ],
);

export const swapRequests = pgTable(
  "swap_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: swapKindEnum("kind").notNull(),
    requesterId: integer("requester_id")
      .notNull()
      .references(() => volunteers.id, { onDelete: "cascade" }),
    targetId: integer("target_id")
      .notNull()
      .references(() => volunteers.id, { onDelete: "cascade" }),
    requesterSlotId: integer("requester_slot_id")
      .notNull()
      .references(() => slots.id, { onDelete: "cascade" }),
    targetSlotId: integer("target_slot_id").references(() => slots.id, { onDelete: "cascade" }),
    status: swapStatusEnum("status").notNull().default("pending"),
    reason: text("reason"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("swap_pending_requester_slot").on(t.requesterSlotId).where(sql`${t.status} = 'pending'`),
    uniqueIndex("swap_pending_target_slot").on(t.targetSlotId).where(sql`${t.status} = 'pending'`),
  ],
);

export const organiserAttempts = pgTable("organiser_attempts", {
  ipHash: text("ip_hash").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});
```

- [ ] **Step 3: Create `src/db/index.ts`**

```ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import ws from "ws";
import * as schema from "./schema";

// The WebSocket driver rather than neon-http: accepting a swap needs an interactive
// transaction with row locks, which the HTTP driver cannot do.
neonConfig.webSocketConstructor = ws;

export const db = drizzle({ client: new Pool({ connectionString: process.env.DATABASE_URL! }), schema });

/** Either `db` or a transaction handle, for helpers used both inside and outside transactions. */
export type Executor = PgDatabase<PgQueryResultHKT, typeof schema>;
```

- [ ] **Step 4: Generate and apply migrations to dev and test branches**

Run:
```bash
npm run db:generate
npm run db:migrate
npm run db:migrate:test
```
Expected: `drizzle/0000_*.sql` created; both migrate commands finish without errors. Open the SQL file and confirm it contains `CREATE UNIQUE INDEX "slots_one_role_per_day" ... WHERE "slots"."volunteer_id" is not null`.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/db drizzle
git commit -m "feat: add database schema and Neon client"
```

---

### Task 10: Server queries, roster and seed script

**Files:**
- Create: `src/server/errors.ts`, `src/server/queries.ts`, `src/server/roster.ts`, `scripts/seed.ts`
- Local only: `local/roster.json`

- [ ] **Step 1: Create `src/server/errors.ts`**

```ts
/** Postgres unique_violation (23505); drizzle may wrap the driver error in `cause`. */
export function isUniqueViolation(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current; depth++) {
    if (typeof current === "object" && (current as { code?: string }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
```

- [ ] **Step 2: Create `src/server/queries.ts`**

```ts
import { eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { months, serviceDates, slots, volunteerRoles } from "@/db/schema";
import type { Role } from "@/lib/roles";
import type { SwapSlot } from "@/lib/swap-rules";

export async function slotContext(ex: Executor, slotId: number) {
  const [row] = await ex
    .select({
      id: slots.id,
      role: slots.role,
      volunteerId: slots.volunteerId,
      dateId: slots.serviceDateId,
      date: serviceDates.date,
      monthId: months.id,
      status: months.status,
      deadline: months.deadline,
    })
    .from(slots)
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .innerJoin(months, eq(serviceDates.monthId, months.id))
    .where(eq(slots.id, slotId));
  return row ?? null;
}

export function monthSlots(ex: Executor, monthId: number): Promise<SwapSlot[]> {
  return ex
    .select({ id: slots.id, dateId: slots.serviceDateId, role: slots.role, volunteerId: slots.volunteerId })
    .from(slots)
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .where(eq(serviceDates.monthId, monthId));
}

export async function eligibilityMap(ex: Executor): Promise<Map<number, Role[]>> {
  const rows = await ex.select().from(volunteerRoles);
  const map = new Map<number, Role[]>();
  for (const r of rows) map.set(r.volunteerId, [...(map.get(r.volunteerId) ?? []), r.role]);
  return map;
}
```

- [ ] **Step 3: Create `src/server/roster.ts`**

```ts
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { volunteerRoles, volunteers } from "@/db/schema";
import { fail, type Result } from "@/lib/result";
import type { Role } from "@/lib/roles";
import { isUniqueViolation } from "./errors";

export type VolunteerView = { id: number; name: string; active: boolean; posterOrder: number | null; roles: Role[] };

export async function listVolunteers(): Promise<VolunteerView[]> {
  const [vs, rs] = await Promise.all([
    db.select().from(volunteers).orderBy(asc(volunteers.name)),
    db.select().from(volunteerRoles),
  ]);
  return vs.map((v) => ({
    id: v.id,
    name: v.name,
    active: v.active,
    posterOrder: v.posterOrder,
    roles: rs.filter((r) => r.volunteerId === v.id).map((r) => r.role),
  }));
}

export async function upsertVolunteer(input: {
  name: string;
  roles: Role[];
  posterOrder: number | null;
  active?: boolean;
}): Promise<Result<{ id: number }>> {
  const name = input.name.trim();
  if (!name) return fail("Name is required.");
  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(volunteers)
      .values({ name, posterOrder: input.posterOrder, active: input.active ?? true })
      .onConflictDoUpdate({
        target: volunteers.name,
        set: { posterOrder: input.posterOrder, active: input.active ?? true },
      })
      .returning({ id: volunteers.id });
    await tx.delete(volunteerRoles).where(eq(volunteerRoles.volunteerId, row.id));
    if (input.roles.length) {
      await tx.insert(volunteerRoles).values(input.roles.map((role) => ({ volunteerId: row.id, role })));
    }
    return { ok: true, id: row.id };
  });
}

export async function updateVolunteer(
  id: number,
  input: { active: boolean; roles: Role[]; posterOrder: number | null },
): Promise<Result> {
  try {
    await db.transaction(async (tx) => {
      await tx.update(volunteers).set({ active: input.active, posterOrder: input.posterOrder }).where(eq(volunteers.id, id));
      await tx.delete(volunteerRoles).where(eq(volunteerRoles.volunteerId, id));
      if (input.roles.length) {
        await tx.insert(volunteerRoles).values(input.roles.map((role) => ({ volunteerId: id, role })));
      }
    });
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return fail("Duplicate role.");
    throw e;
  }
}
```

- [ ] **Step 4: Create `scripts/seed.ts`**

```ts
// Loads a roster JSON file (kept in gitignored local/) into the database.
// Usage: npm run seed -- local/roster.json
import { config } from "dotenv";
import { readFile } from "node:fs/promises";

config({ path: ".env.local" });

type Entry = { name: string; roles: ("laptop" | "assist" | "photog" | "poster")[]; posterOrder?: number; active?: boolean };

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Pass the roster file path, e.g. npm run seed -- local/roster.json");
  const { volunteers } = JSON.parse(await readFile(file, "utf8")) as { volunteers: Entry[] };
  // Imported after dotenv so DATABASE_URL is set when the pool is created.
  const { upsertVolunteer } = await import("../src/server/roster");
  for (const v of volunteers) {
    const r = await upsertVolunteer({ name: v.name, roles: v.roles, posterOrder: v.posterOrder ?? null, active: v.active });
    if (!r.ok) throw new Error(`${v.name}: ${r.error}`);
  }
  console.log(`Seeded ${volunteers.length} volunteers.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

`tsx` resolves the `@/` alias from `tsconfig.json`, so the imports inside `src/server/roster.ts` work.

- [ ] **Step 5: Write `local/roster.json` from `local/roster-notes.md` (gitignored, never committed)**

Format (placeholders shown here; use the real names from the notes file in the local copy):

```json
{
  "volunteers": [
    { "name": "Volunteer A", "roles": ["laptop", "poster"], "posterOrder": 2 },
    { "name": "Volunteer B", "roles": ["photog"] },
    { "name": "Volunteer C", "roles": ["assist"] },
    { "name": "Volunteer D", "roles": ["laptop"], "active": false }
  ]
}
```

Poster order follows the rotation in `local/roster-notes.md` (1 = first in the cycle).

- [ ] **Step 6: Seed the dev branch and confirm**

Run: `npm run seed -- local/roster.json`
Expected: `Seeded N volunteers.` where N matches the file.

- [ ] **Step 7: Commit (roster file must not be staged)**

```bash
git add src/server scripts
git status --short | grep local/ && echo "STOP: local file staged" || true
git commit -m "feat: add roster queries and seed script"
```

---

### Task 11: Month read model

**Files:**
- Create: `src/server/month-view.ts`

- [ ] **Step 1: Implement `src/server/month-view.ts`**

```ts
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { months, serviceDates, slots, swapRequests, volunteers } from "@/db/schema";
import { effectiveStatus } from "@/lib/month-status";
import { SLOT_ROLES, type MonthStatus, type SlotRole, type SlotSource, type SwapKind, type Theme } from "@/lib/roles";
import { listVolunteers, type VolunteerView } from "./roster";

export type SlotView = {
  id: number;
  dateId: number;
  date: string;
  role: SlotRole;
  volunteerId: number | null;
  volunteerName: string | null;
  source: SlotSource | null;
};
export type DateView = { id: number; date: string; slots: Record<SlotRole, SlotView> };
export type SwapView = {
  id: string;
  kind: SwapKind;
  requesterId: number;
  targetId: number;
  requesterSlotId: number;
  targetSlotId: number | null;
};
export type MonthView = {
  id: number;
  year: number;
  month: number;
  deadline: Date;
  /** Effective status: an open poll past its deadline reads as "locked". */
  status: MonthStatus;
  theme: Theme;
  notes: string;
  poster: { id: number; name: string } | null;
  dates: DateView[];
  volunteers: VolunteerView[];
  pendingSwaps: SwapView[];
};

export async function listMonths() {
  return db
    .select({ id: months.id, year: months.year, month: months.month, status: months.status })
    .from(months)
    .orderBy(desc(months.year), desc(months.month));
}

export async function getLatestMonthId(): Promise<number | null> {
  const [row] = await listMonths();
  return row?.id ?? null;
}

export async function getMonthIdByYm(year: number, month: number): Promise<number | null> {
  const [row] = await db
    .select({ id: months.id })
    .from(months)
    .where(and(eq(months.year, year), eq(months.month, month)));
  return row?.id ?? null;
}

export async function getMonthView(monthId: number, now = new Date()): Promise<MonthView | null> {
  const [m] = await db.select().from(months).where(eq(months.id, monthId));
  if (!m) return null;

  const dateRows = await db
    .select()
    .from(serviceDates)
    .where(eq(serviceDates.monthId, monthId))
    .orderBy(asc(serviceDates.date));
  const dateIds = dateRows.map((d) => d.id);

  const slotRows = dateIds.length
    ? await db
        .select({
          id: slots.id,
          dateId: slots.serviceDateId,
          role: slots.role,
          volunteerId: slots.volunteerId,
          source: slots.source,
          volunteerName: volunteers.name,
        })
        .from(slots)
        .leftJoin(volunteers, eq(slots.volunteerId, volunteers.id))
        .where(inArray(slots.serviceDateId, dateIds))
    : [];

  const slotIds = slotRows.map((s) => s.id);
  const swapRows = slotIds.length
    ? await db
        .select()
        .from(swapRequests)
        .where(and(eq(swapRequests.status, "pending"), inArray(swapRequests.requesterSlotId, slotIds)))
    : [];

  const vols = await listVolunteers();
  const poster = vols.find((v) => v.id === m.posterVolunteerId);

  return {
    id: m.id,
    year: m.year,
    month: m.month,
    deadline: m.deadline,
    status: effectiveStatus(m.status, m.deadline, now),
    theme: m.theme,
    notes: m.notes,
    poster: poster ? { id: poster.id, name: poster.name } : null,
    dates: dateRows.map((d) => ({
      id: d.id,
      date: d.date,
      slots: Object.fromEntries(
        SLOT_ROLES.map((role) => {
          const s = slotRows.find((x) => x.dateId === d.id && x.role === role)!;
          return [role, { ...s, date: d.date }];
        }),
      ) as Record<SlotRole, SlotView>,
    })),
    volunteers: vols,
    pendingSwaps: swapRows.map((s) => ({
      id: s.id,
      kind: s.kind,
      requesterId: s.requesterId,
      targetId: s.targetId,
      requesterSlotId: s.requesterSlotId,
      targetSlotId: s.targetSlotId,
    })),
  };
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/server/month-view.ts
git commit -m "feat: add month read model"
```

---

### Task 12: Claim and release

**Files:**
- Create: `src/server/poll.ts`

- [ ] **Step 1: Implement `src/server/poll.ts`**

```ts
import { and, eq, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { slots, swapRequests, volunteerRoles } from "@/db/schema";
import { canClaim, effectiveStatus } from "@/lib/month-status";
import { fail, type Result } from "@/lib/result";
import { isUniqueViolation } from "./errors";
import { slotContext } from "./queries";

export async function claimSlot(slotId: number, volunteerId: number, now = new Date()): Promise<Result> {
  const ctx = await slotContext(db, slotId);
  if (!ctx) return fail("Slot not found.");
  if (!canClaim(effectiveStatus(ctx.status, ctx.deadline, now))) return fail("The poll is closed.");

  const roles = await db.select().from(volunteerRoles).where(eq(volunteerRoles.volunteerId, volunteerId));
  if (!roles.some((r) => r.role === ctx.role)) return fail("You are not on the roster for this role.");

  try {
    const updated = await db
      .update(slots)
      .set({ volunteerId, source: "claimed", updatedAt: now })
      .where(and(eq(slots.id, slotId), isNull(slots.volunteerId)))
      .returning({ id: slots.id });
    if (!updated.length) return fail("Someone else already took this slot.");
  } catch (e) {
    if (isUniqueViolation(e)) return fail("You already have a role on that Sunday.");
    throw e;
  }
  return { ok: true };
}

export async function releaseSlot(slotId: number, volunteerId: number, now = new Date()): Promise<Result> {
  const ctx = await slotContext(db, slotId);
  if (!ctx) return fail("Slot not found.");
  if (!canClaim(effectiveStatus(ctx.status, ctx.deadline, now))) return fail("The poll is closed.");

  const updated = await db
    .update(slots)
    .set({ volunteerId: null, source: null, updatedAt: now })
    .where(and(eq(slots.id, slotId), eq(slots.volunteerId, volunteerId)))
    .returning({ id: slots.id });
  if (!updated.length) return fail("This slot is not yours.");

  await db
    .update(swapRequests)
    .set({ status: "cancelled", reason: "The slot was released.", resolvedAt: now })
    .where(
      and(
        eq(swapRequests.status, "pending"),
        or(eq(swapRequests.requesterSlotId, slotId), eq(swapRequests.targetSlotId, slotId)),
      ),
    );
  return { ok: true };
}
```

- [ ] **Step 2: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/server/poll.ts
git commit -m "feat: add claim and release"
```

---

### Task 13: Swaps (server) with integration test

**Files:**
- Create: `src/server/swaps.ts`
- Test: `tests/integration/swaps.int.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
import { beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;

// Runs against the Neon `test` branch only. Every run wipes that branch's tables.
describe.skipIf(!url)("swaps against the database", () => {
  let mod!: {
    db: typeof import("@/db").db;
    schema: typeof import("@/db/schema");
    swaps: typeof import("@/server/swaps");
    sql: typeof import("drizzle-orm").sql;
  };
  let ids!: { a: number; b: number; c: number; s1: number; s2: number; s3: number };

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    mod ??= {
      db: (await import("@/db")).db,
      schema: await import("@/db/schema"),
      swaps: await import("@/server/swaps"),
      sql: (await import("drizzle-orm")).sql,
    };
    const { db, schema, sql } = mod;
    await db.execute(
      sql`truncate swap_requests, slots, service_dates, months, volunteer_roles, volunteers, organiser_attempts restart identity cascade`,
    );
    const [a, b, c] = await db
      .insert(schema.volunteers)
      .values([{ name: "Volunteer A" }, { name: "Volunteer B" }, { name: "Volunteer C" }])
      .returning({ id: schema.volunteers.id });
    await db.insert(schema.volunteerRoles).values([a, b, c].map((v) => ({ volunteerId: v.id, role: "laptop" as const })));
    const [m] = await db
      .insert(schema.months)
      .values({ year: 2026, month: 11, deadline: new Date("2099-01-01T00:00:00Z") })
      .returning({ id: schema.months.id });
    const dates = await db
      .insert(schema.serviceDates)
      .values(["2026-11-01", "2026-11-08", "2026-11-15"].map((date) => ({ monthId: m.id, date })))
      .returning({ id: schema.serviceDates.id });
    const [s1, s2, s3] = await db
      .insert(schema.slots)
      .values([
        { serviceDateId: dates[0].id, role: "laptop" as const, volunteerId: a.id, source: "claimed" as const },
        { serviceDateId: dates[1].id, role: "laptop" as const, volunteerId: b.id, source: "claimed" as const },
        { serviceDateId: dates[2].id, role: "laptop" as const, volunteerId: c.id, source: "claimed" as const },
      ])
      .returning({ id: schema.slots.id });
    ids = { a: a.id, b: b.id, c: c.id, s1: s1.id, s2: s2.id, s3: s3.id };
  });

  const holder = async (slotId: number) => {
    const { db, schema } = mod;
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.slots).where(eq(schema.slots.id, slotId));
    return row.volunteerId;
  };

  it("exchanges two slots when the target accepts", async () => {
    const created = await mod.swaps.createSwap({
      kind: "exchange", requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.b, targetSlotId: ids.s2,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(await mod.swaps.acceptSwap(created.id, ids.b)).toEqual({ ok: true });
    expect(await holder(ids.s1)).toBe(ids.b);
    expect(await holder(ids.s2)).toBe(ids.a);
  });

  it("only lets the target accept", async () => {
    const created = await mod.swaps.createSwap({
      kind: "exchange", requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.b, targetSlotId: ids.s2,
    });
    if (!created.ok) throw new Error(created.error);
    expect(await mod.swaps.acceptSwap(created.id, ids.c)).toMatchObject({ ok: false });
  });

  it("accepts only one of two conflicting requests accepted at the same time", async () => {
    const { db, schema } = mod;
    // r1: A gives s1 for B's s2. r2: C gives s3 for A's s1. Both touch s1.
    const [r1, r2] = await db
      .insert(schema.swapRequests)
      .values([
        { kind: "exchange" as const, requesterId: ids.a, targetId: ids.b, requesterSlotId: ids.s1, targetSlotId: ids.s2 },
        { kind: "exchange" as const, requesterId: ids.c, targetId: ids.a, requesterSlotId: ids.s3, targetSlotId: ids.s1 },
      ])
      .returning({ id: schema.swapRequests.id });

    const results = await Promise.all([mod.swaps.acceptSwap(r1.id, ids.b), mod.swaps.acceptSwap(r2.id, ids.a)]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);

    const holders = [await holder(ids.s1), await holder(ids.s2), await holder(ids.s3)];
    expect(new Set(holders).size).toBe(3); // nobody lost or duplicated
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:int`
Expected: FAIL, cannot resolve `@/server/swaps`. (If `TEST_DATABASE_URL` is missing the suite is skipped; set it first.)

- [ ] **Step 3: Implement `src/server/swaps.ts`**

```ts
import { and, asc, eq, inArray, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { serviceDates, slots, swapRequests, volunteers } from "@/db/schema";
import { effectiveStatus } from "@/lib/month-status";
import { fail, notNull, type Result } from "@/lib/result";
import type { SlotRole, SwapKind, SwapStatus } from "@/lib/roles";
import { validateSwap } from "@/lib/swap-rules";
import { isUniqueViolation } from "./errors";
import { eligibilityMap, monthSlots, slotContext } from "./queries";

const PENDING_CLASH = "There is already a pending swap for one of these slots.";

export type CreateSwapInput = {
  kind: SwapKind;
  requesterId: number;
  requesterSlotId: number;
  targetId: number;
  targetSlotId: number | null;
};

export async function createSwap(input: CreateSwapInput, now = new Date()): Promise<Result<{ id: string }>> {
  const ctx = await slotContext(db, input.requesterSlotId);
  if (!ctx) return fail("Slot not found.");
  if (input.targetSlotId !== null) {
    const target = await slotContext(db, input.targetSlotId);
    if (!target || target.monthId !== ctx.monthId) return fail("Both slots must be in the same month.");
  }

  const verdict = validateSwap({
    ...input,
    status: effectiveStatus(ctx.status, ctx.deadline, now),
    slots: await monthSlots(db, ctx.monthId),
    eligibility: await eligibilityMap(db),
  });
  if (!verdict.ok) return fail(verdict.reason);

  const slotIds = [input.requesterSlotId, input.targetSlotId].filter(notNull);
  const clash = await db
    .select({ id: swapRequests.id })
    .from(swapRequests)
    .where(
      and(
        eq(swapRequests.status, "pending"),
        or(inArray(swapRequests.requesterSlotId, slotIds), inArray(swapRequests.targetSlotId, slotIds)),
      ),
    )
    .limit(1);
  if (clash.length) return fail(PENDING_CLASH);

  try {
    const [row] = await db.insert(swapRequests).values(input).returning({ id: swapRequests.id });
    return { ok: true, id: row.id };
  } catch (e) {
    if (isUniqueViolation(e)) return fail(PENDING_CLASH);
    throw e;
  }
}

export async function acceptSwap(id: string, actorId: number, now = new Date()): Promise<Result> {
  return db.transaction(async (tx) => {
    const [first] = await tx.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (!first) return fail("Swap request not found.");
    const slotIds = [first.requesterSlotId, first.targetSlotId].filter(notNull);

    // Lock order is always slots (by id) then requests (by id). Two accepts that share
    // a slot therefore queue on the same first lock instead of deadlocking.
    await tx.select({ id: slots.id }).from(slots).where(inArray(slots.id, slotIds)).orderBy(asc(slots.id)).for("update");
    await tx
      .select({ id: swapRequests.id })
      .from(swapRequests)
      .where(
        or(
          eq(swapRequests.id, id),
          inArray(swapRequests.requesterSlotId, slotIds),
          inArray(swapRequests.targetSlotId, slotIds),
        ),
      )
      .orderBy(asc(swapRequests.id))
      .for("update");

    // Re-read now that we hold the locks; another accept may have just committed.
    const [req] = await tx.select().from(swapRequests).where(eq(swapRequests.id, id));
    if (req.status !== "pending") return fail(`This request is already ${req.status}.`);
    if (req.targetId !== actorId) return fail("Only the person being asked can accept.");

    const ctx = await slotContext(tx, req.requesterSlotId);
    if (!ctx) return fail("Slot not found.");
    const verdict = validateSwap({
      kind: req.kind,
      requesterId: req.requesterId,
      requesterSlotId: req.requesterSlotId,
      targetId: req.targetId,
      targetSlotId: req.targetSlotId,
      status: effectiveStatus(ctx.status, ctx.deadline, now),
      slots: await monthSlots(tx, ctx.monthId),
      eligibility: await eligibilityMap(tx),
    });
    if (!verdict.ok) {
      await tx
        .update(swapRequests)
        .set({ status: "invalid", reason: verdict.reason, resolvedAt: now })
        .where(eq(swapRequests.id, id));
      return fail(verdict.reason);
    }

    if (req.kind === "handover") {
      await tx
        .update(slots)
        .set({ volunteerId: req.targetId, source: "claimed", updatedAt: now })
        .where(eq(slots.id, req.requesterSlotId));
    } else {
      // Clear both first: if the two slots are on the same Sunday, assigning either
      // before the other is cleared would briefly give one person two roles that day.
      await tx.update(slots).set({ volunteerId: null }).where(inArray(slots.id, slotIds));
      await tx
        .update(slots)
        .set({ volunteerId: req.targetId, source: "claimed", updatedAt: now })
        .where(eq(slots.id, req.requesterSlotId));
      await tx
        .update(slots)
        .set({ volunteerId: req.requesterId, source: "claimed", updatedAt: now })
        .where(eq(slots.id, req.targetSlotId!));
    }

    await tx
      .update(swapRequests)
      .set({ status: "cancelled", reason: "Another swap for this slot was accepted.", resolvedAt: now })
      .where(
        and(
          eq(swapRequests.status, "pending"),
          ne(swapRequests.id, id),
          or(inArray(swapRequests.requesterSlotId, slotIds), inArray(swapRequests.targetSlotId, slotIds)),
        ),
      );
    await tx.update(swapRequests).set({ status: "accepted", resolvedAt: now }).where(eq(swapRequests.id, id));
    return { ok: true };
  });
}

async function close(id: string, actorId: number, who: "target" | "requester", status: SwapStatus, now: Date) {
  const [req] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
  if (!req) return fail("Swap request not found.");
  if (req.status !== "pending") return fail(`This request is already ${req.status}.`);
  const allowed = who === "target" ? req.targetId : req.requesterId;
  if (allowed !== actorId) return fail(who === "target" ? "Only the person being asked can decline." : "Only the requester can cancel.");
  await db
    .update(swapRequests)
    .set({ status, resolvedAt: now })
    .where(and(eq(swapRequests.id, id), eq(swapRequests.status, "pending")));
  return { ok: true } as const;
}

export const declineSwap = (id: string, actorId: number, now = new Date()): Promise<Result> =>
  close(id, actorId, "target", "declined", now);

export const cancelSwap = (id: string, actorId: number, now = new Date()): Promise<Result> =>
  close(id, actorId, "requester", "cancelled", now);

export type SwapDetail = {
  id: string;
  kind: SwapKind;
  status: SwapStatus;
  reason: string | null;
  requester: { id: number; name: string };
  target: { id: number; name: string };
  requesterSlot: { date: string; role: SlotRole };
  targetSlot: { date: string; role: SlotRole } | null;
};

export async function getSwapDetail(id: string): Promise<SwapDetail | null> {
  const [req] = await db.select().from(swapRequests).where(eq(swapRequests.id, id));
  if (!req) return null;
  const slotRows = await db
    .select({ id: slots.id, role: slots.role, date: serviceDates.date })
    .from(slots)
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .where(inArray(slots.id, [req.requesterSlotId, req.targetSlotId].filter(notNull)));
  const people = await db
    .select({ id: volunteers.id, name: volunteers.name })
    .from(volunteers)
    .where(inArray(volunteers.id, [req.requesterId, req.targetId]));
  const slot = (sid: number | null) => {
    const s = slotRows.find((x) => x.id === sid);
    return s ? { date: s.date, role: s.role } : null;
  };
  const person = (pid: number) => people.find((p) => p.id === pid) ?? { id: pid, name: "Unknown" };
  const requesterSlot = slot(req.requesterSlotId);
  if (!requesterSlot) return null;
  return {
    id: req.id,
    kind: req.kind,
    status: req.status,
    reason: req.reason,
    requester: person(req.requesterId),
    target: person(req.targetId),
    requesterSlot,
    targetSlot: slot(req.targetSlotId),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:int`
Expected: PASS (3 tests). Run it three times; the concurrency test must pass every time.

- [ ] **Step 5: Commit**

```bash
git add src/server/swaps.ts tests/integration/swaps.int.test.ts
git commit -m "feat: add swap requests with locked, atomic acceptance"
```

---

### Task 14: Organiser operations and PIN rate limiting (server)

**Files:**
- Create: `src/server/organiser.ts`, `src/server/rate-limit.ts`

- [ ] **Step 1: Create `src/server/rate-limit.ts`**

```ts
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
```

- [ ] **Step 2: Create `src/server/organiser.ts`**

```ts
import { and, desc, eq, inArray, lt, or } from "drizzle-orm";
import { db } from "@/db";
import { months, serviceDates, slots } from "@/db/schema";
import { autofill } from "@/lib/autofill";
import { defaultDeadline, sundaysInMonth } from "@/lib/dates";
import { effectiveStatus, nextStatus, type MonthOp } from "@/lib/month-status";
import { nextPoster } from "@/lib/poster-rotation";
import { fail, type Result } from "@/lib/result";
import { isSlotRole, SLOT_ROLES, type Theme } from "@/lib/roles";
import { isUniqueViolation } from "./errors";
import { listVolunteers } from "./roster";

async function insertDate(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], monthId: number, date: string) {
  const [d] = await tx.insert(serviceDates).values({ monthId, date }).returning({ id: serviceDates.id });
  await tx.insert(slots).values(SLOT_ROLES.map((role) => ({ serviceDateId: d.id, role })));
}

export async function createMonth(year: number, month: number): Promise<Result<{ id: number }>> {
  if (month < 1 || month > 12 || year < 2024 || year > 2100) return fail("Pick a valid month.");
  const vols = await listVolunteers();
  const rotation = vols
    .filter((v) => v.active && v.roles.includes("poster") && v.posterOrder !== null)
    .sort((a, b) => a.posterOrder! - b.posterOrder!)
    .map((v) => v.id);
  const [prev] = await db
    .select({ posterVolunteerId: months.posterVolunteerId })
    .from(months)
    .where(or(lt(months.year, year), and(eq(months.year, year), lt(months.month, month))))
    .orderBy(desc(months.year), desc(months.month))
    .limit(1);

  try {
    return await db.transaction(async (tx) => {
      const [m] = await tx
        .insert(months)
        .values({
          year,
          month,
          deadline: defaultDeadline(year, month),
          posterVolunteerId: nextPoster(rotation, prev?.posterVolunteerId ?? null),
        })
        .returning({ id: months.id });
      for (const date of sundaysInMonth(year, month)) await insertDate(tx, m.id, date);
      return { ok: true as const, id: m.id };
    });
  } catch (e) {
    if (isUniqueViolation(e)) return fail("That month already exists.");
    throw e;
  }
}

export async function updateMonthSettings(
  monthId: number,
  input: { deadline: Date; posterVolunteerId: number | null; theme: Theme; notes: string },
): Promise<Result> {
  await db.update(months).set(input).where(eq(months.id, monthId));
  return { ok: true };
}

export async function addServiceDate(monthId: number, date: string): Promise<Result> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail("Pick a date.");
  try {
    await db.transaction((tx) => insertDate(tx, monthId, date));
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return fail("That date is already in the schedule.");
    throw e;
  }
}

export async function removeServiceDate(dateId: number): Promise<Result> {
  await db.delete(serviceDates).where(eq(serviceDates.id, dateId));
  return { ok: true };
}

export async function setSlotManually(slotId: number, volunteerId: number | null): Promise<Result> {
  try {
    await db
      .update(slots)
      .set({ volunteerId, source: volunteerId === null ? null : "manual", updatedAt: new Date() })
      .where(eq(slots.id, slotId));
    return { ok: true };
  } catch (e) {
    if (isUniqueViolation(e)) return fail("That person already has a role on that Sunday.");
    throw e;
  }
}

export async function transitionMonth(monthId: number, op: MonthOp, now = new Date()): Promise<Result> {
  const [m] = await db.select().from(months).where(eq(months.id, monthId));
  if (!m) return fail("Month not found.");
  const to = nextStatus(effectiveStatus(m.status, m.deadline, now), op);
  if (!to) return fail(`Can't ${op} from the current status.`);
  if (op === "reopen" && m.deadline.getTime() <= now.getTime()) {
    return fail("Move the deadline later before reopening the poll.");
  }
  await db.update(months).set({ status: to }).where(eq(months.id, monthId));
  return { ok: true };
}

export async function runAutofill(monthId: number, seed: number, now = new Date()): Promise<Result<{ unfilled: number }>> {
  const [m] = await db.select().from(months).where(eq(months.id, monthId));
  if (!m) return fail("Month not found.");
  const status = effectiveStatus(m.status, m.deadline, now);
  if (status !== "locked" && status !== "draft") return fail("Lock the poll before running auto-fill.");

  const rows = await db
    .select({ id: slots.id, date: serviceDates.date, role: slots.role, volunteerId: slots.volunteerId, source: slots.source })
    .from(slots)
    .innerJoin(serviceDates, eq(slots.serviceDateId, serviceDates.id))
    .where(eq(serviceDates.monthId, monthId));
  const vols = (await listVolunteers())
    .filter((v) => v.active)
    .map((v) => ({ id: v.id, roles: v.roles.filter(isSlotRole) }));
  const result = autofill(rows, vols, seed);

  await db.transaction(async (tx) => {
    // Clear old auto picks before writing new ones so the one-role-per-day index
    // never sees a transient duplicate.
    await tx
      .update(slots)
      .set({ volunteerId: null, source: null })
      .where(and(inArray(slots.id, rows.map((r) => r.id)), eq(slots.source, "auto")));
    for (const s of result.slots) {
      if (s.source !== "auto") continue;
      await tx.update(slots).set({ volunteerId: s.volunteerId, source: "auto", updatedAt: now }).where(eq(slots.id, s.id));
    }
    await tx.update(months).set({ status: "draft", autofillSeed: seed }).where(eq(months.id, monthId));
  });
  return { ok: true, unfilled: result.unfilled.length };
}
```

- [ ] **Step 3: Type-check and commit**

Run: `npx tsc --noEmit`
Expected: no errors.

```bash
git add src/server/organiser.ts src/server/rate-limit.ts
git commit -m "feat: add organiser month operations and PIN rate limiting"
```

---

### Task 15: Session and server actions

**Files:**
- Create: `src/app/session.ts`, `src/app/actions/poll.ts`, `src/app/actions/organiser.ts`

- [ ] **Step 1: Create `src/app/session.ts`**

```ts
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
```

Install the guard package: `npm install server-only`.

- [ ] **Step 2: Create `src/app/actions/poll.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { isId, isUuid } from "@/lib/ids";
import { fail, type Result } from "@/lib/result";
import { claimSlot, releaseSlot } from "@/server/poll";
import { acceptSwap, cancelSwap, createSwap, declineSwap, type CreateSwapInput } from "@/server/swaps";

export async function claimAction(slotId: number, volunteerId: number): Promise<Result> {
  if (!isId(slotId) || !isId(volunteerId)) return fail("Invalid request.");
  const r = await claimSlot(slotId, volunteerId);
  revalidatePath("/");
  return r;
}

export async function releaseAction(slotId: number, volunteerId: number): Promise<Result> {
  if (!isId(slotId) || !isId(volunteerId)) return fail("Invalid request.");
  const r = await releaseSlot(slotId, volunteerId);
  revalidatePath("/");
  return r;
}

export async function createSwapAction(input: CreateSwapInput): Promise<Result<{ id: string }>> {
  const kindOk = input.kind === "exchange" || input.kind === "handover";
  const targetSlotOk = input.targetSlotId === null || isId(input.targetSlotId);
  if (!kindOk || !isId(input.requesterId) || !isId(input.requesterSlotId) || !isId(input.targetId) || !targetSlotOk) {
    return fail("Invalid request.");
  }
  const r = await createSwap(input);
  revalidatePath("/");
  return r;
}

export async function respondSwapAction(
  id: string,
  actorId: number,
  response: "accept" | "decline" | "cancel",
): Promise<Result> {
  if (!isUuid(id) || !isId(actorId)) return fail("Invalid request.");
  const r =
    response === "accept"
      ? await acceptSwap(id, actorId)
      : response === "decline"
        ? await declineSwap(id, actorId)
        : await cancelSwap(id, actorId);
  revalidatePath("/");
  revalidatePath(`/swap/${id}`);
  return r;
}
```

- [ ] **Step 3: Create `src/app/actions/organiser.ts`**

```ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseManilaInput } from "@/lib/dates";
import { pinMatches } from "@/lib/pin";
import { ROLES, THEMES, type Role, type Theme } from "@/lib/roles";
import type { MonthOp } from "@/lib/month-status";
import {
  addServiceDate,
  createMonth,
  removeServiceDate,
  runAutofill,
  setSlotManually,
  transitionMonth,
  updateMonthSettings,
} from "@/server/organiser";
import { clearFailures, isLockedOut, recordFailure } from "@/server/rate-limit";
import { updateVolunteer, upsertVolunteer } from "@/server/roster";
import { clientIpHash, endSession, isOrganiser, startSession } from "../session";

const int = (fd: FormData, key: string): number | null => {
  const raw = fd.get(key);
  if (raw === null || raw === "") return null;
  const n = Number(raw);
  return Number.isInteger(n) ? n : null;
};
const str = (fd: FormData, key: string) => String(fd.get(key) ?? "");
const roles = (fd: FormData): Role[] => fd.getAll("roles").map(String).filter((r): r is Role => (ROLES as readonly string[]).includes(r));

async function guard(): Promise<void> {
  if (!(await isOrganiser())) redirect(`/organiser?msg=${encodeURIComponent("Please log in again.")}`);
}

function back(fd: FormData, msg: string): never {
  revalidatePath("/");
  revalidatePath("/organiser");
  const ym = str(fd, "ym");
  redirect(`/organiser?${ym ? `m=${ym}&` : ""}msg=${encodeURIComponent(msg)}`);
}

export async function loginAction(_prev: { error: string | null }, fd: FormData): Promise<{ error: string | null }> {
  const ip = await clientIpHash();
  const now = new Date();
  if (await isLockedOut(ip, now)) return { error: "Too many attempts. Try again in 15 minutes." };
  if (!pinMatches(str(fd, "pin"), process.env.ORGANISER_PIN ?? "")) {
    await recordFailure(ip, now);
    return { error: "Wrong PIN." };
  }
  await clearFailures(ip);
  await startSession();
  redirect("/organiser");
}

export async function logoutAction(): Promise<void> {
  await endSession();
  redirect("/organiser");
}

export async function createMonthAction(fd: FormData): Promise<void> {
  await guard();
  const year = int(fd, "year");
  const month = int(fd, "month");
  if (year === null || month === null) back(fd, "Pick a valid month.");
  const r = await createMonth(year, month);
  fd.set("ym", `${year}-${String(month).padStart(2, "0")}`);
  back(fd, r.ok ? "Month created." : r.error);
}

export async function updateMonthAction(fd: FormData): Promise<void> {
  await guard();
  const monthId = int(fd, "monthId");
  const deadline = parseManilaInput(str(fd, "deadline"));
  const theme = str(fd, "theme") as Theme;
  if (monthId === null || !deadline || !THEMES.includes(theme)) back(fd, "Check the deadline and theme.");
  const r = await updateMonthSettings(monthId, {
    deadline,
    posterVolunteerId: int(fd, "posterVolunteerId"),
    theme,
    notes: str(fd, "notes"),
  });
  back(fd, r.ok ? "Saved." : r.error);
}

export async function transitionAction(fd: FormData): Promise<void> {
  await guard();
  const monthId = int(fd, "monthId");
  const op = str(fd, "op") as MonthOp;
  if (monthId === null || !["lock", "reopen", "publish", "unpublish"].includes(op)) back(fd, "Invalid request.");
  const r = await transitionMonth(monthId, op);
  back(fd, r.ok ? `Done: ${op}.` : r.error);
}

export async function autofillAction(fd: FormData): Promise<void> {
  await guard();
  const monthId = int(fd, "monthId");
  if (monthId === null) back(fd, "Invalid request.");
  const r = await runAutofill(monthId, Math.floor(Math.random() * 2 ** 31));
  back(fd, r.ok ? `Draft ready. ${r.unfilled} slot(s) still empty.` : r.error);
}

export async function setSlotAction(fd: FormData): Promise<void> {
  await guard();
  const slotId = int(fd, "slotId");
  if (slotId === null) back(fd, "Invalid request.");
  const r = await setSlotManually(slotId, int(fd, "volunteerId"));
  back(fd, r.ok ? "Slot updated." : r.error);
}

export async function addDateAction(fd: FormData): Promise<void> {
  await guard();
  const monthId = int(fd, "monthId");
  if (monthId === null) back(fd, "Invalid request.");
  const r = await addServiceDate(monthId, str(fd, "date"));
  back(fd, r.ok ? "Date added." : r.error);
}

export async function removeDateAction(fd: FormData): Promise<void> {
  await guard();
  const dateId = int(fd, "dateId");
  if (dateId === null) back(fd, "Invalid request.");
  await removeServiceDate(dateId);
  back(fd, "Date removed.");
}

export async function addVolunteerAction(fd: FormData): Promise<void> {
  await guard();
  const r = await upsertVolunteer({ name: str(fd, "name"), roles: roles(fd), posterOrder: int(fd, "posterOrder") });
  back(fd, r.ok ? "Volunteer saved." : r.error);
}

export async function updateVolunteerAction(fd: FormData): Promise<void> {
  await guard();
  const id = int(fd, "volunteerId");
  if (id === null) back(fd, "Invalid request.");
  const r = await updateVolunteer(id, { active: fd.get("active") === "on", roles: roles(fd), posterOrder: int(fd, "posterOrder") });
  back(fd, r.ok ? "Volunteer updated." : r.error);
}
```

- [ ] **Step 4: Type-check, lint and commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors.

```bash
git add src/app/session.ts src/app/actions package.json package-lock.json
git commit -m "feat: add organiser session and server actions"
```

---

### Task 16: Poll page (`/`)

**Files:**
- Create: `src/app/components/use-me.ts`, `NamePicker.tsx`, `Countdown.tsx`, `SharePanel.tsx`, `ShareImageButton.tsx`, `PollView.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

- [ ] **Step 1: Create `src/app/components/use-me.ts`**

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "emmtee:me";
const listeners = new Set<() => void>();
// Fallback when storage is blocked (private mode): the choice lasts for this tab only.
let memory: string | null = null;

function read(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** The volunteer this device belongs to, remembered between visits. */
export function useMe(): [number | null, (id: number | null) => void] {
  const raw = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((id: number | null) => {
    memory = id === null ? null : String(id);
    try {
      if (id === null) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, String(id));
    } catch {
      // Storage blocked; `memory` still holds the choice.
    }
    listeners.forEach((l) => l());
  }, []);
  return [raw ? Number(raw) : null, set];
}
```

- [ ] **Step 2: Create `src/app/components/NamePicker.tsx`**

```tsx
"use client";

import type { VolunteerView } from "@/server/roster";

export function NamePicker({
  volunteers,
  me,
  onChange,
}: {
  volunteers: VolunteerView[];
  me: number | null;
  onChange: (id: number | null) => void;
}) {
  const current = volunteers.find((v) => v.id === me);
  if (current) {
    return (
      <p className="text-sm">
        You are <strong>{current.name}</strong>.{" "}
        <button type="button" className="underline" onClick={() => onChange(null)}>
          Not you?
        </button>
      </p>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      Who are you?
      <select
        className="rounded border px-3 py-2 text-base"
        defaultValue=""
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Pick your name…</option>
        {volunteers
          .filter((v) => v.active)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 3: Create `src/app/components/Countdown.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { formatCountdown, formatManila } from "@/lib/dates";

export function Countdown({ deadline }: { deadline: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = deadline.getTime() - now;
  return (
    <span suppressHydrationWarning>
      {left > 0 ? `Closes in ${formatCountdown(left)} (${formatManila(deadline)})` : "Closed — waiting for the organiser"}
    </span>
  );
}
```

- [ ] **Step 4: Create `src/app/components/SharePanel.tsx`**

```tsx
"use client";

import { useState } from "react";

export function SharePanel({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium">Request sent. Send this to them on Messenger:</p>
      <textarea readOnly value={text} rows={4} className="w-full rounded border p-2 text-sm" />
      <div className="mt-2 flex gap-2">
        {canShare && (
          <button type="button" className="rounded bg-black px-3 py-2 text-sm text-white" onClick={() => navigator.share({ text }).catch(() => {})}>
            Share
          </button>
        )}
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="ml-auto text-sm underline" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Create `src/app/components/ShareImageButton.tsx`**

```tsx
"use client";

import { useState } from "react";

export function ShareImageButton({ ym, title }: { ym: string; title: string }) {
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setError(null);
    const res = await fetch(`/api/months/${ym}/image`, { cache: "no-store" });
    if (!res.ok) {
      setError("Couldn't create the image. Try again.");
      return;
    }
    const blob = await res.blob();
    const file = new File([blob], `schedule-${ym}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <button type="button" onClick={share} className="rounded bg-black px-4 py-2 text-white">
        Share schedule image
      </button>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 6: Create `src/app/components/PollView.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { claimAction, createSwapAction, releaseAction } from "@/app/actions/poll";
import { monthLabel, shortDate, ym } from "@/lib/dates";
import { canClaim, canSwap } from "@/lib/month-status";
import { ROLE_SHORT, SLOT_ROLES } from "@/lib/roles";
import type { Result } from "@/lib/result";
import { swapMessage } from "@/lib/swap-message";
import type { MonthView, SlotView } from "@/server/month-view";
import { Countdown } from "./Countdown";
import { NamePicker } from "./NamePicker";
import { SharePanel } from "./SharePanel";
import { ShareImageButton } from "./ShareImageButton";
import { useMe } from "./use-me";

type Picking = { mode: "exchange"; target: SlotView } | { mode: "handover"; mine: SlotView } | null;

const STATUS_TEXT = {
  open: "Open — pick your dates",
  locked: "Closed — waiting for the organiser",
  draft: "Being finalised by the organiser",
  published: "Final schedule",
} as const;

export function PollView({ view }: { view: MonthView }) {
  const [me, setMe] = useMe();
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState<Picking>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  const meV = view.volunteers.find((v) => v.id === me) ?? null;
  const allSlots = view.dates.flatMap((d) => SLOT_ROLES.map((r) => d.slots[r]));
  const mySlots = allSlots.filter((s) => me !== null && s.volunteerId === me);
  const incoming = view.pendingSwaps.filter((s) => s.targetId === me);
  const outgoing = view.pendingSwaps.filter((s) => s.requesterId === me);
  const rolesOf = (id: number | null) => view.volunteers.find((v) => v.id === id)?.roles ?? [];

  function run(action: () => Promise<Result>) {
    startTransition(async () => {
      setError(null);
      const r = await action();
      if (!r.ok) setError(r.error);
    });
  }

  function request(kind: "exchange" | "handover", mine: SlotView, target: { id: number; name: string }, theirs: SlotView | null) {
    if (!meV) return;
    startTransition(async () => {
      setError(null);
      const r = await createSwapAction({
        kind,
        requesterId: meV.id,
        requesterSlotId: mine.id,
        targetId: target.id,
        targetSlotId: theirs?.id ?? null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setPicking(null);
      setShareText(
        swapMessage({ kind, targetName: target.name, requesterSlot: mine, targetSlot: theirs, url: `${location.origin}/swap/${r.id}` }),
      );
    });
  }

  function renderCell(slot: SlotView) {
    const eligible = !!meV && meV.roles.includes(slot.role);
    if (slot.volunteerId === null) {
      return canClaim(view.status) && eligible ? (
        <button type="button" disabled={busy} className="rounded border border-dashed px-3 py-1 text-sm" onClick={() => run(() => claimAction(slot.id, meV!.id))}>
          Claim
        </button>
      ) : (
        <span className="text-neutral-400">---</span>
      );
    }
    const mine = slot.volunteerId === me;
    return (
      <div className="flex flex-col items-start gap-1">
        <span className={`rounded-full px-3 py-1 text-sm ${mine ? "bg-black text-white" : "bg-pink-50"}`}>{slot.volunteerName}</span>
        <div className="flex gap-2 text-xs">
          {mine && canClaim(view.status) && (
            <button type="button" disabled={busy} className="underline" onClick={() => run(() => releaseAction(slot.id, meV!.id))}>
              Release
            </button>
          )}
          {mine && canSwap(view.status) && (
            <button type="button" className="underline" onClick={() => setPicking({ mode: "handover", mine: slot })}>
              Hand over
            </button>
          )}
          {!mine && meV && canSwap(view.status) && meV.roles.includes(slot.role) && (
            <button type="button" className="underline" onClick={() => setPicking({ mode: "exchange", target: slot })}>
              Request swap
            </button>
          )}
        </div>
      </div>
    );
  }

  function renderPicker() {
    if (!picking || !meV) return null;
    if (picking.mode === "exchange") {
      const t = picking.target;
      const offers = mySlots.filter((s) => rolesOf(t.volunteerId).includes(s.role));
      return (
        <div className="rounded-lg border bg-white p-4">
          <p className="mb-2 text-sm">
            Swap for {t.volunteerName}&apos;s {shortDate(t.date)} {ROLE_SHORT[t.role]}. Offer one of your dates:
          </p>
          {offers.length === 0 && <p className="text-sm text-neutral-500">You have no dates they could take. Claim one first.</p>}
          <div className="flex flex-wrap gap-2">
            {offers.map((s) => (
              <button key={s.id} type="button" disabled={busy} className="rounded border px-3 py-1 text-sm" onClick={() => request("exchange", s, { id: t.volunteerId!, name: t.volunteerName! }, t)}>
                {shortDate(s.date)} {ROLE_SHORT[s.role]}
              </button>
            ))}
          </div>
          <button type="button" className="mt-2 text-sm underline" onClick={() => setPicking(null)}>Cancel</button>
        </div>
      );
    }
    const m = picking.mine;
    const candidates = view.volunteers.filter((v) => v.active && v.id !== meV.id && v.roles.includes(m.role));
    return (
      <div className="rounded-lg border bg-white p-4">
        <p className="mb-2 text-sm">Who should take your {shortDate(m.date)} {ROLE_SHORT[m.role]}?</p>
        <div className="flex flex-wrap gap-2">
          {candidates.map((v) => (
            <button key={v.id} type="button" disabled={busy} className="rounded border px-3 py-1 text-sm" onClick={() => request("handover", m, v, null)}>
              {v.name}
            </button>
          ))}
        </div>
        <button type="button" className="mt-2 text-sm underline" onClick={() => setPicking(null)}>Cancel</button>
      </div>
    );
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold">{monthLabel(view.year, view.month)}</h1>
        <p className="text-sm text-neutral-600">
          {STATUS_TEXT[view.status]}
          {view.status === "open" && (
            <>
              {" · "}
              <Countdown deadline={view.deadline} />
            </>
          )}
        </p>
        <p className="text-sm">Poster this month: <strong>{view.poster?.name ?? "---"}</strong></p>
      </header>

      <NamePicker volunteers={view.volunteers} me={me} onChange={setMe} />

      {incoming.length > 0 && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm">
          You have {incoming.length} pending swap request{incoming.length > 1 ? "s" : ""}:{" "}
          {incoming.map((s) => (
            <Link key={s.id} href={`/swap/${s.id}`} className="mr-2 underline">View</Link>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <p className="text-sm text-neutral-600">
          Waiting on {outgoing.length} request{outgoing.length > 1 ? "s" : ""} you sent:{" "}
          {outgoing.map((s) => (
            <Link key={s.id} href={`/swap/${s.id}`} className="mr-2 underline">View</Link>
          ))}
        </p>
      )}

      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {shareText && <SharePanel text={shareText} onClose={() => setShareText(null)} />}
      {renderPicker()}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-left">
          <thead>
            <tr className="border-b text-xs uppercase text-neutral-500">
              <th className="py-2">Date</th>
              <th>Laptop — Operator</th>
              <th>Laptop — Assist</th>
              <th>Photog</th>
            </tr>
          </thead>
          <tbody>
            {view.dates.map((d) => (
              <tr key={d.id} className="border-b align-top">
                <td className="py-3 font-medium">{shortDate(d.date)}</td>
                {SLOT_ROLES.map((r) => (
                  <td key={r} className="py-3 pr-2">{renderCell(d.slots[r])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {view.status === "published" && <ShareImageButton ym={ym(view.year, view.month)} title={monthLabel(view.year, view.month)} />}
    </main>
  );
}
```

- [ ] **Step 7: Replace `src/app/page.tsx`**

```tsx
import { connection } from "next/server";
import { PollView } from "./components/PollView";
import { getLatestMonthId, getMonthView } from "@/server/month-view";

export default async function Home() {
  await connection();
  const id = await getLatestMonthId();
  const view = id ? await getMonthView(id) : null;
  if (!view) {
    return <main className="mx-auto max-w-3xl px-4 py-12 text-center text-neutral-600">No schedule has been opened yet.</main>;
  }
  return <PollView view={view} />;
}
```

- [ ] **Step 8: Update the metadata in `src/app/layout.tsx`** (keep the scaffold's font setup)

```tsx
export const metadata: Metadata = {
  title: "Volunteer Schedule",
  description: "Pick your Sunday dates for the month.",
};
```

- [ ] **Step 9: Manual check**

Run `npm run dev`. In the organiser area (Task 18 is not built yet), create a month directly instead:
```bash
npx tsx -e "import('dotenv').then(d=>d.config({path:'.env.local'})).then(()=>import('./src/server/organiser')).then(m=>m.createMonth(2026,11)).then(r=>{console.log(r);process.exit(0)})"
```
Open http://localhost:3000, pick a name, claim a slot, refresh: the claim persists. Pick a name in a second browser profile and confirm "Request swap" appears on the first person's slot.

- [ ] **Step 10: Lint and commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/app
git commit -m "feat: add poll page with claims, swaps and share panel"
```

---

### Task 17: Swap page (`/swap/[id]`)

**Files:**
- Create: `src/app/swap/[id]/page.tsx`, `src/app/swap/[id]/SwapResponder.tsx`

- [ ] **Step 1: Create `src/app/swap/[id]/SwapResponder.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { respondSwapAction } from "@/app/actions/poll";
import { NamePicker } from "@/app/components/NamePicker";
import { useMe } from "@/app/components/use-me";
import { shortDate } from "@/lib/dates";
import { ROLE_SHORT } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";
import type { SwapDetail } from "@/server/swaps";

export function SwapResponder({ swap, volunteers }: { swap: SwapDetail; volunteers: VolunteerView[] }) {
  const [me, setMe] = useMe();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rs = `${shortDate(swap.requesterSlot.date)} ${ROLE_SHORT[swap.requesterSlot.role]}`;
  const ts = swap.targetSlot ? `${shortDate(swap.targetSlot.date)} ${ROLE_SHORT[swap.targetSlot.role]}` : null;

  const respond = (response: "accept" | "decline" | "cancel") =>
    start(async () => {
      setError(null);
      const r = await respondSwapAction(swap.id, me!, response);
      if (!r.ok) setError(r.error);
    });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Swap request</h1>
      <p>
        <strong>{swap.requester.name}</strong>{" "}
        {ts ? <>offers their <strong>{rs}</strong> for <strong>{swap.target.name}</strong>&apos;s <strong>{ts}</strong>.</> : <>asks <strong>{swap.target.name}</strong> to take their <strong>{rs}</strong>.</>}
      </p>
      <p className="text-sm">Status: <strong>{swap.status}</strong>{swap.reason ? ` — ${swap.reason}` : ""}</p>

      <NamePicker volunteers={volunteers} me={me} onChange={setMe} />

      {swap.status === "pending" && me === swap.target.id && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} className="rounded bg-black px-4 py-2 text-white" onClick={() => respond("accept")}>Accept</button>
          <button type="button" disabled={busy} className="rounded border px-4 py-2" onClick={() => respond("decline")}>Decline</button>
        </div>
      )}
      {swap.status === "pending" && me === swap.requester.id && (
        <button type="button" disabled={busy} className="self-start rounded border px-4 py-2" onClick={() => respond("cancel")}>Cancel request</button>
      )}
      {swap.status === "pending" && me !== null && me !== swap.target.id && me !== swap.requester.id && (
        <p className="text-sm text-neutral-600">Only {swap.target.name} can answer this request.</p>
      )}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Link href="/" className="text-sm underline">Back to the schedule</Link>
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/swap/[id]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isUuid } from "@/lib/ids";
import { listVolunteers } from "@/server/roster";
import { getSwapDetail } from "@/server/swaps";
import { SwapResponder } from "./SwapResponder";

export default async function SwapPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const swap = await getSwapDetail(id);
  if (!swap) notFound();
  const volunteers = (await listVolunteers()).filter((v) => v.active);
  return <SwapResponder swap={swap} volunteers={volunteers} />;
}
```

- [ ] **Step 3: Manual check**

With `npm run dev`: as volunteer A request a swap with B; open the shared link in another browser profile as B and accept; the poll page shows the swapped names. Open the link as a third person: only the "Only B can answer" note appears. Visit `/swap/not-a-uuid`: 404.

- [ ] **Step 4: Lint and commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/app/swap
git commit -m "feat: add swap request page"
```

---

### Task 18: Organiser page (`/organiser`)

**Files:**
- Create: `src/app/organiser/page.tsx`, `LoginForm.tsx`, `MonthPanel.tsx`, `RosterPanel.tsx`

- [ ] **Step 1: Create `src/app/organiser/LoginForm.tsx`**

```tsx
"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/organiser";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null });
  return (
    <main className="mx-auto flex max-w-xs flex-col gap-3 px-4 py-16">
      <h1 className="text-xl font-semibold">Organiser</h1>
      <form action={action} className="flex flex-col gap-3">
        <input name="pin" type="password" inputMode="numeric" autoComplete="off" pattern="\d{6}" required placeholder="6-digit PIN" className="rounded border px-3 py-2" />
        <button disabled={pending} className="rounded bg-black px-4 py-2 text-white">Unlock</button>
      </form>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </main>
  );
}
```

- [ ] **Step 2: Create `src/app/organiser/MonthPanel.tsx`**

```tsx
import { addDateAction, autofillAction, removeDateAction, setSlotAction, transitionAction, updateMonthAction } from "@/app/actions/organiser";
import { manilaInputValue, monthLabel, shortDate, ym } from "@/lib/dates";
import { ROLE_LABEL, SLOT_ROLES, THEMES } from "@/lib/roles";
import { volunteerSummary } from "@/lib/summary";
import type { MonthView } from "@/server/month-view";

const btn = "rounded border px-3 py-1 text-sm";

export function MonthPanel({ view }: { view: MonthView }) {
  const key = ym(view.year, view.month);
  const hidden = (
    <>
      <input type="hidden" name="monthId" value={view.id} />
      <input type="hidden" name="ym" value={key} />
    </>
  );
  const allSlots = view.dates.flatMap((d) => SLOT_ROLES.map((r) => d.slots[r]));
  const unfilled = allSlots.filter((s) => s.volunteerId === null && s.role !== "assist");
  const posters = view.volunteers.filter((v) => v.roles.includes("poster"));
  const op = (name: string, label: string) => (
    <form action={transitionAction}>
      {hidden}
      <input type="hidden" name="op" value={name} />
      <button className={btn}>{label}</button>
    </form>
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">{monthLabel(view.year, view.month)} — {view.status}</h2>

      <div className="flex flex-wrap gap-2">
        {view.status === "open" && op("lock", "Lock poll now")}
        {(view.status === "locked" || view.status === "draft") && (
          <form action={autofillAction}>{hidden}<button className={btn}>Auto-fill (draft)</button></form>
        )}
        {(view.status === "locked" || view.status === "draft") && op("publish", "Publish")}
        {(view.status === "locked" || view.status === "draft") && op("reopen", "Reopen poll")}
        {view.status === "published" && op("unpublish", "Unpublish")}
        <a className={btn} href={`/api/months/${key}/image`} target="_blank" rel="noreferrer">Preview image</a>
      </div>

      <form action={updateMonthAction} className="grid gap-2 sm:grid-cols-2">
        {hidden}
        <label className="flex flex-col text-sm">Deadline (Philippine time)
          <input type="datetime-local" name="deadline" defaultValue={manilaInputValue(view.deadline)} className="rounded border px-2 py-1" />
        </label>
        <label className="flex flex-col text-sm">Poster
          <select name="posterVolunteerId" defaultValue={view.poster?.id ?? ""} className="rounded border px-2 py-1">
            <option value="">---</option>
            {posters.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm">Image theme
          <select name="theme" defaultValue={view.theme} className="rounded border px-2 py-1">
            {THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-sm sm:col-span-2">Notes
          <textarea name="notes" defaultValue={view.notes} rows={2} className="rounded border px-2 py-1" />
        </label>
        <button className={`${btn} justify-self-start`}>Save settings</button>
      </form>

      {unfilled.length > 0 && (
        <p className="rounded bg-amber-50 p-2 text-sm">
          Empty: {unfilled.map((s) => `${shortDate(s.date)} ${ROLE_LABEL[s.role]}`).join(", ")}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-neutral-500">
              <th>Date</th>
              {SLOT_ROLES.map((r) => <th key={r}>{ROLE_LABEL[r]}</th>)}
              <th />
            </tr>
          </thead>
          <tbody>
            {view.dates.map((d) => (
              <tr key={d.id} className="border-t align-top">
                <td className="py-2 font-medium">{shortDate(d.date)}</td>
                {SLOT_ROLES.map((r) => {
                  const s = d.slots[r];
                  const options = view.volunteers.filter((v) => v.roles.includes(r) && (v.active || v.id === s.volunteerId));
                  return (
                    <td key={r} className="py-2 pr-2">
                      <form action={setSlotAction} className="flex gap-1">
                        {hidden}
                        <input type="hidden" name="slotId" value={s.id} />
                        <select name="volunteerId" defaultValue={s.volunteerId ?? ""} className={`rounded border px-1 py-1 ${s.source === "auto" ? "bg-sky-50" : ""}`}>
                          <option value="">---</option>
                          {options.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                        </select>
                        <button className="text-xs underline">Set</button>
                      </form>
                      {s.source === "auto" && <span className="text-xs text-sky-700">auto</span>}
                    </td>
                  );
                })}
                <td className="py-2">
                  <form action={removeDateAction}>
                    {hidden}
                    <input type="hidden" name="dateId" value={d.id} />
                    <button className="text-xs text-red-700 underline">Remove date</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form action={addDateAction} className="flex items-end gap-2">
        {hidden}
        <label className="flex flex-col text-sm">Add a date
          <input type="date" name="date" className="rounded border px-2 py-1" />
        </label>
        <button className={btn}>Add</button>
      </form>

      <details>
        <summary className="cursor-pointer text-sm">Who has what</summary>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {volunteerSummary(allSlots).map((line) => <li key={line}>{line}</li>)}
        </ul>
      </details>
    </section>
  );
}
```

- [ ] **Step 3: Create `src/app/organiser/RosterPanel.tsx`**

```tsx
import { addVolunteerAction, updateVolunteerAction } from "@/app/actions/organiser";
import { ROLE_LABEL, ROLES } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";

export function RosterPanel({ volunteers, ymKey }: { volunteers: VolunteerView[]; ymKey: string | null }) {
  const ymInput = ymKey ? <input type="hidden" name="ym" value={ymKey} /> : null;
  return (
    <section className="flex flex-col gap-3 rounded-lg border p-4">
      <h2 className="text-xl font-semibold">Roster</h2>
      {volunteers.map((v) => (
        <form key={v.id} action={updateVolunteerAction} className="flex flex-wrap items-center gap-3 border-t pt-2 text-sm">
          {ymInput}
          <input type="hidden" name="volunteerId" value={v.id} />
          <strong className="w-28">{v.name}</strong>
          <label><input type="checkbox" name="active" defaultChecked={v.active} /> active</label>
          {ROLES.map((r) => (
            <label key={r}><input type="checkbox" name="roles" value={r} defaultChecked={v.roles.includes(r)} /> {ROLE_LABEL[r]}</label>
          ))}
          <label>Poster order <input type="number" name="posterOrder" min={1} defaultValue={v.posterOrder ?? ""} className="w-16 rounded border px-1" /></label>
          <button className="rounded border px-2 py-1">Save</button>
        </form>
      ))}
      <form action={addVolunteerAction} className="flex flex-wrap items-center gap-3 border-t pt-3 text-sm">
        {ymInput}
        <input name="name" required placeholder="New volunteer name" className="rounded border px-2 py-1" />
        {ROLES.map((r) => (
          <label key={r}><input type="checkbox" name="roles" value={r} /> {ROLE_LABEL[r]}</label>
        ))}
        <label>Poster order <input type="number" name="posterOrder" min={1} className="w-16 rounded border px-1" /></label>
        <button className="rounded bg-black px-3 py-1 text-white">Add</button>
      </form>
    </section>
  );
}
```

- [ ] **Step 4: Create `src/app/organiser/page.tsx`**

```tsx
import Link from "next/link";
import { connection } from "next/server";
import { createMonthAction, logoutAction } from "@/app/actions/organiser";
import { isOrganiser } from "@/app/session";
import { monthLabel, parseYm, ym } from "@/lib/dates";
import { getMonthIdByYm, getMonthView, listMonths } from "@/server/month-view";
import { listVolunteers } from "@/server/roster";
import { LoginForm } from "./LoginForm";
import { MonthPanel } from "./MonthPanel";
import { RosterPanel } from "./RosterPanel";

export default async function OrganiserPage({ searchParams }: { searchParams: Promise<{ m?: string; msg?: string }> }) {
  await connection();
  if (!(await isOrganiser())) return <LoginForm />;

  const { m, msg } = await searchParams;
  const all = await listMonths();
  const picked = m ? parseYm(m) : null;
  const selectedId = picked ? await getMonthIdByYm(picked.year, picked.month) : (all[0]?.id ?? null);
  const view = selectedId ? await getMonthView(selectedId) : null;
  const volunteers = await listVolunteers();
  const nextMonth = new Date();
  nextMonth.setMonth(nextMonth.getMonth() + 1);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Organiser</h1>
        <form action={logoutAction}><button className="text-sm underline">Log out</button></form>
      </header>
      {msg && <p role="status" className="rounded bg-neutral-100 p-3 text-sm">{msg}</p>}

      <nav className="flex flex-wrap gap-2 text-sm">
        {all.map((row) => (
          <Link key={row.id} href={`/organiser?m=${ym(row.year, row.month)}`} className={`rounded border px-2 py-1 ${row.id === selectedId ? "bg-black text-white" : ""}`}>
            {monthLabel(row.year, row.month)}
          </Link>
        ))}
      </nav>

      <form action={createMonthAction} className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">Year<input name="year" type="number" defaultValue={nextMonth.getFullYear()} className="w-24 rounded border px-2 py-1" /></label>
        <label className="flex flex-col">Month<input name="month" type="number" min={1} max={12} defaultValue={nextMonth.getMonth() + 1} className="w-20 rounded border px-2 py-1" /></label>
        <button className="rounded bg-black px-3 py-1 text-white">Create month</button>
      </form>

      {view && <MonthPanel view={view} />}
      <RosterPanel volunteers={volunteers} ymKey={view ? ym(view.year, view.month) : null} />
    </main>
  );
}
```

- [ ] **Step 5: Manual check**

With `npm run dev` and `ORGANISER_PIN` set in `.env.local`:
1. Visit `/organiser`, enter a wrong PIN 5 times: the sixth attempt says "Too many attempts".
2. Clear the lockout (`delete from organiser_attempts` on the dev branch) and log in with the right PIN.
3. Create December 2026: four Sundays appear, deadline shows 27 Nov 23:59, poster is the next in the rotation.
4. Lock, Auto-fill: auto picks show a blue background; "Who has what" lists counts.
5. Change one slot by hand, Publish: `/` shows "Final schedule" and the share button.

- [ ] **Step 6: Lint and commit**

Run: `npm run lint && npx tsc --noEmit`

```bash
git add src/app/organiser
git commit -m "feat: add organiser page with month controls and roster"
```

---

### Task 19: Shareable schedule image

**Files:**
- Create: `assets/fonts/*`, `src/image/themes.ts`, `src/image/svg.ts`, `src/image/model.ts`, `src/image/fonts.ts`, `src/image/ScheduleImage.tsx`, `src/app/api/months/[ym]/image/route.tsx`
- Test: `tests/unit/image-model.test.ts`

- [ ] **Step 1: Download the fonts and their licences (all SIL Open Font License)**

```bash
mkdir -p assets/fonts
base=https://raw.githubusercontent.com/google/fonts/main/ofl
curl -fL -o assets/fonts/CinzelDecorative-Regular.ttf "$base/cinzeldecorative/CinzelDecorative-Regular.ttf"
curl -fL -o assets/fonts/CinzelDecorative-OFL.txt     "$base/cinzeldecorative/OFL.txt"
curl -fL -o assets/fonts/AbrilFatface-Regular.ttf     "$base/abrilfatface/AbrilFatface-Regular.ttf"
curl -fL -o assets/fonts/AbrilFatface-OFL.txt         "$base/abrilfatface/OFL.txt"
curl -fL -o assets/fonts/AmaticSC-Bold.ttf            "$base/amaticsc/AmaticSC-Bold.ttf"
curl -fL -o assets/fonts/AmaticSC-OFL.txt             "$base/amaticsc/OFL.txt"
file assets/fonts/*.ttf
```

Expected: each `.ttf` reports "TrueType Font data". If a URL returns 404, find the file on fonts.google.com (same family name) and keep the same local filename. These are starting choices; the user confirms the look in Step 9.

- [ ] **Step 2: Write the failing test for the image model**

`tests/unit/image-model.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildImageModel } from "@/image/model";

describe("buildImageModel", () => {
  it("formats days, upper-cases names and fills gaps with ---", () => {
    const model = buildImageModel({
      year: 2026,
      month: 11,
      theme: "teal",
      posterName: "Volunteer E",
      dates: [
        { date: "2026-11-01", laptop: "Volunteer A", assist: null, photog: "Volunteer B" },
        { date: "2026-11-08", laptop: null, assist: "Volunteer C", photog: "Volunteer D" },
      ],
    });
    expect(model).toEqual({
      monthName: "NOVEMBER",
      year: "2026",
      theme: "teal",
      poster: "VOLUNTEER E",
      rows: [
        { day: "01", operator: "VOLUNTEER A", assist: "---", photog: "VOLUNTEER B" },
        { day: "08", operator: "---", assist: "VOLUNTEER C", photog: "VOLUNTEER D" },
      ],
    });
  });

  it("shows --- when there is no poster", () => {
    expect(buildImageModel({ year: 2026, month: 12, theme: "peach", posterName: null, dates: [] }).poster).toBe("---");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/image-model.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 4: Create `src/image/model.ts`**

```ts
import { monthName } from "@/lib/dates";
import type { Theme } from "@/lib/roles";

export type ImageInput = {
  year: number;
  month: number;
  theme: Theme;
  posterName: string | null;
  dates: { date: string; laptop: string | null; assist: string | null; photog: string | null }[];
};

export type ImageRow = { day: string; operator: string; assist: string; photog: string };
export type ImageModel = { monthName: string; year: string; theme: Theme; poster: string; rows: ImageRow[] };

const tag = (name: string | null) => (name ? name.toUpperCase() : "---");

export function buildImageModel(input: ImageInput): ImageModel {
  return {
    monthName: monthName(input.month).toUpperCase(),
    year: String(input.year),
    theme: input.theme,
    poster: tag(input.posterName),
    rows: input.dates.map((d) => ({
      day: d.date.slice(8, 10),
      operator: tag(d.laptop),
      assist: tag(d.assist),
      photog: tag(d.photog),
    })),
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/image-model.test.ts`
Expected: PASS.

- [ ] **Step 6: Create `src/image/themes.ts`, `src/image/svg.ts` and `src/image/fonts.ts`**

`src/image/themes.ts`:

```ts
import type { Theme } from "@/lib/roles";

export type Palette = {
  background: string;
  title: string;
  titleShadow: string;
  wordmark: string;
  heading: string;
  tagText: string;
  bracket: string;
};

// Approximations of the existing Canva posters: teal/navy (Jun–Oct 2026) and peach/grey (Feb–May 2026).
export const PALETTES: Record<Theme, Palette> = {
  teal: {
    background: "linear-gradient(160deg, #57c3d0 0%, #9fb0b6 40%, #6b7a93 70%, #263661 100%)",
    title: "#111111",
    titleShadow: "rgba(0,0,0,0.25)",
    wordmark: "#124f50",
    heading: "#111111",
    tagText: "#14303f",
    bracket: "#ffffff",
  },
  peach: {
    background: "linear-gradient(160deg, #c48a5c 0%, #b4aea6 35%, #b5bcc0 60%, #f3eee4 100%)",
    title: "#f8f2e4",
    titleShadow: "rgba(60,50,40,0.45)",
    wordmark: "#c48a5c",
    heading: "#111111",
    tagText: "#4b4b4b",
    bracket: "#ffffff",
  },
};
```

`src/image/svg.ts`:

```ts
const dataUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;

/** Graph-paper scrap with a torn diagonal edge, drawn in code so no licensed asset is needed. */
export function tornCornerDataUri(): string {
  const W = 700;
  const H = 520;
  const edge: string[] = [];
  const steps = 40;
  for (let i = steps; i >= 0; i--) {
    const t = i / steps;
    const n = Math.sin(i * 12.9898) * 43758.5453; // deterministic jitter
    const off = (n - Math.floor(n) - 0.5) * 18;
    edge.push(`${(W * t + off).toFixed(1)},${(H * t - off).toFixed(1)}`);
  }
  const points = ["0,0", `${W},0`, ...edge].join(" ");
  const lines: string[] = [];
  for (let x = 0; x <= W; x += 24) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
  for (let y = 0; y <= H; y += 24) lines.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
      `<defs><clipPath id="c"><polygon points="${points}"/></clipPath></defs>` +
      `<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="#f5f5f3"/>` +
      `<g stroke="#2b2b2b" stroke-width="2">${lines.join("")}</g></g>` +
      `<polygon points="${points}" fill="none" stroke="#ffffff" stroke-width="10" stroke-linejoin="round"/></svg>`,
  );
}

/** Dotted bracket joining every row to the single Poster tag. */
export function bracketDataUri(height: number, color: string): string {
  const w = 190;
  const mid = height / 2;
  const gap = 80;
  return dataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${height}">` +
      `<path d="M0 3 H${w - 6} V${mid - gap} M${w - 6} ${mid + gap} V${height - 3} H0" fill="none" stroke="${color}" stroke-width="6" stroke-dasharray="6 8"/></svg>`,
  );
}
```

`src/image/fonts.ts`:

```ts
import { readFile } from "node:fs/promises";
import path from "node:path";

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

const dir = path.join(process.cwd(), "assets", "fonts");
let cached: Promise<Font[]> | null = null;

async function load(file: string, name: string, weight: 400 | 700): Promise<Font> {
  const buf = await readFile(path.join(dir, file));
  return { name, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight, style: "normal" };
}

export function loadFonts(): Promise<Font[]> {
  cached ??= Promise.all([
    load("CinzelDecorative-Regular.ttf", "Title", 400),
    load("AbrilFatface-Regular.ttf", "Wordmark", 400),
    load("AmaticSC-Bold.ttf", "Tag", 700),
  ]);
  return cached;
}
```

- [ ] **Step 7: Create `src/image/ScheduleImage.tsx`**

```tsx
/* eslint-disable @next/next/no-img-element -- rendered by next/og, not the browser */
import type { ReactNode } from "react";
import type { ImageModel } from "./model";
import { PALETTES } from "./themes";
import { bracketDataUri, tornCornerDataUri } from "./svg";

const W = 1500;
const H = 2000;
const ROWS_TOP = 1010;
const ROW_H = 170;
// [left, width] of each column; tags are centred inside.
const COL = {
  date: [80, 190],
  operator: [270, 270],
  assist: [540, 220],
  photog: [760, 360],
  poster: [1150, 330],
} as const;

function Tag({ text, color, size }: { text: string; color: string; size: number }) {
  return (
    <div style={{ display: "flex", background: "#fbf1f6", borderRadius: 24, padding: "10px 28px", fontFamily: "Tag", fontWeight: 700, fontSize: size, color }}>
      {text}
    </div>
  );
}

function Cell({ col, top, children }: { col: readonly [number, number]; top: number; children: ReactNode }) {
  return (
    <div style={{ position: "absolute", left: col[0], width: col[1], top, display: "flex", justifyContent: "center" }}>
      {children}
    </div>
  );
}

function Heading({ col, top, text, color, size = 64 }: { col: readonly [number, number]; top: number; text: string; color: string; size?: number }) {
  return (
    <Cell col={col} top={top}>
      <div style={{ display: "flex", fontFamily: "Title", fontSize: size, color, borderBottom: `3px solid ${color}`, paddingBottom: 2 }}>{text}</div>
    </Cell>
  );
}

export function ScheduleImage({ model }: { model: ImageModel }) {
  const p = PALETTES[model.theme];
  const titleSize = model.monthName.length >= 8 ? 180 : 220;
  const rowsHeight = Math.max(model.rows.length, 1) * ROW_H;
  const tilts = [-4, 3, -2, 4, -3, 2, -4, 3];

  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", backgroundImage: p.background }}>
      <img src={tornCornerDataUri()} width={700} height={520} alt="" style={{ position: "absolute", top: 0, right: 0 }} />

      <div style={{ position: "absolute", top: 110, left: 0, width: W, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", fontFamily: "Title", fontSize: titleSize, color: p.title, letterSpacing: 4, lineHeight: 1, textShadow: `6px 6px 0 ${p.titleShadow}` }}>
          {model.monthName}
        </div>
        <div style={{ display: "flex", fontFamily: "Title", fontSize: 220, color: p.title, lineHeight: 1, marginTop: 10, textShadow: `6px 6px 0 ${p.titleShadow}` }}>
          {model.year}
        </div>
        <div style={{ display: "flex", marginTop: 30 }}>
          {"Schedule".split("").map((ch, i) => (
            <div key={i} style={{ display: "flex", fontFamily: "Wordmark", fontSize: 120, color: p.wordmark, background: "rgba(240,240,242,0.92)", padding: "0 10px", marginLeft: -4, transform: `rotate(${tilts[i]}deg)` }}>
              {ch}
            </div>
          ))}
        </div>
      </div>

      <Heading col={COL.date} top={840} text="DATE" color={p.heading} />
      <Heading col={[COL.operator[0], COL.operator[1] + COL.assist[1]]} top={840} text="LAPTOP" color={p.heading} />
      <Heading col={COL.photog} top={840} text="PHOTOG" color={p.heading} />
      <Heading col={COL.poster} top={840} text="POSTER" color={p.heading} />
      <Cell col={COL.operator} top={930}><div style={{ display: "flex", fontFamily: "Tag", fontWeight: 700, fontSize: 40, color: p.heading }}>OPERATOR</div></Cell>
      <Cell col={COL.assist} top={930}><div style={{ display: "flex", fontFamily: "Tag", fontWeight: 700, fontSize: 40, color: p.heading }}>ASSIST</div></Cell>

      {model.rows.map((row, i) => {
        const top = ROWS_TOP + i * ROW_H + 30;
        return [
          <Cell key={`d${i}`} col={COL.date} top={top}><Tag text={row.day} color={p.tagText} size={72} /></Cell>,
          <Cell key={`o${i}`} col={COL.operator} top={top}><Tag text={row.operator} color={p.tagText} size={72} /></Cell>,
          <Cell key={`a${i}`} col={COL.assist} top={top + 8}><Tag text={row.assist} color={p.tagText} size={58} /></Cell>,
          <Cell key={`p${i}`} col={COL.photog} top={top}><Tag text={row.photog} color={p.tagText} size={72} /></Cell>,
        ];
      })}

      <img src={bracketDataUri(rowsHeight - 80, p.bracket)} width={190} height={rowsHeight - 80} alt="" style={{ position: "absolute", left: 1125, top: ROWS_TOP + 40 }} />
      <Cell col={COL.poster} top={ROWS_TOP + rowsHeight / 2 - 50}><Tag text={model.poster} color={p.tagText} size={68} /></Cell>
    </div>
  );
}
```

- [ ] **Step 8: Create `src/app/api/months/[ym]/image/route.tsx`**

```tsx
import { ImageResponse } from "next/og";
import { isOrganiser } from "@/app/session";
import { buildImageModel } from "@/image/model";
import { loadFonts } from "@/image/fonts";
import { ScheduleImage } from "@/image/ScheduleImage";
import { parseYm } from "@/lib/dates";
import { getMonthIdByYm, getMonthView } from "@/server/month-view";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ ym: string }> }) {
  const parsed = parseYm((await ctx.params).ym);
  if (!parsed) return new Response("Bad month", { status: 400 });
  const id = await getMonthIdByYm(parsed.year, parsed.month);
  const view = id ? await getMonthView(id) : null;
  // Drafts are visible to the organiser only, so the look can be checked before publishing.
  if (!view || (view.status !== "published" && !(await isOrganiser()))) {
    return new Response("Not published", { status: 404 });
  }

  const model = buildImageModel({
    year: view.year,
    month: view.month,
    theme: view.theme,
    posterName: view.poster?.name ?? null,
    dates: view.dates.map((d) => ({
      date: d.date,
      laptop: d.slots.laptop.volunteerName,
      assist: d.slots.assist.volunteerName,
      photog: d.slots.photog.volunteerName,
    })),
  });

  try {
    return new ImageResponse(<ScheduleImage model={model} />, {
      width: 1500,
      height: 2000,
      fonts: await loadFonts(),
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    console.error(e);
    return new Response("Failed to generate the image", { status: 500 });
  }
}
```

- [ ] **Step 9: Render both themes and a 4- and 5-Sunday month, then check with the user**

With `npm run dev`, logged in as organiser, open "Preview image" for November 2026 (5 Sundays) and December 2026 (4 Sundays), once with each theme. Save the PNGs and show them to the user next to `raw/emmtee/sched` samples. Adjust `COL`, font sizes or fonts only as the user asks. Check: no tag overlaps the bracket; 9-letter names fit; "---" shows for empty Assist.

- [ ] **Step 10: Run all unit tests, lint, build and commit**

Run: `npm test && npm run lint && npm run build`
Expected: all pass; build succeeds.

```bash
git add assets src/image src/app/api tests/unit/image-model.test.ts
git commit -m "feat: add shareable poster-style schedule image"
```

---

### Task 20: README, GitHub and Vercel deployment

**Files:**
- Create: `README.md` (replace the scaffold's)

- [ ] **Step 1: Write `README.md`**

````markdown
# emmtee-sched

A no-login monthly volunteer scheduler. Volunteers open one shared link, pick their name, claim Sundays for Laptop (operator or assist) and Photog, and swap dates by consent. The organiser locks the poll, auto-fills gaps, reviews a draft, publishes, and shares the result as a poster-style PNG.

## Stack

Next.js 16 · React 19 · Tailwind 4 · Drizzle ORM · Neon Postgres · Vercel

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill it in (Neon `dev` and `test` branch URLs, a 6-digit `ORGANISER_PIN`, and `SESSION_SECRET` from `openssl rand -base64 48`).
3. `npm run db:migrate && npm run db:migrate:test`
4. Put your roster in `local/roster.json` (gitignored) and run `npm run seed -- local/roster.json`.
5. `npm run dev`, then open `/organiser` to create the first month. For the first month, set the Poster by hand; later months follow the rotation.

## Tests

- `npm test`: unit tests (no database)
- `npm run test:int`: database tests against the Neon `test` branch (wipes it)

## Deploying

Set `DATABASE_URL` (Neon `main` branch), `ORGANISER_PIN` and `SESSION_SECRET` in Vercel. Run migrations against production before deploying a schema change:

```bash
DATABASE_URL="<production url>" npx drizzle-kit migrate
```

## Privacy

No accounts and no contact details. Volunteer names live only in the database and in the gitignored `local/` folder, never in this repository.

## Fonts

Cinzel Decorative, Abril Fatface and Amatic SC, under the SIL Open Font License (see `assets/fonts/*-OFL.txt`).
````

- [ ] **Step 2: Final verification**

Run: `npm test && npm run test:int && npm run lint && npm run build`
Expected: everything passes.

Then check that no real names or secrets are tracked:
```bash
git ls-files | grep -E '^local/|\.env($|\.local)' && echo "STOP" || echo "clean"
git grep -n -i -E 'postgres(ql)?://' -- . ':!README.md' ':!.env.example' && echo "STOP" || echo "clean"
```
Also grep for each real first name from `local/roster-notes.md` (do this locally; don't paste names into commit messages):
```bash
for n in $(jq -r '.volunteers[].name' local/roster.json); do git grep -n -i -w "$n" && echo "STOP: $n found"; done; echo done
```
Expected: `clean`, `clean`, then only `done`.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add README"
```

- [ ] **Step 4: Publish to GitHub (ask the user first; this makes the code public)**

```bash
gh repo create emmtee-sched --public --source . --push
```

- [ ] **Step 5: Deploy to Vercel (ask the user first)**

1. Import the GitHub repo in Vercel (or `vercel link`).
2. Add `DATABASE_URL` (Neon `main` branch, pooled), `ORGANISER_PIN`, `SESSION_SECRET` for Production. Don't reuse the dev values for the PIN or secret.
3. Run the production migration (README command), then seed production with `DATABASE_URL="<production url>" npm run seed -- local/roster.json`.
4. Deploy. On the live URL: log in at `/organiser`, create the month, set the Poster, and do the end-to-end check below.

- [ ] **Step 6: End-to-end check on production (spec §13 manual list)**

Create the month → claim from two phones → set the deadline a few minutes ahead and wait for it to pass → Auto-fill → edit a slot → Publish → "Share schedule image" on a phone opens the share sheet with the PNG → swap after publish → share again and confirm the image shows the swap.
