'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { PLATFORMS, ZONES, type Platform } from '@/lib/geo';
import { isoDateIST } from '@/lib/dates';
import { buildSeed } from '@/lib/seed';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  return { supabase, user };
}

const OnboardingSchema = z.object({
  name: z.string().trim().min(1).max(60),
  language: z.enum(['en', 'hi', 'kn']),
  platforms: z.array(z.enum(PLATFORMS.map((p) => p.id) as [Platform, ...Platform[]])).min(1),
  vehicle: z.enum(['petrol', 'ev', 'ecycle']),
  fuel_cost_per_km: z.coerce.number().min(0).max(20),
  monthly_emi: z.coerce.number().min(0).max(100000),
  monthly_phone_data: z.coerce.number().min(0).max(10000),
  daily_target: z.coerce.number().min(100).max(20000),
  home_zone: z.enum(ZONES.map((z) => z.id) as [string, ...string[]]),
  seed_demo: z.boolean(),
});
export type OnboardingInput = z.infer<typeof OnboardingSchema>;

export async function completeOnboarding(input: OnboardingInput): Promise<{ error?: string }> {
  const parsed = OnboardingSchema.safeParse(input);
  if (!parsed.success) return { error: 'Please check the highlighted details.' };
  const { supabase, user } = await requireUser();
  const { seed_demo, ...profile } = parsed.data;
  const { error } = await supabase.from('profiles').upsert({ id: user.id, ...profile, onboarded: true });
  if (error) return { error: error.message };
  if (seed_demo) {
    const res = await insertSeed(supabase, user.id, profile.platforms);
    if (res.error) return res;
  }
  revalidatePath('/app', 'layout');
  redirect('/app');
}

type Supa = Awaited<ReturnType<typeof createClient>>;

async function insertSeed(supabase: Supa, userId: string, platforms: Platform[]) {
  await supabase.from('earnings').delete().eq('user_id', userId).eq('source', 'seed');
  await supabase.from('wait_logs').delete().eq('user_id', userId).eq('source', 'seed');
  const { earnings, waits } = buildSeed(userId, platforms, isoDateIST());
  const e = await supabase.from('earnings').insert(earnings);
  if (e.error) return { error: e.error.message };
  const w = await supabase.from('wait_logs').insert(waits);
  if (w.error) return { error: w.error.message };
  return {};
}

export async function seedDemoWeek(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from('profiles').select('platforms').eq('id', user.id).maybeSingle();
  const res = await insertSeed(supabase, user.id, (p?.platforms as Platform[]) ?? []);
  revalidatePath('/app', 'layout');
  return res;
}

export async function clearDemoData(): Promise<{ error?: string }> {
  const { supabase, user } = await requireUser();
  await supabase.from('earnings').delete().eq('user_id', user.id).eq('source', 'seed');
  await supabase.from('wait_logs').delete().eq('user_id', user.id).eq('source', 'seed');
  revalidatePath('/app', 'layout');
  return {};
}

const WaitSchema = z.object({
  restaurant_id: z.string().max(40).nullable(),
  restaurant_name: z.string().trim().min(1).max(80),
  zone: z.string().max(20).nullable(),
  platform: z.string().max(20).nullable(),
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
});

export async function saveWaitLog(input: z.infer<typeof WaitSchema>): Promise<{ error?: string; duplicate?: boolean }> {
  const parsed = WaitSchema.safeParse(input);
  if (!parsed.success) return { error: 'Invalid wait log.' };
  const w = parsed.data;
  const duration = (new Date(w.ended_at).getTime() - new Date(w.started_at).getTime()) / 60000;
  if (duration <= 0 || duration > 180) return { error: 'That wait looks too long. Please check the times.' };
  const { supabase, user } = await requireUser();

  // Same restaurant within 5 minutes of an existing log = the same wait.
  const from = new Date(new Date(w.started_at).getTime() - 5 * 60000).toISOString();
  const to = new Date(new Date(w.started_at).getTime() + 5 * 60000).toISOString();
  const { data: dup } = await supabase.from('wait_logs').select('id').eq('user_id', user.id)
    .eq('restaurant_name', w.restaurant_name).gte('started_at', from).lte('started_at', to).limit(1);
  if (dup?.length) return { duplicate: true };

  const { error } = await supabase.from('wait_logs').insert({
    user_id: user.id, ...w, duration_min: Math.round(duration * 10) / 10, source: 'timer',
  });
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return {};
}
