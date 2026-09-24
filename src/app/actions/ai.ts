'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { classify, type ExistingOrder } from '@/lib/dedup';
import { PLATFORM_IDS } from '@/lib/ai/schemas';
import { createClient } from '@/lib/supabase/server';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please log in again.');
  return { supabase, user };
}

const Money = z.coerce.number().min(0).max(100000);
const OrderIn = z.object({
  order_id: z.string().max(40).nullable(),
  time: z.string().regex(/^\d{1,2}:\d{2}$/).nullable(),
  amount: Money,
  incentive: Money.nullable(),
  tip: Money.nullable(),
  distance_km: z.coerce.number().min(0).max(500).nullable(),
  pickup: z.string().max(80).nullable(),
  confidence: z.number().nullable(),
  mergeInto: z.string().uuid().nullable(), // "Merge" chosen for a possible duplicate
});

const ImportIn = z.object({
  sha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  platform: z.enum(PLATFORM_IDS).refine((p) => p !== 'unknown', 'Pick the app this screenshot is from.'),
  kind: z.enum(['order', 'daily_summary']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.enum(['screenshot', 'voice', 'manual']),
  orders: z.array(OrderIn).max(80),
  summary: z.object({ amount: Money, incentive: Money, tip: Money, distance_km: z.coerce.number().min(0).nullable(), login_hours: z.coerce.number().min(0).max(24).nullable() }).nullable(),
});
export type ImportInput = z.infer<typeof ImportIn>;

export async function commitImport(input: ImportInput): Promise<{ error?: string; added?: number; merged?: number; skipped?: number; total?: number }> {
  const parsed = ImportIn.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Please check the highlighted fields.' };
  const x = parsed.data;
  const { supabase, user } = await requireUser();

  let screenshotId: string | null = null;
  if (x.sha256) {
    const { data, error } = await supabase.from('screenshots')
      .insert({ user_id: user.id, sha256: x.sha256, platform: x.platform, kind: x.kind }).select('id').single();
    if (error) return { error: error.code === '23505' ? 'This screenshot was already imported.' : error.message };
    screenshotId = data.id;
  }

  const { data: existing } = await supabase.from('earnings')
    .select('id, platform, date, time, order_id, amount, source').eq('platform', x.platform).eq('date', x.date).eq('kind', 'order');
  const pool = [...((existing ?? []) as ExistingOrder[])];
  let added = 0, merged = 0, skipped = 0, total = 0;
  const inserts: Record<string, unknown>[] = [];

  for (const o of x.orders) {
    const money = o.amount + (o.incentive ?? 0) + (o.tip ?? 0);
    if (o.mergeInto) {
      // Keep the record with more detail: the screenshot fills in what the manual log lacked.
      const { error } = await supabase.from('earnings').update({
        ...(o.order_id ? { order_id: o.order_id } : {}),
        ...(o.time ? { time: o.time } : {}),
        ...(o.distance_km !== null ? { distance_km: o.distance_km } : {}),
        amount: o.amount, incentive: o.incentive ?? 0, tip: o.tip ?? 0, source: x.source, screenshot_id: screenshotId,
      }).eq('id', o.mergeInto);
      if (!error) { merged++; total += money; }
      continue;
    }
    // Re-check on the server: never trust the client's dedup alone.
    const r = classify({ order_id: o.order_id, time: o.time, amount: o.amount }, x.platform, x.date, pool);
    if (r.status === 'duplicate') { skipped++; continue; }
    const row = {
      user_id: user.id, platform: x.platform, date: x.date, time: o.time, order_id: o.order_id, kind: 'order',
      amount: o.amount, incentive: o.incentive ?? 0, tip: o.tip ?? 0, distance_km: o.distance_km, pickup: o.pickup,
      source: x.source, screenshot_id: screenshotId, confidence: o.confidence,
    };
    inserts.push(row);
    pool.push({ id: `pending-${inserts.length}`, platform: x.platform, date: x.date, time: o.time, order_id: o.order_id, amount: o.amount, source: x.source });
    added++; total += money;
  }
  if (inserts.length) {
    const { error } = await supabase.from('earnings').insert(inserts);
    if (error) return { error: error.message };
  }

  if (x.summary) {
    // One summary per app per day: a newer summary screenshot replaces the older one.
    await supabase.from('earnings').delete().eq('platform', x.platform).eq('date', x.date).eq('kind', 'daily_summary');
    const { error } = await supabase.from('earnings').insert({
      user_id: user.id, platform: x.platform, date: x.date, kind: 'daily_summary', amount: x.summary.amount,
      incentive: x.summary.incentive, tip: x.summary.tip, distance_km: x.summary.distance_km, login_hours: x.summary.login_hours,
      source: x.source, screenshot_id: screenshotId,
    });
    if (error) return { error: error.message };
    added++; total = x.summary.amount + x.summary.incentive + x.summary.tip;
  }

  revalidatePath('/app', 'layout');
  return { added, merged, skipped, total };
}

const WaitsIn = z.array(z.object({
  restaurant_name: z.string().trim().min(1).max(80),
  platform: z.string().max(20).nullable(),
  duration_min: z.coerce.number().min(0.5).max(180),
})).max(20);

export async function commitWaits(waits: z.infer<typeof WaitsIn>): Promise<{ error?: string; added?: number }> {
  const parsed = WaitsIn.safeParse(waits);
  if (!parsed.success) return { error: 'Please check the wait entries.' };
  const { supabase, user } = await requireUser();
  const now = Date.now();
  const rows = parsed.data.map((w) => ({
    user_id: user.id, restaurant_name: w.restaurant_name, platform: w.platform, duration_min: w.duration_min,
    started_at: new Date(now - w.duration_min * 60000).toISOString(), ended_at: new Date(now).toISOString(), source: 'voice',
  }));
  if (!rows.length) return { added: 0 };
  const { error } = await supabase.from('wait_logs').insert(rows);
  if (error) return { error: error.message };
  revalidatePath('/app', 'layout');
  return { added: rows.length };
}

const AppealIn = z.object({
  platform: z.string().max(20),
  issue_type: z.string().max(40),
  dates: z.array(z.string().max(20)).max(4),
  description: z.string().max(2000),
  letter_en: z.string().max(6000),
  summary_local: z.string().max(1000).nullable(),
});

export async function saveAppeal(input: z.infer<typeof AppealIn>): Promise<{ error?: string }> {
  const parsed = AppealIn.safeParse(input);
  if (!parsed.success) return { error: 'Could not save the appeal.' };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('appeals').insert({ user_id: user.id, ...parsed.data });
  if (error) return { error: error.message };
  revalidatePath('/app/appeal');
  return {};
}
