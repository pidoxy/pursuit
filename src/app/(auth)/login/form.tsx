"use client";
import { useActionState } from "react";
import { login } from "../actions";
import { FormError, SubmitButton } from "@/components/submit";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormError error={state?.error} />
      <SubmitButton pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
