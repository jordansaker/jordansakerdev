"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <label className="block mono text-[0.66rem] tracking-[0.12em] uppercase text-muted mb-2">
          Password
        </label>
        <input
          type="password"
          name="password"
          autoFocus
          autoComplete="current-password"
          className="w-full bg-bg-2 border border-line rounded-lg px-3 py-2.5 text-text outline-none focus:border-accent"
        />
      </div>
      {state?.error ? (
        <p className="text-red text-sm">{state.error}</p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-full bg-accent text-bg font-semibold text-sm py-2.5 hover:translate-y-[-1px] hover:shadow-[0_8px_22px_rgba(232,116,59,0.3)] transition disabled:opacity-50"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
