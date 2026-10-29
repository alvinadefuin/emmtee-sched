"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { pushToast, removeToast, toastDuration, type ToastAction, type ToastItem, type ToastKind } from "@/lib/toast-queue";

type ToastOptions = { action?: ToastAction; /** Reusing an id replaces that toast instead of stacking another. */ id?: string };
type Show = (message: string, options?: ToastOptions) => string;
export type ToastApi = { success: Show; error: Show; info: Show; dismiss: (id: string) => void };

const ToastContext = createContext<ToastApi | null>(null);

/** Pop-up messages for action results: `const toast = useToast(); toast.success("Saved.")`. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>.");
  return api;
}

const TONE: Record<ToastKind, string> = {
  success: "toast-success",
  error: "toast-error",
  info: "toast-info",
};

function Icon({ kind }: { kind: ToastKind }) {
  const common = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
  if (kind === "success")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12.5 2.7 2.7L16 9.8" />
      </svg>
    );
  if (kind === "error")
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5v5.5M12 16.5v.01" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: string) => void }) {
  // Time left before auto-dismiss; frozen while the pointer is over the toast or focus is inside it.
  const remaining = useRef(toastDuration(toast.kind));
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const paused = hovered || focused;

  useEffect(() => {
    if (paused) return;
    const started = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(1500, remaining.current - (Date.now() - started));
    };
  }, [paused, toast.id, onDismiss]);

  const { action } = toast;
  const runAction = () => {
    action?.onClick?.();
    onDismiss(toast.id);
  };

  return (
    <li
      className={`toast ${TONE[toast.kind]}`}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <span className="mt-3 flex-none">
        <Icon kind={toast.kind} />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 py-2.5">
        <p className="min-w-0 text-[0.9375rem] leading-snug font-semibold [overflow-wrap:anywhere]">{toast.message}</p>
        {action &&
          (action.href ? (
            <Link href={action.href} className="link toast-action -my-2 text-sm" onClick={runAction}>
              {action.label}
            </Link>
          ) : (
            <button type="button" className="link toast-action -my-2 text-sm" onClick={runAction}>
              {action.label}
            </button>
          ))}
      </div>
      <button type="button" aria-label="Dismiss" className="toast-close" onClick={() => onDismiss(toast.id)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </li>
  );
}

let counter = 0;

/**
 * Holds the toasts and renders them fixed to the bottom of the screen (bottom-centre on
 * phones, bottom-right from 640px). Screen readers hear each message once through two
 * live regions that are always in the page: polite for success/info, assertive (alert)
 * for errors. Toasts never take focus.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [spoken, setSpoken] = useState<{ status: ToastItem | null; alert: ToastItem | null }>({ status: null, alert: null });

  const dismiss = useCallback((id: string) => setToasts((list) => removeToast(list, id)), []);

  const api = useMemo<ToastApi>(() => {
    const show =
      (kind: ToastKind): Show =>
      (message, options = {}) => {
        const id = options.id ?? `t${++counter}`;
        // A fresh key per show, so a repeated message is announced again.
        const item: ToastItem = { id, kind, message, action: options.action };
        setToasts((list) => pushToast(list, item));
        setSpoken((s) => ({ ...s, [kind === "error" ? "alert" : "status"]: { ...item, id: `${id}-${++counter}` } }));
        return id;
      };
    return { success: show("success"), error: show("error"), info: show("info"), dismiss };
  }, [dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div role="status" aria-live="polite" className="sr-only">
        {spoken.status && <p key={spoken.status.id}>{spoken.status.message}</p>}
      </div>
      <div role="alert" aria-live="assertive" className="sr-only">
        {spoken.alert && <p key={spoken.alert.id}>{spoken.alert.message}</p>}
      </div>
      <section aria-label="Notifications" className="toast-viewport">
        {toasts.length > 0 && (
          <ol className="flex flex-col gap-2">
            {toasts.map((t) => (
              <Toast key={t.id} toast={t} onDismiss={dismiss} />
            ))}
          </ol>
        )}
      </section>
    </ToastContext.Provider>
  );
}
