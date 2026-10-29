"use client";

import { useEffect } from "react";
import { shortDate } from "@/lib/dates";
import { ROLE_SHORT } from "@/lib/roles";
import { diffSwapNotices, parseSeenSwaps, type SeenSwaps, type SwapLite } from "@/lib/swap-notices";
import type { MonthView, SlotView } from "@/server/month-view";
import { useToast } from "./Toaster";

const key = (me: number) => `emmtee:seen-swaps:${me}`;
// Fallback when storage is blocked (private mode): remembered for this tab only.
const memory = new Map<number, SeenSwaps>();

function load(me: number): SeenSwaps | null {
  try {
    const stored = parseSeenSwaps(localStorage.getItem(key(me)));
    if (stored) return stored;
  } catch {
    // Storage blocked; fall through to memory.
  }
  return memory.get(me) ?? null;
}

function save(me: number, seen: SeenSwaps) {
  memory.set(me, seen);
  try {
    localStorage.setItem(key(me), JSON.stringify(seen));
  } catch {
    // Storage blocked; `memory` still holds it.
  }
}

/**
 * Toasts swap news for the volunteer chosen on this device as live refresh brings it in:
 * a new request addressed to them, or an answer to one they sent. What has been shown is
 * remembered per device, so a refresh or reload does not repeat it.
 */
export function useSwapNotices(view: MonthView, me: number | null) {
  const toast = useToast();

  useEffect(() => {
    if (me === null) return;
    const swaps: SwapLite[] = [
      ...view.pendingSwaps.map((s) => ({ ...s, status: "pending" as const })),
      ...view.resolvedSwaps,
    ];
    const { notices, seen } = diffSwapNotices(load(me), swaps, me);
    save(me, seen);
    if (notices.length === 0) return;

    const slots = new Map<number, SlotView>(
      view.dates.flatMap((d) => Object.values(d.slots)).map((s) => [s.id, s]),
    );
    const name = (id: number) => view.volunteers.find((v) => v.id === id)?.name ?? "Someone";
    const slot = (id: number | null) => {
      const s = id === null ? undefined : slots.get(id);
      return s ? `${shortDate(s.date)} ${ROLE_SHORT[s.role]}` : "a date";
    };
    const all = [...view.pendingSwaps, ...view.resolvedSwaps];

    for (const n of notices) {
      const s = all.find((x) => x.id === n.id);
      if (!s) continue;
      const viewAction = { label: "View", href: `/swap/${s.id}` };
      if (n.type === "incoming") {
        const text =
          s.kind === "exchange"
            ? `${name(s.requesterId)} wants to swap their ${slot(s.requesterSlotId)} for your ${slot(s.targetSlotId)}.`
            : `${name(s.requesterId)} asks you to take their ${slot(s.requesterSlotId)}.`;
        toast.info(text, { id: `swap-${s.id}`, action: viewAction });
      } else if (n.type === "accepted") {
        toast.success(`${name(s.targetId)} accepted your swap for ${slot(s.requesterSlotId)}.`, { id: `swap-${s.id}`, action: viewAction });
      } else {
        toast.info(`${name(s.targetId)} declined your swap for ${slot(s.requesterSlotId)}.`, { id: `swap-${s.id}`, action: viewAction });
      }
    }
  }, [view, me, toast]);
}
