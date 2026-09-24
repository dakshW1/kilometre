import Dashboard from '@/components/dashboard/Dashboard';
import type { EarningRow, WaitRow } from '@/lib/calc';
import { addDaysISO, isoDateIST } from '@/lib/dates';
import { createClient } from '@/lib/supabase/server';

export const metadata = { title: 'Home · Kilometre' };

export default async function AppHome() {
  const supabase = await createClient();
  const today = isoDateIST();
  const from = addDaysISO(today, -6);
  const [e, w] = await Promise.all([
    supabase.from('earnings').select('id, platform, date, time, order_id, kind, amount, incentive, tip, distance_km, login_hours, pickup, source').gte('date', from).order('date'),
    supabase.from('wait_logs').select('id, restaurant_name, zone, platform, started_at, ended_at, duration_min').gte('started_at', `${from}T00:00:00+05:30`).order('started_at'),
  ]);
  return <Dashboard today={today} earnings={(e.data ?? []) as EarningRow[]} waits={(w.data ?? []) as WaitRow[]} />;
}
