// Generates a realistic demo week for one rider. Rows are tagged source = 'seed' so they can be cleared.
import { addDaysISO } from './dates';
import { mulberry32, type Platform } from './geo';

const FOOD: Platform[] = ['swiggy', 'zomato'];
const QUICK: Platform[] = ['zepto', 'blinkit', 'instamart', 'amazon_flex'];
const RIDE: Platform[] = ['rapido', 'uber', 'ola', 'porter'];
const PREFIX: Record<string, string> = { swiggy: 'SW', zomato: 'ZO', zepto: 'ZE', blinkit: 'BL', instamart: 'IM', uber: 'UB', ola: 'OL', rapido: 'RA', porter: 'PO', amazon_flex: 'AF' };

// Today's numbers are fixed so the pitch story lands exactly: ₹1,470 gross, 85 km, ~11.9 hrs, ~₹94/hr real.
const TODAY = {
  quick: { times: ['09:00', '09:35', '10:05', '10:40', '11:15'], amounts: [58, 64, 60, 66, 62], inc: [0, 0, 0, 0, 0], km: 3 },
  food: { times: ['11:48', '12:18', '12:51', '13:42', '14:20', '19:10', '20:24'], amounts: [78, 92, 85, 96, 88, 101, 75], inc: [10, 0, 0, 0, 15, 0, 0], km: 5 },
  ride: { times: ['15:30', '16:25', '17:20', '18:15'], amounts: [118, 132, 126, 144], inc: [0, 0, 0, 0], km: 8.75 },
};
const TODAY_WAITS = [
  { name: 'Dosa Point', zone: 'kor', role: 'food', at: '12:08', min: 6 },
  { name: 'Biryani Junction', zone: 'kor', role: 'food', at: '13:18', min: 22 },
  { name: 'Burger Garage', zone: 'hsr', role: 'food', at: '14:09', min: 9 },
  { name: 'Roll Stop', zone: 'bel', role: 'food', at: '19:58', min: 10 },
];
const RESTAURANT_POOL = [['Biryani Junction', 'kor'], ['Dosa Point', 'kor'], ['Burger Garage', 'hsr'], ['Roll Stop', 'bel'], ['Tiffin Room', 'man'], ['Momo Street', 'ind'], ['Thali House', 'btm'], ['Pizza Yard', 'ec']] as const;

function pickApps(platforms: Platform[]) {
  const find = (group: Platform[], fallback: Platform) => platforms.find((p) => group.includes(p)) ?? fallback;
  return { food: find(FOOD, 'swiggy'), quick: find(QUICK, 'zepto'), ride: find(RIDE, 'rapido') };
}

const pad = (n: number) => String(n).padStart(2, '0');

export function buildSeed(userId: string, platforms: Platform[], today: string) {
  const apps = pickApps(platforms);
  const rand = mulberry32(userId.split('').reduce((s, c) => s + c.charCodeAt(0), 0));
  let serial = 48190;
  const earnings: Record<string, unknown>[] = [];
  const waits: Record<string, unknown>[] = [];

  for (let back = 6; back >= 0; back--) {
    const date = addDaysISO(today, -back);
    const scale = back === 0 ? 1 : 0.75 + rand() * 0.45;
    for (const role of ['quick', 'food', 'ride'] as const) {
      const plan = TODAY[role];
      const platform = apps[role];
      plan.times.forEach((t, i) => {
        if (back > 0 && rand() < 0.12) return; // some days have fewer orders
        const [h, m] = t.split(':').map(Number);
        const shift = back === 0 ? 0 : Math.round((rand() - 0.5) * 30);
        const mins = Math.min(23 * 60 + 30, Math.max(8 * 60, h * 60 + m + shift));
        earnings.push({
          user_id: userId,
          platform,
          date,
          time: `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`,
          order_id: `${PREFIX[platform]}-${serial++}`,
          kind: 'order',
          amount: Math.round(plan.amounts[i] * scale),
          incentive: back === 0 ? plan.inc[i] : rand() < 0.15 ? 10 : 0,
          tip: 0,
          distance_km: Math.round(plan.km * (0.8 + rand() * 0.4) * 10) / 10,
          source: 'seed',
        });
      });
    }
    // Keep today's distance exactly 85 km for the demo story.
    if (back === 0) {
      const todays = earnings.filter((e) => e.date === date);
      todays.forEach((e) => {
        const role = e.platform === apps.food ? 'food' : e.platform === apps.quick ? 'quick' : 'ride';
        e.distance_km = TODAY[role].km;
      });
    }

    const dayWaits = back === 0
      ? TODAY_WAITS
      : Array.from({ length: 3 + Math.floor(rand() * 4) }, () => {
        const [name, zone] = RESTAURANT_POOL[Math.floor(rand() * RESTAURANT_POOL.length)];
        return { name, zone, role: 'food', at: `${pad(11 + Math.floor(rand() * 10))}:${pad(Math.floor(rand() * 60))}`, min: 4 + Math.round(rand() * 20) };
      });
    for (const w of dayWaits) {
      const start = new Date(`${date}T${w.at}:00+05:30`);
      const end = new Date(start.getTime() + w.min * 60_000);
      waits.push({
        user_id: userId,
        restaurant_name: w.name,
        zone: w.zone,
        platform: apps.food,
        started_at: start.toISOString(),
        ended_at: end.toISOString(),
        duration_min: w.min,
        source: 'seed',
      });
    }
  }
  return { earnings, waits };
}
