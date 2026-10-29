import { afterAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
// Every run wipes the database's tables, so refuse anything that could be the app's own.
const safe = !!url && url !== process.env.DATABASE_URL;
if (!safe) {
  console.warn("Skipping integration tests: set TEST_DATABASE_URL to a test database that differs from DATABASE_URL.");
}

// Runs against the Neon `test` branch only. Every run wipes that branch's tables.
describe.skipIf(!safe)("swaps against the database", () => {
  let mod!: {
    db: typeof import("@/db").db;
    schema: typeof import("@/db/schema");
    swaps: typeof import("@/server/swaps");
    sql: typeof import("drizzle-orm").sql;
  };
  let ids!: { a: number; b: number; c: number; s1: number; s2: number; s3: number; d1: number };

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
    ids = { a: a.id, b: b.id, c: c.id, s1: s1.id, s2: s2.id, s3: s3.id, d1: dates[0].id };
  });

  afterAll(async () => {
    await mod?.db.$client.end();
  });

  const holder = async (slotId: number) => {
    const { db, schema } = mod;
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.slots).where(eq(schema.slots.id, slotId));
    return row.volunteerId;
  };

  const requestStatus = async (id: string) => {
    const { db, schema } = mod;
    const { eq } = await import("drizzle-orm");
    const [row] = await db.select().from(schema.swapRequests).where(eq(schema.swapRequests.id, id));
    return row.status;
  };

  it("hands a slot over when the target accepts", async () => {
    const created = await mod.swaps.createSwap({
      kind: "handover", requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.c, targetSlotId: null,
    });
    if (!created.ok) throw new Error(created.error);
    expect(await mod.swaps.acceptSwap(created.id, ids.c)).toEqual({ ok: true });
    expect(await holder(ids.s1)).toBe(ids.c);
    expect(await requestStatus(created.id)).toBe("accepted");
  });

  it("exchanges two roles on the same Sunday", async () => {
    const { db, schema } = mod;
    // B also serves as photographer on A's Sunday; A and B trade roles that day.
    await db.insert(schema.volunteerRoles).values([ids.a, ids.b].map((volunteerId) => ({ volunteerId, role: "photog" as const })));
    const [s4] = await db
      .insert(schema.slots)
      .values({ serviceDateId: ids.d1, role: "photog" as const, volunteerId: ids.b, source: "claimed" as const })
      .returning({ id: schema.slots.id });
    const created = await mod.swaps.createSwap({
      kind: "exchange", requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.b, targetSlotId: s4.id,
    });
    if (!created.ok) throw new Error(created.error);
    expect(await mod.swaps.acceptSwap(created.id, ids.b)).toEqual({ ok: true });
    expect(await holder(ids.s1)).toBe(ids.b);
    expect(await holder(s4.id)).toBe(ids.a);
  });

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
    const [winner, loser] = results[0].ok ? [r1.id, r2.id] : [r2.id, r1.id];
    expect(await requestStatus(winner)).toBe("accepted");
    expect(await requestStatus(loser)).toBe("cancelled");

    const holders = [await holder(ids.s1), await holder(ids.s2), await holder(ids.s3)];
    expect(new Set(holders).size).toBe(3); // nobody lost or duplicated
  });

  it("gives each request its own short code that resolves back to it", async () => {
    const { isShortCode } = await import("@/lib/short-code");
    const created = await Promise.all([
      mod.swaps.createSwap({ kind: "handover", requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.b, targetSlotId: null }),
      mod.swaps.createSwap({ kind: "handover", requesterId: ids.b, requesterSlotId: ids.s2, targetId: ids.c, targetSlotId: null }),
      mod.swaps.createSwap({ kind: "handover", requesterId: ids.c, requesterSlotId: ids.s3, targetId: ids.a, targetSlotId: null }),
    ]);
    const codes = created.map((r) => {
      if (!r.ok) throw new Error(r.error);
      expect(isShortCode(r.shortCode)).toBe(true);
      return r.shortCode;
    });
    expect(new Set(codes).size).toBe(codes.length);
    for (const r of created) {
      if (!r.ok) continue;
      expect(await mod.swaps.findSwapIdByCode(r.shortCode)).toBe(r.id);
      expect(await mod.swaps.findSwapIdByCode(r.shortCode.toLowerCase())).toBe(r.id);
    }
    expect(await mod.swaps.findSwapIdByCode("ZZZZZZZZ")).toBeNull();
    expect(await mod.swaps.findSwapIdByCode("not-a-code")).toBeNull();
  });

  it("retries with a new code when the generated one is taken", async () => {
    const first = await mod.swaps.createSwap(
      { kind: "handover", requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.b, targetSlotId: null },
      new Date(),
      () => "K7P2QX9M",
    );
    if (!first.ok) throw new Error(first.error);
    const codes = ["K7P2QX9M", "K7P2QX9M", "M9XQ2P7K"];
    const second = await mod.swaps.createSwap(
      { kind: "handover", requesterId: ids.b, requesterSlotId: ids.s2, targetId: ids.c, targetSlotId: null },
      new Date(),
      () => codes.shift()!,
    );
    if (!second.ok) throw new Error(second.error);
    expect(second.shortCode).toBe("M9XQ2P7K");
  });

  it("still reports a pending clash instead of retrying it", async () => {
    const input = { kind: "handover" as const, requesterId: ids.a, requesterSlotId: ids.s1, targetId: ids.b, targetSlotId: null };
    expect((await mod.swaps.createSwap(input)).ok).toBe(true);
    const again = await mod.swaps.createSwap(input);
    expect(again).toEqual({ ok: false, error: "There is already a pending swap for one of these slots." });
  });
});
