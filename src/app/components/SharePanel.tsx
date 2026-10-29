"use client";

import { useState, type Ref } from "react";

export function SharePanel({ text, onClose, ref }: { text: string; onClose: () => void; ref?: Ref<HTMLDivElement> }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    // Focusable (not in the tab order) so the "Share" toast action can move focus here.
    <div ref={ref} tabIndex={-1} aria-label="Share the swap request" role="region" className="card scroll-mt-24 border-accent p-4 sm:p-5">
      <p className="mb-3 font-semibold">Request sent. Send this to them on Messenger:</p>
      <textarea readOnly value={text} rows={4} className="field resize-y" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {canShare && (
          <button type="button" className="btn btn-primary" onClick={() => navigator.share({ text }).catch(() => {})}>
            Share
          </button>
        )}
        <button
          type="button"
          className="btn"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="link ml-auto px-1 text-sm" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
