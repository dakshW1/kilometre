import type { Profile } from './profile';

export interface EarningRow {
  id?: string;
  platform: string;
  date: string;
  time: string | null;
  order_id: string | null;
  kind: 'order' | 'daily_summary';
  amount: number;
  incentive: number;
  tip: number;
  distance_km: number | null;
  login_hours: number | null;
  pickup?: string | null;
  source?: string;
}

export interface WaitRow {
  id?: string;
  restaurant_name: string;
  zone: string | null;
  platform: string | null;
  started_at: string;
  ended_at: string;
  duration_min: number;
}

// Average time on an order or ride, used for the "what the apps show" rate when no active time is known.
export const ACTIVE_MIN_PER_ORDER = 31;
const AVG_ORDER_VALUE = 45;
export const WORKING_DAYS_PER_MONTH = 26;

const toMin = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
};

export interface PlatformDay { platform: string; gross: number; orders: number; distance: number }

export interface DayStats {
  date: string;
  gross: number;
  fuel: number;
  fixed: number;
  net: number;
  orders: number;
  distance: number;
  activeHours: number;
  totalHours: number;
  shownHourly: number;
  trueHourly: number;
  waitMin: number;
  waitCost: number;
  worstWait: WaitRow | null;
  byPlatform: PlatformDay[];
}

// One day's real earnings. Daily-summary screenshots win over individual orders for totals,
// so the same money is never counted twice.
export function dayStats(date: string, earnings: EarningRow[], waits: WaitRow[], p: Profile): DayStats {
  const rows = earnings.filter((e) => e.date === date);
  const platforms = [...new Set(rows.map((r) => r.platform))];
  let loginHours = 0;
  const byPlatform: PlatformDay[] = platforms.map((platform) => {
    const orders = rows.filter((r) => r.platform === platform && r.kind === 'order');
    const summaries = rows.filter((r) => r.platform === platform && r.kind === 'daily_summary');
    const sum = (xs: EarningRow[], f: (r: EarningRow) => number) => xs.reduce((s, r) => s + f(r), 0);
    loginHours += sum(summaries, (r) => Number(r.login_hours ?? 0));
    if (summaries.length) {
      const gross = sum(summaries, (r) => Number(r.amount) + Number(r.incentive) + Number(r.tip));
      const dist = sum(summaries, (r) => Number(r.distance_km ?? 0)) || sum(orders, (r) => Number(r.distance_km ?? 0));
      return { platform, gross, orders: Math.max(orders.length, Math.round(gross / AVG_ORDER_VALUE)), distance: dist };
    }
    return {
      platform,
      gross: sum(orders, (r) => Number(r.amount) + Number(r.incentive) + Number(r.tip)),
      orders: orders.length,
      distance: sum(orders, (r) => Number(r.distance_km ?? 0)),
    };
  }).sort((a, b) => b.gross - a.gross);

  const gross = byPlatform.reduce((s, x) => s + x.gross, 0);
  const orders = byPlatform.reduce((s, x) => s + x.orders, 0);
  const distance = byPlatform.reduce((s, x) => s + x.distance, 0);
  const dayWaits = waits.filter((w) => isoDate(w.started_at) === date);
  const waitMin = dayWaits.reduce((s, w) => s + Number(w.duration_min), 0);

  // Logged-in time: from summaries if we have it, else first order to last order plus one order's length.
  const times = rows.map((r) => toMin(r.time)).filter((x): x is number => x !== null);
  const span = times.length ? (Math.max(...times) - Math.min(...times) + ACTIVE_MIN_PER_ORDER) / 60 : 0;
  const activeHours = Math.min(orders * ACTIVE_MIN_PER_ORDER / 60, Math.max(span, loginHours) || Infinity);
  const totalHours = Math.max(loginHours || span, activeHours + waitMin / 60);

  const fuel = distance * Number(p.fuel_cost_per_km);
  const fixed = rows.length ? (Number(p.monthly_emi) + Number(p.monthly_phone_data)) / WORKING_DAYS_PER_MONTH : 0;
  const net = gross - fuel - fixed;
  const trueHourly = totalHours > 0 ? net / totalHours : 0;

  return {
    date, gross, fuel, fixed, net, orders, distance, activeHours, totalHours,
    shownHourly: activeHours > 0 ? gross / activeHours : 0,
    trueHourly,
    waitMin,
    waitCost: waitMin * Math.max(trueHourly, 0) / 60,
    worstWait: dayWaits.reduce<WaitRow | null>((w, x) => (!w || x.duration_min > w.duration_min ? x : w), null),
    byPlatform,
  };
}

function isoDate(ts: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}
