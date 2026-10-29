export const SLOT_ROLES = ["laptop", "assist", "photog"] as const;
export type SlotRole = (typeof SLOT_ROLES)[number];

export const ROLES = ["laptop", "assist", "photog", "poster"] as const;
export type Role = (typeof ROLES)[number];

export const isSlotRole = (role: Role): role is SlotRole => role !== "poster";

export const ROLE_LABEL: Record<Role, string> = {
  laptop: "Laptop — Operator",
  assist: "Laptop — Assist",
  photog: "Photog",
  poster: "Poster",
};

export const ROLE_SHORT: Record<SlotRole, string> = {
  laptop: "Laptop",
  assist: "Laptop Assist",
  photog: "Photog",
};

export const SLOT_SOURCES = ["claimed", "auto", "manual"] as const;
export type SlotSource = (typeof SLOT_SOURCES)[number];

export const SWAP_KINDS = ["exchange", "handover"] as const;
export type SwapKind = (typeof SWAP_KINDS)[number];

export const SWAP_STATUSES = ["pending", "accepted", "declined", "cancelled", "invalid"] as const;
export type SwapStatus = (typeof SWAP_STATUSES)[number];

export const MONTH_STATUSES = ["open", "locked", "draft", "published"] as const;
export type MonthStatus = (typeof MONTH_STATUSES)[number];

export const THEMES = ["teal", "peach"] as const;
export type Theme = (typeof THEMES)[number];

/** Roles that must never be blank on a published schedule. Laptop Assist is optional. */
export const REQUIRED_ROLES = ["laptop", "photog"] as const satisfies readonly SlotRole[];
export const isRequiredRole = (role: SlotRole): boolean => (REQUIRED_ROLES as readonly SlotRole[]).includes(role);
