"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type CSSProperties } from "react";
import { claimAction, createSwapAction, releaseAction } from "@/app/actions/poll";
import { monthLabel, shortDate, ym } from "@/lib/dates";
import { canClaim, canSwap } from "@/lib/month-status";
import { isRequiredRole, ROLE_LABEL, ROLE_SHORT, SLOT_ROLES, type SlotRole } from "@/lib/roles";
import type { Result } from "@/lib/result";
import { swapMessage } from "@/lib/swap-message";
import type { MonthView, SlotView } from "@/server/month-view";
import { Countdown } from "./Countdown";
import { NamePicker } from "./NamePicker";
import { SharePanel } from "./SharePanel";
import { ShareImageButton } from "./ShareImageButton";
import { useToast } from "./Toaster";
import { useMe } from "./use-me";
import { useSwapNotices } from "./use-swap-notices";

type Picking = { mode: "exchange"; target: SlotView } | { mode: "handover"; mine: SlotView } | null;

const STATUS_TEXT = {
  open: "Open — pick your dates",
  locked: "Closed — waiting for the organiser",
  draft: "Being finalised by the organiser",
  published: "Final schedule",
} as const;

const STATUS_TONE = {
  open: "bg-accent-soft text-accent-text",
  locked: "bg-warn-soft text-warn-text",
  draft: "bg-peach-soft text-peach-text",
  published: "bg-accent text-on-accent",
} as const;

function Unfilled() {
  return (
    <span className="inline-flex min-h-11 items-center text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Nobody yet</span>
    </span>
  );
}

/** Marks an unclaimed slot: Operator and Photog are needed, Assist is optional. */
function NeedTag({ role }: { role: SlotRole }) {
  return isRequiredRole(role) ? (
    <span className="badge bg-warn-soft py-0.5 text-xs text-warn-text">Needed</span>
  ) : (
    <span className="text-xs text-muted">Optional</span>
  );
}

/** Scrolls a section into view below the sticky header (smoothly unless reduced motion is on), optionally moving focus to it. */
function revealSection(el: HTMLElement | null, focus = false) {
  if (!el) return;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  if (focus) el.focus({ preventScroll: true });
}

export function PollView({ view }: { view: MonthView }) {
  const [me, setMe] = useMe();
  const toast = useToast();
  const [picking, setPicking] = useState<Picking>(null);
  const [shareText, setShareText] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const pickerRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  useSwapNotices(view, me);

  // The picker opens above the dates; bring it into view when it was opened further down the page.
  useEffect(() => {
    if (picking) revealSection(pickerRef.current);
  }, [picking]);

  const meV = view.volunteers.find((v) => v.id === me) ?? null;
  const allSlots = view.dates.flatMap((d) => SLOT_ROLES.map((r) => d.slots[r]));
  const mySlots = allSlots.filter((s) => me !== null && s.volunteerId === me);
  const incoming = view.pendingSwaps.filter((s) => s.targetId === me);
  const outgoing = view.pendingSwaps.filter((s) => s.requesterId === me);
  const rolesOf = (id: number | null) => view.volunteers.find((v) => v.id === id)?.roles ?? [];

  function run(action: () => Promise<Result>, done: string) {
    startTransition(async () => {
      const r = await action();
      if (r.ok) toast.success(done);
      else toast.error(r.error);
    });
  }

  const slotText = (s: SlotView) => `${shortDate(s.date)} ${ROLE_SHORT[s.role]}`;

  function request(kind: "exchange" | "handover", mine: SlotView, target: { id: number; name: string }, theirs: SlotView | null) {
    if (!meV) return;
    startTransition(async () => {
      const r = await createSwapAction({
        kind,
        requesterId: meV.id,
        requesterSlotId: mine.id,
        targetId: target.id,
        targetSlotId: theirs?.id ?? null,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setPicking(null);
      setShareText(
        swapMessage({ kind, targetName: target.name, requesterSlot: mine, targetSlot: theirs, url: `${location.origin}/swap/${r.id}` }),
      );
      toast.success(`Request sent to ${target.name}. Send them the link so they can answer.`, {
        action: { label: "Share", onClick: () => revealSection(shareRef.current, true) },
      });
    });
  }

  function renderCell(slot: SlotView) {
    const eligible = !!meV && meV.roles.includes(slot.role);
    if (slot.volunteerId === null) {
      return canClaim(view.status) && eligible ? (
        <button type="button" disabled={busy} className="btn btn-dashed w-full" onClick={() => run(() => claimAction(slot.id, meV!.id), `You have the ${slotText(slot)}.`)}>
          <span aria-hidden="true">+</span> Claim
        </button>
      ) : (
        <Unfilled />
      );
    }
    const mine = slot.volunteerId === me;
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className={`chip text-sm ${mine ? "chip-mine" : ""}`}>
          {slot.volunteerName}
          {mine && <span className="text-xs font-bold">(you)</span>}
        </span>
        <div className="flex flex-wrap gap-x-4 text-sm">
          {mine && canClaim(view.status) && (
            <button type="button" disabled={busy} className="link" onClick={() => run(() => releaseAction(slot.id, meV!.id), `Released your ${slotText(slot)}.`)}>
              Release
            </button>
          )}
          {mine && canSwap(view.status) && (
            <button type="button" className="link" onClick={() => setPicking({ mode: "handover", mine: slot })}>
              Hand over
            </button>
          )}
          {!mine && meV && canSwap(view.status) && meV.roles.includes(slot.role) && (
            <button type="button" className="link" onClick={() => setPicking({ mode: "exchange", target: slot })}>
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
        <div ref={pickerRef} className="card scroll-mt-24 border-accent p-4 sm:p-5">
          <p className="mb-3 font-semibold">
            Swap for {t.volunteerName}&apos;s {shortDate(t.date)} {ROLE_SHORT[t.role]}. Offer one of your dates:
          </p>
          {offers.length === 0 && <p className="mb-2 text-sm text-muted">You have no dates they could take. Claim one first.</p>}
          <div className="flex flex-wrap gap-2">
            {offers.map((s) => (
              <button key={s.id} type="button" disabled={busy} className="btn" onClick={() => request("exchange", s, { id: t.volunteerId!, name: t.volunteerName! }, t)}>
                {shortDate(s.date)} {ROLE_SHORT[s.role]}
              </button>
            ))}
          </div>
          <button type="button" className="link mt-1 text-sm" onClick={() => setPicking(null)}>Cancel</button>
        </div>
      );
    }
    const m = picking.mine;
    const candidates = view.volunteers.filter((v) => v.active && v.id !== meV.id && v.roles.includes(m.role));
    return (
      <div ref={pickerRef} className="card scroll-mt-24 border-accent p-4 sm:p-5">
        <p className="mb-3 font-semibold">Who should take your {shortDate(m.date)} {ROLE_SHORT[m.role]}?</p>
        <div className="flex flex-wrap gap-2">
          {candidates.map((v) => (
            <button key={v.id} type="button" disabled={busy} className="btn" onClick={() => request("handover", m, v, null)}>
              {v.name}
            </button>
          ))}
        </div>
        <button type="button" className="link mt-1 text-sm" onClick={() => setPicking(null)}>Cancel</button>
      </div>
    );
  }

  const posterIsMe = view.poster !== null && view.poster.id === me;

  return (
    <main className="page-x page-bottom mx-auto flex w-full max-w-6xl flex-col gap-5 pt-6 sm:pt-10">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:items-end">
        <header className="flex min-w-0 flex-col gap-3">
          <p className="eyebrow">Sunday duties</p>
          <h1 className="font-display text-4xl leading-[1.05] font-semibold tracking-tight sm:text-5xl">{monthLabel(view.year, view.month)}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className={`badge ${STATUS_TONE[view.status]}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
              {STATUS_TEXT[view.status]}
            </span>
            <span className="text-sm text-muted">
              Poster this month: <strong className="text-fg">{view.poster?.name ?? "---"}</strong>
            </span>
          </div>
        </header>
        {view.status === "open" && (
          <div className="card p-4 sm:p-5">
            <Countdown deadline={view.deadline} />
          </div>
        )}
      </section>

      <div className="card p-4 sm:p-5">
        <NamePicker volunteers={view.volunteers} me={me} onChange={setMe} />
      </div>

      {incoming.length > 0 && (
        <div className="rounded-2xl border border-warn bg-warn-soft px-4 py-2 text-warn-text">
          <span className="font-semibold">
            You have {incoming.length} pending swap request{incoming.length > 1 ? "s" : ""}:
          </span>{" "}
          {incoming.map((s) => (
            <Link key={s.id} href={`/swap/${s.id}`} className="link mr-4 text-warn-text">View</Link>
          ))}
        </div>
      )}
      {outgoing.length > 0 && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-2 text-sm text-muted">
          Waiting on {outgoing.length} request{outgoing.length > 1 ? "s" : ""} you sent:{" "}
          {outgoing.map((s) => (
            <Link key={s.id} href={`/swap/${s.id}`} className="link mr-4">View</Link>
          ))}
        </p>
      )}

      {shareText && <SharePanel ref={shareRef} text={shareText} onClose={() => setShareText(null)} />}
      {renderPicker()}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {view.dates.map((d, i) => (
          <li key={d.id} className="card rise flex min-w-0 flex-col p-4 sm:p-5" style={{ "--i": i } as CSSProperties}>
            <div className="flex items-baseline justify-between gap-2 border-b border-line pb-3">
              <h2 className="font-display text-2xl font-semibold tracking-tight">{shortDate(d.date)}</h2>
              <span className="eyebrow">Sunday</span>
            </div>
            <dl className="flex flex-col divide-y divide-line">
              {SLOT_ROLES.map((r) => (
                <div key={r} className="flex flex-col gap-1 py-3">
                  <dt className="eyebrow flex flex-wrap items-center gap-2">
                    {ROLE_LABEL[r]}
                    {d.slots[r].volunteerId === null && <NeedTag role={r} />}
                  </dt>
                  <dd className="min-w-0">{renderCell(d.slots[r])}</dd>
                </div>
              ))}
              <div className="flex flex-col gap-1 pt-3">
                <dt className="eyebrow">{ROLE_LABEL.poster}</dt>
                <dd className="min-w-0">
                  {view.poster ? (
                    <span className={`chip text-sm ${posterIsMe ? "chip-mine" : ""}`}>
                      <span aria-hidden="true" className="size-2 rounded-full bg-peach" />
                      {view.poster.name}
                      {posterIsMe && <span className="text-xs font-bold">(you)</span>}
                    </span>
                  ) : (
                    <Unfilled />
                  )}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {view.status === "published" && <ShareImageButton ym={ym(view.year, view.month)} title={monthLabel(view.year, view.month)} />}
    </main>
  );
}
