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
