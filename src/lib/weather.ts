// Live Bengaluru weather from Open-Meteo (free, no API key) and the rider alerts built from it.

export type WeatherIcon = 'sun' | 'moon' | 'partly' | 'cloud' | 'fog' | 'drizzle' | 'rain' | 'storm';

export interface WeatherNow {
  temp: number;
  feels: number;
  precipMm: number;
  wind: number;
  code: number;
  isDay: boolean;
  label: string;
  icon: WeatherIcon;
  raining: boolean;
}

export interface HourForecast {
  time: string; // "2026-09-25T14:00" local IST
  date: string;
  hour: number;
  prob: number; // % chance of rain
  mm: number;
  code: number;
  temp: number;
  rainy: boolean;
}

export interface WeatherAlert {
  level: 'rain-now' | 'rain-soon' | 'heat' | 'clear';
  key: string; // stable per event, so a notification fires once
  inHours: number; // 0 = happening now
  title: string;
  body: string;
}

export interface WeatherReport {
  place: string;
  simulated?: boolean;
  updatedAt: string;
  now: WeatherNow;
  today: HourForecast[]; // 24 entries, 00:00–23:00 today
  next: HourForecast[]; // next 12 hours from now
  alert: WeatherAlert;
}

const RAIN_CODES = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);

export function describe(code: number, isDay = true): { label: string; icon: WeatherIcon } {
  if (code === 0) return { label: isDay ? 'Clear' : 'Clear night', icon: isDay ? 'sun' : 'moon' };
  if (code === 1) return { label: 'Mostly clear', icon: isDay ? 'sun' : 'moon' };
  if (code === 2) return { label: 'Partly cloudy', icon: 'partly' };
  if (code === 3) return { label: 'Cloudy', icon: 'cloud' };
  if (code === 45 || code === 48) return { label: 'Fog', icon: 'fog' };
  if (code >= 51 && code <= 57) return { label: 'Drizzle', icon: 'drizzle' };
  if (code === 61 || code === 80) return { label: 'Light rain', icon: 'rain' };
  if (code === 63 || code === 81) return { label: 'Rain', icon: 'rain' };
  if (code === 65 || code === 82) return { label: 'Heavy rain', icon: 'rain' };
  if (code === 66 || code === 67) return { label: 'Freezing rain', icon: 'rain' };
  if (code >= 95) return { label: 'Thunderstorm', icon: 'storm' };
  return { label: 'Cloudy', icon: 'cloud' };
}

/** An hour counts as rainy when rain is more likely than not, or measurable rain is forecast. */
export const isRainy = (prob: number, mm: number, code: number) => prob >= 50 || mm >= 0.5 || (RAIN_CODES.has(code) && code > 57 && prob >= 30);

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

export function buildAlert(now: WeatherNow, next: HourForecast[]): WeatherAlert {
  if (now.raining) {
    return {
      level: 'rain-now',
      key: `now-${next[0]?.time ?? ''}`,
      inHours: 0,
      title: `${now.label} in Bengaluru right now`,
      body: 'Orders usually jump about 30% while fewer riders are out. Ride slow, and expect longer restaurant waits.',
    };
  }
  const soon = next.slice(1).find((h) => h.rainy);
  if (soon) {
    const inHours = Math.max(1, next.indexOf(soon));
    return {
      level: 'rain-soon',
      key: `soon-${soon.time}`,
      inHours,
      title: `Rain likely around ${hourLabel(soon.hour)} (${soon.prob}% chance)`,
      body: inHours <= 3
        ? `About ${inHours} hr${inHours === 1 ? '' : 's'} away. Rain surges start fast, so be near a busy zone before it starts and keep your raincoat ready.`
        : `About ${inHours} hrs away. Plan your shift around it: rain means more orders but slower rides.`,
    };
  }
  if (now.feels >= 36) {
    return { level: 'heat', key: `heat-${next[0]?.time ?? ''}`, inHours: 0, title: `Feels like ${Math.round(now.feels)}°C`, body: 'Carry water and take a shade break in the afternoon. Heat slows you down more than it pays.' };
  }
  return { level: 'clear', key: 'clear', inHours: 0, title: 'No rain expected in the next 12 hours', body: 'Normal demand. Check City Pulse for the best zones right now.' };
}

type OpenMeteo = {
  current: { time: string; temperature_2m: number; apparent_temperature: number; precipitation: number; weather_code: number; is_day: number; wind_speed_10m: number };
  hourly: { time: string[]; precipitation_probability: number[]; precipitation: number[]; weather_code: number[]; temperature_2m: number[] };
};

export function parseOpenMeteo(raw: OpenMeteo, place: string): WeatherReport {
  const c = raw.current;
  const d = describe(c.weather_code, c.is_day === 1);
  const now: WeatherNow = {
    temp: c.temperature_2m, feels: c.apparent_temperature, precipMm: c.precipitation, wind: c.wind_speed_10m,
    code: c.weather_code, isDay: c.is_day === 1, label: d.label, icon: d.icon,
    raining: c.precipitation >= 0.1 || (RAIN_CODES.has(c.weather_code) && c.weather_code > 57),
  };
  const hours: HourForecast[] = raw.hourly.time.map((t, i) => {
    const prob = raw.hourly.precipitation_probability[i] ?? 0;
    const mm = raw.hourly.precipitation[i] ?? 0;
    const code = raw.hourly.weather_code[i] ?? 0;
    return { time: t, date: t.slice(0, 10), hour: Number(t.slice(11, 13)), prob, mm, code, temp: raw.hourly.temperature_2m[i], rainy: isRainy(prob, mm, code) };
  });
  const today = c.time.slice(0, 10);
  const currentHour = c.time.slice(0, 13);
  const start = Math.max(0, hours.findIndex((h) => h.time.slice(0, 13) === currentHour));
  return {
    place,
    updatedAt: c.time,
    now,
    today: hours.filter((h) => h.date === today),
    next: hours.slice(start, start + 12),
    alert: buildAlert(now, hours.slice(start, start + 12)),
  };
}

/** Stage demo: pretend it's raining now, clearly flagged as simulated. */
export function simulateRain(r: WeatherReport): WeatherReport {
  const now: WeatherNow = { ...r.now, code: 63, label: 'Rain (simulated)', icon: 'rain', raining: true, precipMm: 2.4 };
  const next = r.next.map((h, i) => (i < 3 ? { ...h, prob: Math.max(h.prob, 85), mm: Math.max(h.mm, 1.5), code: 63, rainy: true } : h));
  const today = r.today.map((h) => (next.slice(0, 3).some((n) => n.time === h.time) ? { ...h, prob: Math.max(h.prob, 85), code: 63, rainy: true } : h));
  return { ...r, simulated: true, now, next, today, alert: { ...buildAlert(now, next), key: 'simulated-rain' } };
}
