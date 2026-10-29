"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import { useToast } from "@/app/components/Toaster";

/**
 * Shows the `msg` an organiser action redirected with (`k=error` for errors) as a toast,
 * then removes `msg` and `k` from the address bar so a reload or live refresh does not show it again.
 */
export function OrganiserFlash() {
  const params = useSearchParams();
  const toast = useToast();
  // Guards against showing the same redirect twice (React runs effects twice in development).
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const msg = params.get("msg");
    if (!msg) {
      handled.current = null;
      return;
    }
    const current = params.toString();
    if (handled.current === current) return;
    handled.current = current;

    if (params.get("k") === "error") toast.error(msg);
    else toast.success(msg);

    const rest = new URLSearchParams(current);
    rest.delete("msg");
    rest.delete("k");
    const qs = rest.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, [params, toast]);

  return null;
}
