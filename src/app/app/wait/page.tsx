import WaitTimer from '@/components/wait/WaitTimer';
import { dayStats, type EarningRow, type WaitRow } from '@/lib/calc';
import { isoDateIST } from '@/lib/dates';
import { defaultProfile, type Profile } from '@/lib/profile';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Wait timer · Kilometre' };

export default async function WaitPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const today = isoDateIST();
  const [p, e, w] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user!.id).maybeSingle(),
    supabase.from('earnings').select('*').eq('date', today),
    supabase.from('wait_logs').select('id, restaurant_name, zone, platform, started_at, ended_at, duration_min').order('started_at', { ascending: false }).limit(40),
  ]);
  const profile: Profile = { ...defaultProfile(user!.id), ...(p.data ?? {}) };
  const waits = (w.data ?? []) as WaitRow[];
  const stats = dayStats(today, (e.data ?? []) as EarningRow[], waits, profile);
  // With no orders yet today, fall back to a typical real wage so the cost estimate still means something.
  const rate = stats.trueHourly > 0 ? stats.trueHourly : 94;
  return <WaitTimer ratePerHour={rate} recent={waits} />;
}
