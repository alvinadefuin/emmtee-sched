"use client";

import { useState } from "react";

export function SharePanel({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="card border-accent p-4 sm:p-5">
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
