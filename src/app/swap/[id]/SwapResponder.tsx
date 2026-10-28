"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { respondSwapAction } from "@/app/actions/poll";
import { NamePicker } from "@/app/components/NamePicker";
import { useMe } from "@/app/components/use-me";
import { shortDate } from "@/lib/dates";
import { ROLE_SHORT } from "@/lib/roles";
import type { VolunteerView } from "@/server/roster";
import type { SwapDetail } from "@/server/swaps";

export function SwapResponder({ swap, volunteers }: { swap: SwapDetail; volunteers: VolunteerView[] }) {
  const [me, setMe] = useMe();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const rs = `${shortDate(swap.requesterSlot.date)} ${ROLE_SHORT[swap.requesterSlot.role]}`;
  const ts = swap.targetSlot ? `${shortDate(swap.targetSlot.date)} ${ROLE_SHORT[swap.targetSlot.role]}` : null;

  const respond = (response: "accept" | "decline" | "cancel") =>
    start(async () => {
      setError(null);
      const r = await respondSwapAction(swap.id, me!, response);
      if (!r.ok) setError(r.error);
    });

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-8">
      <h1 className="text-2xl font-semibold">Swap request</h1>
      <p>
        <strong>{swap.requester.name}</strong>{" "}
        {ts ? <>offers their <strong>{rs}</strong> for <strong>{swap.target.name}</strong>&apos;s <strong>{ts}</strong>.</> : <>asks <strong>{swap.target.name}</strong> to take their <strong>{rs}</strong>.</>}
      </p>
      <p className="text-sm">Status: <strong>{swap.status}</strong>{swap.reason ? ` — ${swap.reason}` : ""}</p>

      <NamePicker volunteers={volunteers} me={me} onChange={setMe} />

      {swap.status === "pending" && me === swap.target.id && (
        <div className="flex gap-2">
          <button type="button" disabled={busy} className="rounded bg-black px-4 py-2 text-white" onClick={() => respond("accept")}>Accept</button>
          <button type="button" disabled={busy} className="rounded border px-4 py-2" onClick={() => respond("decline")}>Decline</button>
        </div>
      )}
      {swap.status === "pending" && me === swap.requester.id && (
        <button type="button" disabled={busy} className="self-start rounded border px-4 py-2" onClick={() => respond("cancel")}>Cancel request</button>
      )}
      {swap.status === "pending" && me !== null && me !== swap.target.id && me !== swap.requester.id && (
        <p className="text-sm text-neutral-600">Only {swap.target.name} can answer this request.</p>
      )}
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <Link href="/" className="text-sm underline">Back to the schedule</Link>
    </main>
  );
}
