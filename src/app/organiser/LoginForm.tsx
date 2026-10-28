"use client";

import { useActionState } from "react";
import { loginAction } from "@/app/actions/organiser";

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, { error: null });
  return (
    <main className="mx-auto flex max-w-xs flex-col gap-3 px-4 py-16">
      <h1 className="text-xl font-semibold">Organiser</h1>
      <form action={action} className="flex flex-col gap-3">
        <input name="pin" type="password" inputMode="numeric" autoComplete="off" pattern="\d{6}" required placeholder="6-digit PIN" className="rounded border px-3 py-2" />
        <button disabled={pending} className="rounded bg-black px-4 py-2 text-white">Unlock</button>
      </form>
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
    </main>
  );
}
