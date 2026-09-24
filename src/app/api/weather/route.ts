import { NextResponse } from 'next/server';
import { CITY_CENTER, ZONES } from '@/lib/geo';
import { parseOpenMeteo } from '@/lib/weather';

// Weather changes slowly: cache each area for 10 minutes so every rider shares one upstream call.
const TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, { at: number; body: unknown }>();

export async function GET(req: Request) {
  const zoneId = new URL(req.url).searchParams.get('zone');
  const zone = ZONES.find((z) => z.id === zoneId);
  const [lng, lat] = zone ? [zone.lng, zone.lat] : CITY_CENTER;
  const key = zone?.id ?? 'city';

  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body);

  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}`
    + '&current=temperature_2m,apparent_temperature,precipitation,weather_code,is_day,wind_speed_10m'
    + '&hourly=precipitation_probability,precipitation,weather_code,temperature_2m'
    + '&forecast_days=2&timezone=Asia%2FKolkata';
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
    const body = parseOpenMeteo(await res.json(), zone ? `${zone.name}, Bengaluru` : 'Bengaluru');
    cache.set(key, { at: Date.now(), body });
    return NextResponse.json(body);
  } catch (e) {
    console.error('[weather]', e);
    // Serve the last good report if we have one; otherwise the UI simply hides weather.
    if (hit) return NextResponse.json(hit.body);
    return NextResponse.json({ error: 'Weather is unavailable right now.' }, { status: 503 });
  }
}
