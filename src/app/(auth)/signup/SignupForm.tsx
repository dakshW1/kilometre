'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { signup } from '../actions';
import { Field } from '../AuthShell';
import SubmitButton from '../SubmitButton';

export default function SignupForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(signup, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label="Your name" name="name" autoComplete="name" placeholder="Ravi Kumar" required />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      <Field label="Password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" minLength={6} required />
      {state?.error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{state.error}</p>}
      {state?.message && <p role="status" className="rounded-2xl bg-money-soft px-4 py-3 text-sm font-bold text-[#075C3B]">{state.message}</p>}
      <SubmitButton disabled={disabled}>Create account</SubmitButton>
      <p className="text-center text-sm font-semibold text-muted">
        Already riding with us? <Link href="/login" className="font-extrabold text-ink underline underline-offset-4">Log in</Link>
      </p>
    </form>
  );
}
