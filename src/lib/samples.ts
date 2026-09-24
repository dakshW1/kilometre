// Demo payout screenshots, drawn as SVG with today's date baked in.
// One source of truth: the in-app "Try a sample" picker, `npm run samples` (PNG files for judges)
// and DEMO_MODE's offline AI answers all read the same data, so they always agree.
// Self-contained on purpose (no imports) so the Node script can load it directly.

export type SampleId = 'swiggy-orders' | 'zomato-summary' | 'rapido-rides' | 'zepto-hindi' | 'blinkit-kannada';

export interface SampleOrder {
  id: string | null;
  time: string; // HH:MM, 24h
  amount: number;
  incentive?: number;
  km: number | null; // null = blurred on screen, the AI should flag it
  from?: string;
  to?: string;
}

export interface Sample {
  id: SampleId;
  label: string;
  platform: 'swiggy' | 'zomato' | 'rapido' | 'zepto' | 'blinkit';
  lang: 'en' | 'hi' | 'kn';
  color: string;
  ink: string; // header text colour
  appName: string;
  orders: SampleOrder[];
  summary?: { orders: number; amount: number; incentive: number; tip: number; loginHours: number; km: number };
}

export const SAMPLES: Sample[] = [
  {
    id: 'swiggy-orders', label: 'Swiggy · order list', platform: 'swiggy', lang: 'en', color: '#FC8019', ink: '#FFFFFF', appName: 'Swiggy · Delivery Partner',
    orders: [
      { id: 'SW-51213', time: '12:18', amount: 42, incentive: 10, km: 3.1 },
      { id: 'SW-51247', time: '12:51', amount: 44, km: 2.4 },
      { id: null, time: '13:42', amount: 96, km: 2.8 },
      { id: 'SW-51315', time: '14:20', amount: 46, incentive: 15, km: null },
    ],
  },
  {
    id: 'zomato-summary', label: 'Zomato · daily summary', platform: 'zomato', lang: 'en', color: '#E23744', ink: '#FFFFFF', appName: 'Zomato · Delivery Partner',
    orders: [],
    summary: { orders: 18, amount: 1046, incentive: 180, tip: 60, loginHours: 9.67, km: 71.4 },
  },
  {
    id: 'rapido-rides', label: 'Rapido · ride history', platform: 'rapido', lang: 'en', color: '#F9D71C', ink: '#1A1A1A', appName: 'Rapido · Captain',
    orders: [
      { id: 'RD-70231', time: '08:12', amount: 128, km: 7.2, from: 'Koramangala', to: 'MG Road' },
      { id: 'RD-70248', time: '09:05', amount: 214, km: 13.8, from: 'Indiranagar', to: 'Whitefield' },
      { id: 'RD-70262', time: '10:22', amount: 96, km: 5.1, from: 'Whitefield', to: 'Marathahalli' },
      { id: 'RD-70277', time: '11:40', amount: 142, km: 8.4, from: 'Marathahalli', to: 'HSR Layout' },
      { id: 'RD-70290', time: '12:55', amount: 64, km: 3.2, from: 'HSR Layout', to: 'BTM Layout' },
    ],
  },
  {
    id: 'zepto-hindi', label: 'Zepto · हिंदी', platform: 'zepto', lang: 'hi', color: '#5B1FA8', ink: '#FFFFFF', appName: 'Zepto · डिलीवरी पार्टनर',
    orders: [
      { id: 'ZP-30412', time: '13:05', amount: 38, incentive: 20, km: 2.1 },
      { id: 'ZP-30437', time: '13:32', amount: 42, km: 2.6 },
      { id: 'ZP-30451', time: '14:10', amount: 36, km: 1.8 },
      { id: 'ZP-30468', time: '14:48', amount: 45, incentive: 10, km: 3.0 },
    ],
  },
  {
    id: 'blinkit-kannada', label: 'Blinkit · ಕನ್ನಡ', platform: 'blinkit', lang: 'kn', color: '#F8CB46', ink: '#1A1A1A', appName: 'Blinkit · ಡೆಲಿವರಿ ಪಾಲುದಾರ',
    orders: [
      { id: 'BL-88120', time: '18:20', amount: 40, km: 2.2 },
      { id: 'BL-88134', time: '18:47', amount: 44, incentive: 15, km: 2.9 },
      { id: 'BL-88151', time: '19:25', amount: 39, km: 1.7 },
      { id: 'BL-88163', time: '20:02', amount: 47, km: 3.4 },
    ],
  },
];

const T = {
  en: { title: "Today's orders", order: 'Order', delivered: 'Delivered order', inc: 'Incentive', count: (n: number) => `${n} orders today`, base: 'Base', incs: 'incentives', rides: "Today's rides", rideCount: (n: number) => `${n} rides today`, fare: 'Fares' },
  hi: { title: 'आज की कमाई', order: 'ऑर्डर', delivered: 'डिलीवर हुआ ऑर्डर', inc: 'इंसेंटिव', count: (n: number) => `आज ${n} ऑर्डर`, base: 'बेस', incs: 'इंसेंटिव', rides: '', rideCount: () => '', fare: '' },
  kn: { title: 'ಇಂದಿನ ಗಳಿಕೆ', order: 'ಆರ್ಡರ್', delivered: 'ತಲುಪಿಸಿದ ಆರ್ಡರ್', inc: 'ಪ್ರೋತ್ಸಾಹ', count: (n: number) => `ಇಂದು ${n} ಆರ್ಡರ್‌ಗಳು`, base: 'ಮೂಲ', incs: 'ಪ್ರೋತ್ಸಾಹ', rides: '', rideCount: () => '', fare: '' },
};

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const time12 = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};

export function sampleDateLabel(iso: string) {
  const d = new Date(`${iso}T12:00:00+05:30`);
  return new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

const FONT = "'Nirmala UI', 'Noto Sans', 'Segoe UI', Arial, sans-serif";

export function sampleSVG(id: SampleId, isoDate: string): string {
  const s = SAMPLES.find((x) => x.id === id)!;
  const t = T[s.lang];
  const date = sampleDateLabel(isoDate);
  const rides = s.platform === 'rapido';
  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1280" viewBox="0 0 720 1280" font-family="${FONT}">`);
  out.push(`<rect width="720" height="1280" fill="#F5F5F5"/>`);
  out.push(`<rect width="720" height="210" fill="${s.color}"/>`);
  out.push(`<text x="40" y="78" font-size="28" font-weight="700" fill="${s.ink}">${esc(s.appName)}</text>`);
  out.push(`<text x="680" y="78" font-size="20" font-weight="700" fill="${s.ink}" opacity="0.8" text-anchor="end">SAMPLE</text>`);
  out.push(`<text x="40" y="140" font-size="46" font-weight="700" fill="${s.ink}">${esc(s.summary ? 'Earnings summary' : rides ? t.rides : t.title)}</text>`);
  out.push(`<text x="40" y="182" font-size="24" fill="${s.ink}" opacity="0.9">${esc(date)}</text>`);

  if (s.summary) {
    const x = s.summary;
    const total = x.amount + x.incentive + x.tip;
    const h = Math.floor(x.loginHours), m = Math.round((x.loginHours - h) * 60);
    out.push(`<rect x="30" y="240" width="660" height="210" rx="20" fill="#fff"/>`);
    out.push(`<text x="60" y="300" font-size="26" fill="#666">Total earnings today</text>`);
    out.push(`<text x="60" y="390" font-size="84" font-weight="700" fill="#1A1A1A">₹${total.toLocaleString('en-IN')}</text>`);
    out.push(`<text x="60" y="428" font-size="22" fill="#1B8A4B">Credited to bank in 24 hrs</text>`);
    const rows: [string, string][] = [
      ['Orders delivered', String(x.orders)],
      ['Order pay', `₹${x.amount.toLocaleString('en-IN')}`],
      ['Peak-hour incentive', `₹${x.incentive}`],
      ['Customer tips', `₹${x.tip}`],
      ['Login hours', `${h}h ${m}m`],
      ['Distance travelled', `${x.km} km`],
    ];
    out.push(`<rect x="30" y="480" width="660" height="${rows.length * 92 + 20}" rx="20" fill="#fff"/>`);
    rows.forEach(([k, v], i) => {
      const y = 540 + i * 92;
      out.push(`<text x="60" y="${y}" font-size="28" fill="#444">${esc(k)}</text>`);
      out.push(`<text x="660" y="${y}" font-size="32" font-weight="700" fill="#1A1A1A" text-anchor="end">${esc(v)}</text>`);
      if (i < rows.length - 1) out.push(`<rect x="60" y="${y + 34}" width="600" height="2" fill="#EEE"/>`);
    });
  } else {
    let y = 240;
    for (const o of s.orders) {
      const tall = !!o.incentive;
      const h = tall ? 170 : rides ? 138 : 150;
      out.push(`<rect x="30" y="${y}" width="660" height="${h}" rx="18" fill="#fff"/>`);
      const title = rides ? `${o.from} → ${o.to}` : o.id ? `${t.order} #${o.id}` : t.delivered;
      out.push(`<text x="60" y="${y + 55}" font-size="${rides ? 28 : 30}" font-weight="700" fill="#222">${esc(title)}</text>`);
      const km = o.km === null ? `<tspan fill="#C8C8C8">?.? km</tspan>` : `${o.km} km`;
      out.push(`<text x="60" y="${y + 100}" font-size="25" fill="#666">${esc(time12(o.time))} · ${km}${rides && o.id ? ` · ${esc(o.id)}` : ''}</text>`);
      if (o.incentive) out.push(`<text x="60" y="${y + 142}" font-size="24" fill="#1B8A4B">${esc(t.inc)} +₹${o.incentive}</text>`);
      out.push(`<text x="660" y="${y + 70}" font-size="40" font-weight="700" fill="#222" text-anchor="end">₹${o.amount}</text>`);
      y += h + (rides ? 16 : 20);
    }
    const base = s.orders.reduce((a, o) => a + o.amount, 0);
    const inc = s.orders.reduce((a, o) => a + (o.incentive ?? 0), 0);
    out.push(`<rect x="30" y="${y + 10}" width="660" height="130" rx="18" fill="${s.color}" opacity="0.14"/>`);
    out.push(`<text x="60" y="${y + 62}" font-size="28" font-weight="700" fill="#333">${esc(rides ? t.rideCount(s.orders.length) : t.count(s.orders.length))}</text>`);
    out.push(`<text x="60" y="${y + 104}" font-size="24" fill="#555">${esc(rides ? `${t.fare} ₹${base}` : `${t.base} ₹${base} + ${t.incs} ₹${inc}`)}</text>`);
    out.push(`<text x="660" y="${y + 92}" font-size="42" font-weight="700" fill="#222" text-anchor="end">₹${base + inc}</text>`);
  }
  out.push(`<text x="360" y="1250" font-size="21" fill="#9A9A9A" text-anchor="middle">Demo sample for Kilometre · not a real payout</text>`);
  out.push(`</svg>`);
  return out.join('\n');
}

/** What a perfect read of a sample looks like; DEMO_MODE returns this instead of calling the AI. */
export function sampleExtraction(id: SampleId, isoDate: string) {
  const s = SAMPLES.find((x) => x.id === id)!;
  if (s.summary) {
    const x = s.summary;
    return {
      platform: s.platform, screenshot_type: 'daily_summary' as const, date: isoDate,
      summary: { total_earnings: x.amount + x.incentive + x.tip, orders_count: x.orders, incentives: x.incentive, tips: x.tip, login_hours: x.loginHours, distance_km: x.km },
      orders: [], incentive_rule: null, notes: 'Demo mode: sample extraction.',
    };
  }
  return {
    platform: s.platform, screenshot_type: 'order' as const, date: isoDate,
    summary: { total_earnings: s.orders.reduce((a, o) => a + o.amount + (o.incentive ?? 0), 0), orders_count: s.orders.length, incentives: s.orders.reduce((a, o) => a + (o.incentive ?? 0), 0), tips: null, login_hours: null, distance_km: null },
    orders: s.orders.map((o) => ({
      order_id: o.id, time: o.time, amount: o.amount, incentive: o.incentive ?? null, tip: null, distance_km: o.km,
      restaurant_or_pickup: o.from ?? null, confidence: o.km === null ? 0.61 : 0.95,
    })),
    incentive_rule: null, notes: 'Demo mode: sample extraction.',
  };
}

export const sampleIdFromName = (name: string) => SAMPLES.find((s) => name.includes(s.id))?.id ?? null;
