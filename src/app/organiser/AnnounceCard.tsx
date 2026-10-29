"use client";

import { useState } from "react";
import { useToast } from "@/app/components/Toaster";

/** The open poll's group chat announcement, ready to copy or share. */
export function AnnounceCard({ text }: { text: string }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  function copy() {
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast.success("Message copied. Paste it in the group chat.");
      },
      () => toast.error("Couldn't copy. Select the text and copy it instead."),
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent bg-bg p-4">
      <div>
        <p className="font-semibold">Announce to the group</p>
        <p className="text-sm text-muted">Send this in the group chat so everyone can start claiming.</p>
      </div>
      <textarea readOnly value={text} rows={5} className="field resize-y" aria-label="Announcement message" />
      <div className="flex flex-wrap gap-2">
        {canShare && (
          <button type="button" className="btn btn-primary" onClick={() => navigator.share({ text }).catch(() => {})}>
            Share
          </button>
        )}
        <button type="button" className={canShare ? "btn" : "btn btn-primary"} onClick={copy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
