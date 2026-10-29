export type ToastKind = "success" | "error" | "info";

/** A button or link shown in a toast, e.g. "View" or "Share". */
export type ToastAction = { label: string; href?: string; onClick?: () => void };

export type ToastItem = { id: string; kind: ToastKind; message: string; action?: ToastAction };

/** At most this many toasts are on screen; the oldest goes first. */
export const MAX_TOASTS = 3;

/** Adds `toast` as the newest (last) item. A toast with the same id is replaced and moved to the end. */
export function pushToast(list: readonly ToastItem[], toast: ToastItem, max = MAX_TOASTS): ToastItem[] {
  const next = [...list.filter((t) => t.id !== toast.id), toast];
  return next.slice(Math.max(0, next.length - max));
}

export const removeToast = (list: readonly ToastItem[], id: string): ToastItem[] => list.filter((t) => t.id !== id);

/** How long a toast stays up (ms) before it dismisses itself. Errors stay longer. */
export const toastDuration = (kind: ToastKind): number => (kind === "error" ? 8000 : 5000);
