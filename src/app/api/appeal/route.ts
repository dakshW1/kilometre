import { NextResponse } from 'next/server';
import { z } from 'zod';
import { demoMode, generateJSON } from '@/lib/ai/gemini';
import { demoAppeal } from '@/lib/ai/demo';
import { APPEAL_SYSTEM, AppealJSONSchema, AppealSchema } from '@/lib/ai/schemas';
import { addDaysISO, isoDateIST, prettyDate } from '@/lib/dates';
import { platformById } from '@/lib/geo';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 60;
const LANG = { en: 'English', hi: 'Hindi (Devanagari script)', kn: 'Kannada (Kannada script)' } as const;
const ISSUES: Record<string, string> = {
  deactivated: 'Partner ID deactivated / blocked',
  payout_missing: 'Payout missing or lower than expected',
  incentive: 'Incentive not credited',
  false_complaint: 'False customer complaint against the rider',
  other: 'Other issue',
};
const Body = z.object({
  platform: z.string().max(20),
  issue_type: z.enum(['deactivated', 'payout_missing', 'incentive', 'false_complaint', 'other']),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(2),
  description: z.string().trim().max(2000),
  rating: z.string().max(10).optional(),
});

const fmt = (d: string) => prettyDate(d, { day: 'numeric', month: 'short', year: 'numeric' });

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Please log in again.' }, { status: 401 });
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Please pick the app and the issue.' }, { status: 400 });
  const b = body.data;

  const [{ data: profile }, { data: rows }] = await Promise.all([
    supabase.from('profiles').select('name, language').eq('id', user.id).maybeSingle(),
    supabase.from('earnings').select('date, time, kind, amount, incentive, tip').eq('platform', b.platform).order('date').order('time'),
  ]);

  // Evidence comes only from the rider's own log, so the letter can't cite anything invented.
  const all = rows ?? [];
  const orders = all.filter((r) => r.kind === 'order');
  const money = (xs: typeof orders) => Math.round(xs.reduce((s, r) => s + Number(r.amount) + Number(r.incentive) + Number(r.tip), 0));
  const days = [...new Set(all.map((r) => r.date))];
  const last = orders.at(-1);
  const since30 = addDaysISO(isoDateIST(), -30);
  const inRange = b.dates.length ? orders.filter((r) => r.date >= b.dates[0] && r.date <= (b.dates[1] ?? b.dates[0])) : [];
  const evidence = {
    total_orders: orders.length,
    active_days: days.length,
    first_logged: days[0] ? fmt(days[0]) : null,
    last_active: last ? `${fmt(last.date)}${last.time ? `, ${String(last.time).slice(0, 5)}` : ''}` : null,
    earned_last_30_days_inr: money(orders.filter((r) => r.date >= since30)),
    orders_on_issue_dates: b.dates.length ? inRange.length : null,
    earned_on_issue_dates_inr: b.dates.length ? money(inRange) : null,
    rating: b.rating?.trim() || null,
  };
  const platformName = platformById(b.platform)?.name ?? b.platform;
  const name = profile?.name || (user.user_metadata?.name as string) || '[YOUR NAME]';
  const language = LANG[(profile?.language as keyof typeof LANG) ?? 'en'] ?? 'English';

  try {
    const draft = demoMode
      ? demoAppeal({ platform: platformName, name, evidence })
      : await generateJSON({
        system: APPEAL_SYSTEM,
        prompt: JSON.stringify({
          platform: platformName,
          issue: ISSUES[b.issue_type],
          dates: b.dates.map(fmt),
          rider_name: name,
          rider_description: b.description || '(no description given)',
          evidence,
          summary_language: language,
        }, null, 2),
        jsonSchema: AppealJSONSchema,
        zod: AppealSchema,
      });
    return NextResponse.json({ draft, evidence, demo: demoMode });
  } catch (e) {
    console.error('[appeal]', e);
    return NextResponse.json({ error: 'The AI could not write the letter right now. Please try again.' }, { status: 502 });
  }
}
