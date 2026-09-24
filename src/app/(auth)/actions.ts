'use server';

import { redirect } from 'next/navigation';
import { hasSupabase } from '@/lib/supabase/env';
import { createClient } from '@/lib/supabase/server';

export type AuthState = { error?: string; message?: string } | undefined;

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!hasSupabase) return { error: 'Supabase keys are missing. Add them to .env.local.' };
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!name) return { error: 'Please enter your name.' };
  if (password.length < 6) return { error: 'Password needs at least 6 characters.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  if (error) return { error: error.message };
  if (!data.session) return { message: 'Check your email to confirm your account, then log in.' };
  redirect('/onboarding');
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!hasSupabase) return { error: 'Supabase keys are missing. Add them to .env.local.' };
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/app');

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message === 'Invalid login credentials' ? 'Wrong email or password.' : error.message };
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/app');
}
