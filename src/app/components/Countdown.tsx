"use client";

import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { countdownSummary, countdownUrgency, formatDeadline, splitCountdown, type Urgency } from "@/lib/countdown";

function subscribe(onTick: () => void) {
  const t = setInterval(onTick, 1000);
  return () => clearInterval(t);
}
// Whole seconds, so the snapshot is stable between renders within the same second.
const nowSecond = () => Math.floor(Date.now() / 1000) * 1000;
// No clock on the server: render a placeholder until mounted, avoiding hydration mismatches.
const serverNow = () => null;

const TONE: Record<Urgency, { digits: string; label: string | null }> = {
  normal: { digits: "text-accent", label: null },
  soon: { digits: "text-warn", label: "Under 24 hours" },
  final: { digits: "text-danger", label: "Final hour" },
  closed: { digits: "text-muted", label: null },
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Live poll countdown, computed from the stored UTC deadline so it is right in any device time zone. */
export function Countdown({ deadline }: { deadline: Date }) {
  const now = useSyncExternalStore(subscribe, nowSecond, serverNow);
  const router = useRouter();
  const left = now === null ? null : deadline.getTime() - now;
  const urgency = left === null ? "normal" : countdownUrgency(left);
  const closed = urgency === "closed";

  // At zero, ask the server for the closed state; retry once in case the device clock runs ahead.
  useEffect(() => {
    if (!closed) return;
    router.refresh();
    const retry = setTimeout(() => router.refresh(), 5000);
    return () => clearTimeout(retry);
  }, [closed, router]);

  if (closed) {
    return (
      <div className="rounded-2xl border border-line bg-raised p-4" role="status">
        <p className="font-semibold">Poll closed — waiting for the organiser</p>
        <p className="mt-1 text-sm text-muted">Updating the page…</p>
      </div>
    );
  }

  const parts = left === null ? null : splitCountdown(left);
  const segments: [string, number | undefined][] = [
    ["days", parts?.days],
    ["hrs", parts?.hours],
    ["min", parts?.minutes],
    ["sec", parts?.seconds],
  ];
  const tone = TONE[urgency];

  return (
    <div role="timer" aria-live="off" className="flex flex-col gap-2.5">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="eyebrow">Poll closes in</span>
        {tone.label && <span className={`eyebrow ${urgency === "final" ? "text-danger" : "text-warn"}`}>· {tone.label}</span>}
      </p>
      <div aria-hidden="true" className="grid max-w-sm grid-cols-4 gap-2">
        {segments.map(([unit, value]) => (
          <div key={unit} className="flex flex-col items-center rounded-xl border border-line bg-raised px-1 py-2">
            <span className={`tnum text-[1.75rem] leading-none font-bold sm:text-3xl ${tone.digits}`}>{value === undefined ? "--" : pad(value)}</span>
            <span className="eyebrow mt-1.5 text-[0.625rem]">{unit}</span>
          </div>
        ))}
      </div>
      <p className="sr-only">{left === null ? "Loading time left" : countdownSummary(left)}</p>
      <p className="text-sm text-muted">
        Closes <time dateTime={deadline.toISOString()}>{formatDeadline(deadline)}</time> (PH time)
      </p>
    </div>
  );
}
