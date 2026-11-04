"use client";
import { useActionState, useEffect, useState } from "react";
import { signup } from "../actions";
import { FormError, SubmitButton } from "@/components/submit";

export function SignupForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signup, undefined);
  const [tz, setTz] = useState("UTC");
  useEffect(() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"), []);
  return (
    <form action={action} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <input type="hidden" name="timezone" value={tz} />
      <div>
        <label className="label" htmlFor="name">Your name</label>
        <input className="field" id="name" name="name" autoComplete="name" placeholder="Ada Okafor" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="field" id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="mt-1.5 text-xs text-muted">At least 8 characters.</p>
      </div>
      <FormError error={state?.error} />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
