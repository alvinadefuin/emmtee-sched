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
