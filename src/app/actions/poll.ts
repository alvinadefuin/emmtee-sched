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
