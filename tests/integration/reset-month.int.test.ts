import { afterAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
// Every run wipes the database's tables, so refuse anything that could be the app's own.
const safe = !!url && url !== process.env.DATABASE_URL;
if (!safe) {
  console.warn("Skipping integration tests: set TEST_DATABASE_URL to a test database that differs from DATABASE_URL.");
}

describe.skipIf(!safe)("reset month against the database", () => {
  let mod!: {
    db: typeof import("@/db").db;
    schema: typeof import("@/db/schema");
    organiser: typeof import("@/server/organiser");
    sql: typeof import("drizzle-orm").sql;
    eq: typeof import("drizzle-orm").eq;
  };
  let ids!: { monthId: number; a: number; b: number; s1: number; s2: number; pending: string; accepted: string; declined: string };
  const deadline = new Date("2099-01-01T00:00:00Z");

  beforeEach(async () => {
    process.env.DATABASE_URL = url;
    const drizzle = await import("drizzle-orm");
    mod ??= {
      db: (await import("@/db")).db,
      schema: await import("@/db/schema"),
      organiser: await import("@/server/organiser"),
      sql: drizzle.sql,
      eq: drizzle.eq,
    };
    const { db, schema, sql } = mod;
    await db.execute(
      sql`truncate swap_requests, slots, service_dates, months, volunteer_roles, volunteers, organiser_attempts restart identity cascade`,
    );
    const [a, b] = await db
      .insert(schema.volunteers)
      .values([{ name: "Volunteer A" }, { name: "Volunteer B" }])
      .returning({ id: schema.volunteers.id });
    const [m] = await db
      .insert(schema.months)
      .values({ year: 2026, month: 11, deadline, status: "published", theme: "peach", notes: "Keep me", posterVolunteerId: a.id, autofillSeed: 42 })
      .returning({ id: schema.months.id });
    const dates = await db
      .insert(schema.serviceDates)
      .values(["2026-11-01", "2026-11-08"].map((date) => ({ monthId: m.id, date })))
      .returning({ id: schema.serviceDates.id });
    const [s1, s2, s3] = await db
      .insert(schema.slots)
      .values([
        { serviceDateId: dates[0].id, role: "laptop" as const, volunteerId: a.id, source: "claimed" as const },
        { serviceDateId: dates[1].id, role: "laptop" as const, volunteerId: b.id, source: "auto" as const },
        { serviceDateId: dates[1].id, role: "photog" as const, volunteerId: a.id, source: "manual" as const },
      ])
      .returning({ id: schema.slots.id });
    const [pending, accepted, declined] = await db
      .insert(schema.swapRequests)
      .values([
        { kind: "exchange" as const, requesterId: a.id, targetId: b.id, requesterSlotId: s1.id, targetSlotId: s2.id },
        { kind: "handover" as const, requesterId: a.id, targetId: b.id, requesterSlotId: s3.id, status: "accepted" as const, resolvedAt: new Date() },
        { kind: "handover" as const, requesterId: b.id, targetId: a.id, requesterSlotId: s2.id, status: "declined" as const, resolvedAt: new Date() },
      ])
      .returning({ id: schema.swapRequests.id });
    ids = { monthId: m.id, a: a.id, b: b.id, s1: s1.id, s2: s2.id, pending: pending.id, accepted: accepted.id, declined: declined.id };
  });

  afterAll(async () => {
    await mod?.db.$client.end();
  });

  it("clears names, cancels pending swaps, keeps history and the month's settings", async () => {
    const { db, schema, eq } = mod;
    const result = await mod.organiser.resetMonth(ids.monthId, new Date("2026-10-30T00:00:00Z"));
    expect(result).toEqual({ ok: true, message: "Month reset. The poll is open again." });

    const slotRows = await db.select().from(schema.slots);
    expect(slotRows).toHaveLength(3);
    expect(slotRows.every((s) => s.volunteerId === null && s.source === null)).toBe(true);

    const swapStatus = async (id: string) => (await db.select().from(schema.swapRequests).where(eq(schema.swapRequests.id, id)))[0];
    expect(await swapStatus(ids.pending)).toMatchObject({ status: "cancelled", reason: "The organiser reset the month." });
    expect((await swapStatus(ids.accepted)).status).toBe("accepted");
    expect((await swapStatus(ids.declined)).status).toBe("declined");

    const [m] = await db.select().from(schema.months).where(eq(schema.months.id, ids.monthId));
    expect(m).toMatchObject({ status: "open", autofillSeed: null, theme: "peach", notes: "Keep me", posterVolunteerId: ids.a });
    expect(m.deadline.getTime()).toBe(deadline.getTime());
    const dates = await db.select().from(schema.serviceDates);
    expect(dates.map((d) => d.date).sort()).toEqual(["2026-11-01", "2026-11-08"]);
  });

  it("says the poll stays locked when the deadline has passed", async () => {
    const result = await mod.organiser.resetMonth(ids.monthId, new Date("2099-06-01T00:00:00Z"));
    expect(result).toEqual({ ok: true, message: "Month reset. Move the deadline later to reopen the poll." });
  });

  it("reports a missing month", async () => {
    expect(await mod.organiser.resetMonth(999999)).toMatchObject({ ok: false });
  });
});
