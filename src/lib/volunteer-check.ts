/** Why this volunteer cannot take part, or null if they can. `who` picks the wording. */
export function volunteerError(v: { active: boolean } | undefined, who: "you" | "them"): string | null {
  if (!v) return who === "you" ? "We couldn't find you on the roster. Pick your name again." : "We couldn't find that person on the roster.";
  if (!v.active) return who === "you" ? "You are no longer on the active roster." : "That person is no longer on the active roster.";
  return null;
}
