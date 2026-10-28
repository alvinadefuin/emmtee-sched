"use client";

import { useState } from "react";

export function SharePanel({ text, onClose }: { text: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm">
      <p className="mb-2 text-sm font-medium">Request sent. Send this to them on Messenger:</p>
      <textarea readOnly value={text} rows={4} className="w-full rounded border p-2 text-sm" />
      <div className="mt-2 flex gap-2">
        {canShare && (
          <button type="button" className="rounded bg-black px-3 py-2 text-sm text-white" onClick={() => navigator.share({ text }).catch(() => {})}>
            Share
          </button>
        )}
        <button
          type="button"
          className="rounded border px-3 py-2 text-sm"
          onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true), () => {})}
        >
          {copied ? "Copied" : "Copy"}
        </button>
        <button type="button" className="ml-auto text-sm underline" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
