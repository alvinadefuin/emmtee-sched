"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/organiser";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null });
  return (
    <main className="page-x page-bottom mx-auto flex w-full max-w-sm flex-col pt-12 sm:pt-20">
      <div className="card flex flex-col gap-4 p-5 sm:p-6">
        <div>
          <p className="eyebrow">Behind the PIN</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Organiser</h1>
        </div>
        <form action={action} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            PIN
            <input name="pin" type="password" inputMode="numeric" autoComplete="off" pattern="\d{6}" required placeholder="6-digit PIN" className="field tnum tracking-[0.3em]" />
          </label>
          <button disabled={pending} className="btn btn-primary">Unlock</button>
        </form>
        {state.error && <p role="alert" className="rounded-xl border border-danger bg-danger-soft p-3 text-sm text-danger-text">{state.error}</p>}
      </div>
    </main>
  );
}
