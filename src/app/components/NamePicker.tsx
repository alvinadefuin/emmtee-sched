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
      <p className="flex flex-wrap items-center gap-x-2">
        <span>
          You are <strong>{current.name}</strong>.
        </span>
        <button type="button" className="link text-sm" onClick={() => onChange(null)}>
          Not you?
        </button>
      </p>
    );
  }
  return (
    <label className="flex flex-col gap-2">
      <span className="font-semibold">Who are you?</span>
      <select
        className="field sm:max-w-sm"
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
