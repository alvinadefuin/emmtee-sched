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
  // Sort before drawing so the same seed gives the same draft whatever the row order.
  const pool = [...volunteers].sort((a, b) => a.id - b.id);
  const rand = mulberry32(seed);
  const tieRank = new Map(
    pool
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
    const zeros = pool
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
      const pick = pool.filter((v) => canPlace(v, slot, minGap)).sort(byLoad(slot.role))[0];
      if (pick) {
        place(slot, pick);
        break;
      }
    }
  }

  // 3. Repair: the greedy steps can strand a slot whose only candidates are busy in
  //    another auto slot that day. Search for a chain of same-day moves that frees
  //    one (augmenting path); spacing is soft and is ignored here. A second pass may
  //    also leave an assist slot empty, since assist is never required.
  const fixed = (s: AutofillSlot) => s.source === "claimed" || s.source === "manual";
  const augment = (slot: AutofillSlot, seen: Set<number>, dropAssist: boolean): boolean => {
    const candidates = pool.filter((v) => v.roles.includes(slot.role) && !seen.has(v.id)).sort(byLoad(slot.role));
    for (const v of candidates) {
      seen.add(v.id);
      const current = slots.find((s) => s !== slot && s.date === slot.date && s.volunteerId === v.id);
      if (current && fixed(current)) continue;
      if (current && !augment(current, seen, dropAssist)) {
        if (!(dropAssist && current.role === "assist")) continue;
        current.volunteerId = null;
        current.source = null;
      }
      place(slot, v);
      return true;
    }
    return false;
  };
  for (const dropAssist of [false, true]) {
    for (const slot of slots) {
      if (slot.volunteerId === null && slot.role !== "assist") augment(slot, new Set(), dropAssist);
    }
  }

  const unfilled = slots.filter((s) => s.volunteerId === null && s.role !== "assist");
  return { slots, unfilled };
}

/** Ids of slots whose holder differs between `before` and `after` (matched by id), in `before` order. */
export function changedSlotIds(before: AutofillSlot[], after: AutofillSlot[]): number[] {
  const next = new Map(after.map((s) => [s.id, s.volunteerId]));
  return before.filter((s) => (next.get(s.id) ?? null) !== s.volunteerId).map((s) => s.id);
}

/** Largest value of a Postgres `integer`, the type of `months.autofill_seed`. */
const PG_INT_MAX = 2_147_483_647;

/** A fresh auto-fill seed in [0, PG_INT_MAX], so it can be stored as-is. */
export const randomSeed = (random: () => number = Math.random): number => Math.floor(random() * (PG_INT_MAX + 1));
