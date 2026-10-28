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
