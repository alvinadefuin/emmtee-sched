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
    <div>
      <button type="button" onClick={share} className="rounded bg-black px-4 py-2 text-white">
        Share schedule image
      </button>
      {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
    </div>
  );
}
