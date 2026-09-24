'use client';

import { useEffect, useState } from 'react';
import { simulateRain, type WeatherReport } from './weather';

const REFRESH_MS = 10 * 60 * 1000;

/** Live weather for the city (or a zone), refreshed every 10 minutes. `null` until the first report arrives. */
export function useWeather(zone?: string | null, simulate = false) {
  const [report, setReport] = useState<WeatherReport | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/weather${zone ? `?zone=${zone}` : ''}`);
        if (res.ok && alive) {
          const r: WeatherReport = await res.json();
          setReport(simulate ? simulateRain(r) : r);
        }
      } catch {
        // Offline: keep showing the last report.
      }
    };
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => { alive = false; clearInterval(id); };
  }, [zone, simulate]);
  return report;
}
