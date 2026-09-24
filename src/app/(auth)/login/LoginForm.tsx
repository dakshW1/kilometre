'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login } from '../actions';
import { Field } from '../AuthShell';
import SubmitButton from '../SubmitButton';

export default function LoginForm({ disabled, next }: { disabled: boolean; next: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
      <Field label="Password" name="password" type="password" autoComplete="current-password" required />
      {state?.error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{state.error}</p>}
      <SubmitButton disabled={disabled}>Log in</SubmitButton>
      <p className="text-center text-sm font-semibold text-muted">
        New here? <Link href="/signup" className="font-extrabold text-ink underline underline-offset-4">Create a free account</Link>
      </p>
    </form>
  );
}
