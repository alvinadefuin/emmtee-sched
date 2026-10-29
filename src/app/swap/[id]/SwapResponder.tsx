"use client";

import Link from "next/link";
import { useTransition } from "react";
import { respondSwapAction } from "@/app/actions/poll";
import { NamePicker } from "@/app/components/NamePicker";
import { useToast } from "@/app/components/Toaster";
import { useMe } from "@/app/components/use-me";
import { shortDate } from "@/lib/dates";
import { ROLE_SHORT } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";
import type { SwapDetail } from "@/server/swaps";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-warn-soft text-warn-text",
  accepted: "bg-accent-soft text-accent-text",
};

export function SwapResponder({ swap, volunteers }: { swap: SwapDetail; volunteers: VolunteerView[] }) {
  const [me, setMe] = useMe();
  const toast = useToast();
  const [busy, start] = useTransition();
  const rs = `${shortDate(swap.requesterSlot.date)} ${ROLE_SHORT[swap.requesterSlot.role]}`;
  const ts = swap.targetSlot ? `${shortDate(swap.targetSlot.date)} ${ROLE_SHORT[swap.targetSlot.role]}` : null;

  const respond = (response: "accept" | "decline" | "cancel") =>
    start(async () => {
      const r = await respondSwapAction(swap.id, me!, response);
      if (!r.ok) toast.error(r.error);
      else if (response === "accept") toast.success("Swap accepted. The schedule is updated.", { action: { label: "View schedule", href: "/" } });
      else if (response === "decline") toast.success("Request declined.");
      else toast.success("Request cancelled.");
    });

  return (
    <main className="page-x page-bottom mx-auto flex w-full max-w-xl flex-col gap-5 pt-6 sm:pt-10">
      <div>
        <p className="eyebrow">{ts ? "Exchange" : "Hand over"}</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight">Swap request</h1>
      </div>

      <div className="card flex flex-col gap-4 p-4 sm:p-6">
        <p className="text-lg leading-relaxed">
          <strong>{swap.requester.name}</strong>{" "}
          {ts ? <>offers their <strong className="text-accent">{rs}</strong> for <strong>{swap.target.name}</strong>&apos;s <strong className="text-accent">{ts}</strong>.</> : <>asks <strong>{swap.target.name}</strong> to take their <strong className="text-accent">{rs}</strong>.</>}
        </p>
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Status:</span>
          <span className={`badge ${STATUS_TONE[swap.status] ?? "bg-raised text-fg"}`}>{swap.status}</span>
          {swap.reason ? <span className="text-muted">— {swap.reason}</span> : null}
        </p>
      </div>

      <div className="card p-4 sm:p-5">
        <NamePicker volunteers={volunteers} me={me} onChange={setMe} />
      </div>

      {swap.status === "pending" && me === swap.target.id && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={busy} className="btn btn-primary sm:min-w-32" onClick={() => respond("accept")}>Accept</button>
          <button type="button" disabled={busy} className="btn sm:min-w-32" onClick={() => respond("decline")}>Decline</button>
        </div>
      )}
      {swap.status === "pending" && me === swap.requester.id && (
        <button type="button" disabled={busy} className="btn sm:self-start" onClick={() => respond("cancel")}>Cancel request</button>
      )}
      {swap.status === "pending" && me !== null && me !== swap.target.id && me !== swap.requester.id && (
        <p className="text-sm text-muted">Only {swap.target.name} can answer this request.</p>
      )}
      <Link href="/" className="link self-start">Back to the schedule</Link>
    </main>
  );
}
