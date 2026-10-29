"use client";

import { useState } from "react";

export function ShareImageButton({ ym, title }: { ym: string; title: string }) {
  const [error, setError] = useState<string | null>(null);

  async function share() {
    setError(null);
    const res = await fetch(`/api/months/${ym}/image`, { cache: "no-store" });
    if (!res.ok) {
      setError("Couldn't create the image. Try again.");
      return;
    }
    const blob = await res.blob();
    const file = new File([blob], `schedule-${ym}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title }).catch(() => {});
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button type="button" onClick={share} className="btn btn-primary w-full sm:w-auto">
        Share schedule image
      </button>
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </div>
  );
}
