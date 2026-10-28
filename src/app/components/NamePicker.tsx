"use client";

import type { VolunteerView } from "@/server/roster";

export function NamePicker({
  volunteers,
  me,
  onChange,
}: {
  volunteers: VolunteerView[];
  me: number | null;
  onChange: (id: number | null) => void;
}) {
  const current = volunteers.find((v) => v.id === me);
  if (current) {
    return (
      <p className="text-sm">
        You are <strong>{current.name}</strong>.{" "}
        <button type="button" className="underline" onClick={() => onChange(null)}>
          Not you?
        </button>
      </p>
    );
  }
  return (
    <label className="flex flex-col gap-1 text-sm">
      Who are you?
      <select
        className="rounded border px-3 py-2 text-base"
        defaultValue=""
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">Pick your name…</option>
        {volunteers
          .filter((v) => v.active)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
      </select>
    </label>
  );
}
