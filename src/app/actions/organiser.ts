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
