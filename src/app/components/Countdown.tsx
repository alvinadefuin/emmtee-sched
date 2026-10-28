"use client";

import { useEffect, useState } from "react";
import { formatCountdown, formatManila } from "@/lib/dates";

export function Countdown({ deadline }: { deadline: Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = deadline.getTime() - now;
  return (
    <span suppressHydrationWarning>
      {left > 0 ? `Closes in ${formatCountdown(left)} (${formatManila(deadline)})` : "Closed — waiting for the organiser"}
    </span>
  );
}
