"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useToast } from "./Toaster";

type Phase = "idle" | "loading" | "ready" | "error";

/**
 * Entry card for the schedule image. Opens a modal preview (native <dialog>) that fetches
 * the PNG once, shows it, and offers Share (Web Share with the file), Download and Close.
 * `version` changes whenever the schedule does, so the image is never a stale copy.
 * `variant="button"` renders just the trigger (the organiser's "Preview image"), styled by `className`.
 */
export function ShareImageButton({
  ym,
  title,
  version,
  variant = "card",
  label = "Share schedule image",
  className = "btn text-sm",
}: {
  ym: string;
  title: string;
  version: string;
  variant?: "card" | "button";
  label?: string;
  className?: string;
}) {
  const toast = useToast();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempt, setAttempt] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [canShare, setCanShare] = useState(false);
  const fileName = `schedule-${ym}.png`;

  function openModal() {
    setPhase("loading");
    setOpen(true);
    dialogRef.current?.showModal();
  }

  function requestClose() {
    dialogRef.current?.close();
  }

  // Runs for both ✕/backdrop/Close and Esc: reset state and hand focus back.
  const onClosed = useCallback(() => {
    setOpen(false);
    setPhase("idle");
    setBlob(null);
    setUrl(null);
    triggerRef.current?.focus();
  }, []);

  // Fetch once per open (and per Retry); the object URL is revoked when it is replaced or the modal closes.
  useEffect(() => {
    if (!open) return;
    const ctl = new AbortController();
    let objectUrl: string | null = null;
    (async () => {
      try {
        const res = await fetch(`/api/months/${ym}/image?v=${encodeURIComponent(version)}`, { cache: "no-store", signal: ctl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const b = await res.blob();
        if (ctl.signal.aborted) return;
        objectUrl = URL.createObjectURL(b);
        const file = new File([b], fileName, { type: "image/png" });
        setCanShare(typeof navigator.canShare === "function" && navigator.canShare({ files: [file] }));
        setBlob(b);
        setUrl(objectUrl);
        setPhase("ready");
      } catch {
        if (!ctl.signal.aborted) setPhase("error");
      }
    })();
    return () => {
      ctl.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // `version` is read once at open time on purpose: the image must not change under the viewer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, attempt, ym, fileName]);

  // Lock background scroll while the modal is open.
  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      root.style.overflow = prev;
    };
  }, [open]);

  async function share() {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], fileName, { type: "image/png" })], title });
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      toast.error("Couldn't share the image. Try Download instead.");
    }
  }

  function download() {
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  return (
    <>
      {variant === "button" ? (
        <button ref={triggerRef} type="button" onClick={openModal} className={className} aria-haspopup="dialog">
          {label}
        </button>
      ) : (
        <div className="card flex flex-col gap-3 border-accent p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold tracking-tight">Share the schedule</p>
            <p className="text-sm text-muted">Preview the final schedule as an image to send to the group.</p>
          </div>
          <button ref={triggerRef} type="button" onClick={openModal} className="btn btn-primary w-full sm:w-auto" aria-haspopup="dialog">
            {label}
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="share-dialog"
        aria-labelledby={titleId}
        onClose={onClosed}
        onClick={(e) => {
          if (e.target === e.currentTarget) requestClose();
        }}
      >
        <div className="share-dialog-body">
          <div className="flex items-center justify-between gap-3">
            <h2 id={titleId} className="font-display text-xl font-semibold tracking-tight">{title}</h2>
            <button type="button" className="btn" aria-label="Close preview" onClick={requestClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>

          <div className="share-frame" aria-busy={phase === "loading"}>
            {phase === "loading" && <div className="share-skeleton" role="status" aria-label="Loading image" />}
            {phase === "error" && (
              <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
                <p className="text-danger-text">Couldn&apos;t create the image.</p>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setPhase("loading");
                    setAttempt((n) => n + 1);
                  }}
                >
                  Retry
                </button>
              </div>
            )}
            {phase === "ready" && url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Final schedule for ${title}`} className="size-full object-contain" />
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {canShare && (
              <button type="button" className="btn btn-primary flex-1" disabled={phase !== "ready"} onClick={share}>
                Share
              </button>
            )}
            <button type="button" className={`btn flex-1 ${canShare ? "" : "btn-primary"}`} disabled={phase !== "ready"} onClick={download}>
              Download
            </button>
            <button type="button" className="btn flex-1" onClick={requestClose}>
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
