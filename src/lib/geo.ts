// Bengaluru zones, fictional restaurants and the simulated demand model.
// All demand numbers are simulated for the demo, never real platform data.

export type Profile = 'lunch' | 'dinner' | 'mixed' | 'event';
export type Platform =
  | 'swiggy' | 'zomato' | 'zepto' | 'blinkit' | 'instamart'
  | 'uber' | 'ola' | 'rapido' | 'porter' | 'amazon_flex';

export const PLATFORMS: { id: Platform; name: string; color: string }[] = [
  { id: 'swiggy', name: 'Swiggy', color: '#FC8019' },
  { id: 'zomato', name: 'Zomato', color: '#E23744' },
  { id: 'zepto', name: 'Zepto', color: '#7B2CF5' },
  { id: 'blinkit', name: 'Blinkit', color: '#E0B800' },
  { id: 'instamart', name: 'Instamart', color: '#F25C05' },
  { id: 'uber', name: 'Uber', color: '#15171B' },
  { id: 'ola', name: 'Ola', color: '#7FA31A' },
  { id: 'rapido', name: 'Rapido', color: '#E0B800' },
  { id: 'porter', name: 'Porter', color: '#1E6FFF' },
  { id: 'amazon_flex', name: 'Amazon Flex', color: '#FF9900' },
];

export const platformById = (id: string) => PLATFORMS.find((p) => p.id === id);

export interface Zone {
  id: string;
  name: string;
  area: string;
  lng: number;
  lat: number;
  profile: Profile;
  base: number; // peak ₹/hr at 1.0 multiplier
  riders: number;
  wait: number; // avg restaurant wait, minutes
}

export const CITY_CENTER: [number, number] = [77.6146, 12.9516];

export const ZONES: Zone[] = [
  { id: 'kor', name: 'Koramangala', area: '5th–8th Block', lng: 77.6245, lat: 12.9352, profile: 'mixed', base: 168, riders: 142, wait: 11 },
  { id: 'hsr', name: 'HSR Layout', area: 'Sector 1–3', lng: 77.6474, lat: 12.9116, profile: 'dinner', base: 158, riders: 96, wait: 9 },
  { id: 'ind', name: 'Indiranagar', area: '100 Feet Road', lng: 77.6408, lat: 12.9784, profile: 'dinner', base: 150, riders: 104, wait: 12 },
  { id: 'wf', name: 'Whitefield', area: 'ITPL · EPIP Zone', lng: 77.75, lat: 12.9698, profile: 'lunch', base: 150, riders: 118, wait: 14 },
  { id: 'man', name: 'Manyata Tech Park', area: 'Nagawara', lng: 77.621, lat: 13.045, profile: 'lunch', base: 136, riders: 74, wait: 13 },
  { id: 'ec', name: 'Electronic City', area: 'Phase 1', lng: 77.6602, lat: 12.8452, profile: 'lunch', base: 120, riders: 69, wait: 9 },
  { id: 'mar', name: 'Marathahalli', area: 'Kalamandir · ORR', lng: 77.6974, lat: 12.9591, profile: 'mixed', base: 124, riders: 81, wait: 10 },
  { id: 'bel', name: 'Bellandur', area: 'ORR tech parks', lng: 77.6762, lat: 12.926, profile: 'lunch', base: 140, riders: 88, wait: 10 },
  { id: 'btm', name: 'BTM Layout', area: '2nd Stage', lng: 77.6101, lat: 12.9166, profile: 'dinner', base: 128, riders: 90, wait: 8 },
  { id: 'jay', name: 'Jayanagar', area: '4th Block', lng: 77.5938, lat: 12.925, profile: 'dinner', base: 118, riders: 72, wait: 9 },
  { id: 'mg', name: 'MG Road', area: 'Brigade · Church St', lng: 77.605, lat: 12.9756, profile: 'mixed', base: 112, riders: 77, wait: 12 },
  { id: 'chs', name: 'Chinnaswamy', area: 'Stadium area', lng: 77.5996, lat: 12.9788, profile: 'event', base: 90, riders: 40, wait: 15 },
  { id: 'heb', name: 'Hebbal', area: 'Outer Ring Rd', lng: 77.597, lat: 13.0358, profile: 'mixed', base: 104, riders: 55, wait: 10 },
  { id: 'mal', name: 'Malleswaram', area: '8th Cross', lng: 77.5709, lat: 13.0035, profile: 'dinner', base: 106, riders: 58, wait: 8 },
];

// Fictional restaurant names only: never put fake wait scores on real businesses.
export interface Restaurant { id: string; name: string; zone: string; lng: number; lat: number; avgWait: number; reports: number }

const R_NAMES = ['Biryani Junction', 'Dosa Point', 'Burger Garage', 'Chai Adda', 'Roll Stop', 'Tiffin Room', 'Meals Corner',
  'Pizza Yard', 'Momo Street', 'Shawarma Hub', 'Idli Factory', 'Noodle Box', 'Thali House', 'Wrap Co', 'Kebab Lane',
  'Filter Kaapi Bar', 'Paratha Point', 'Sushi Shed', 'Waffle Works', 'Juice Junction'];

// Deterministic PRNG so the map looks identical on every reload.
export function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rand: () => number) {
  const u = Math.max(rand(), 1e-9), v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export const RESTAURANTS: Restaurant[] = (() => {
  const rand = mulberry32(7);
  const out: Restaurant[] = [];
  let i = 0;
  for (const z of ZONES) {
    if (z.profile === 'event') continue;
    const n = z.riders > 90 ? 4 : 3;
    for (let k = 0; k < n; k++) {
      out.push({
        id: `r${i}`,
        name: R_NAMES[i % R_NAMES.length],
        zone: z.id,
        lng: z.lng + gauss(rand) * 0.006,
        lat: z.lat + gauss(rand) * 0.005,
        avgWait: Math.round(4 + rand() * 24),
        reports: Math.round(5 + rand() * 115),
      });
      i++;
    }
  }
  return out;
})();

export function hourMultiplier(hour: number, profile: Profile) {
  const h = ((hour % 24) + 24) % 24;
  const table: Record<Profile, [number, number, number, number, number]> = {
    //        lunch dinner late morning between
    lunch: [1.0, 0.6, 0.3, 0.55, 0.5],
    mixed: [1.0, 1.05, 0.7, 0.5, 0.6],
    dinner: [0.8, 1.15, 0.8, 0.45, 0.55],
    event: [0.4, 0.6, 0.5, 0.3, 0.35],
  };
  const t = table[profile];
  if (h >= 11 && h < 15) return t[0];
  if (h >= 19 && h < 23) return t[1];
  if (h >= 23 || h < 2) return t[2];
  if (h >= 7 && h < 11) return t[3];
  return t[4];
}

export function periodLabel(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 11 && h < 15) return 'Lunch rush';
  if (h >= 19 && h < 23) return 'Dinner rush';
  if (h >= 23 || h < 2) return 'Late night';
  if (h >= 7 && h < 11) return 'Morning';
  if (h >= 2 && h < 7) return 'Early morning';
  return 'Afternoon lull';
}

export function formatHour(hour: number) {
  const h = ((hour % 24) + 24) % 24;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:00 ${h < 12 ? 'AM' : 'PM'}`;
}

export interface Conditions { hour: number; rain?: boolean; match?: boolean }

function zoneBoost(z: Zone, c: Conditions) {
  const rain = c.rain ? 1.3 : 1;
  const event = c.match && c.hour >= 18 && (z.id === 'chs' || z.id === 'mg') ? (z.id === 'chs' ? 4 : 1.7) : 1;
  return hourMultiplier(c.hour, z.profile) * rain * event;
}

export interface ZoneState extends Zone { rate: number; orders: number; ridersNow: number; waitNow: number; boost: number }

export function zoneStates(c: Conditions): ZoneState[] {
  return ZONES.map((z) => {
    const m = zoneBoost(z, c);
    return {
      ...z,
      boost: m,
      rate: Math.round(z.base * m),
      orders: Math.round(z.base / 50 * m * 10) / 10,
      ridersNow: Math.round(z.riders * hourMultiplier(c.hour, z.profile) * (c.rain ? 0.8 : 1)),
      waitNow: z.wait + (c.rain ? 4 : 0),
    };
  }).sort((a, b) => b.rate - a.rate);
}

export type DemandPoint = { position: [number, number]; weight: number };

// Scatter weighted points around each zone; HexagonLayer aggregates them into 3D columns.
export function demandPoints(c: Conditions): DemandPoint[] {
  const rand = mulberry32(42);
  const pts: DemandPoint[] = [];
  for (const z of ZONES) {
    const m = zoneBoost(z, c);
    const n = Math.round(90 + z.base * 0.9);
    const spread = z.profile === 'event' ? 0.004 : 0.009;
    for (let i = 0; i < n; i++) {
      pts.push({
        position: [z.lng + gauss(rand) * spread, z.lat + gauss(rand) * spread * 0.9],
        weight: m * (0.6 + rand() * 0.8),
      });
    }
  }
  // Thin background noise across the city so it never looks empty.
  for (let i = 0; i < 500; i++) {
    pts.push({ position: [77.55 + rand() * 0.22, 12.84 + rand() * 0.22], weight: 0.15 + rand() * 0.2 });
  }
  return pts;
}
