'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Bell, BellRing, Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Moon, Sun, ThermometerSun, Umbrella, X } from 'lucide-react';
import type { HourForecast, WeatherAlert, WeatherIcon as Icon, WeatherReport } from '@/lib/weather';

const ICONS = { sun: Sun, moon: Moon, partly: CloudSun, cloud: Cloud, fog: CloudFog, drizzle: CloudDrizzle, rain: CloudRain, storm: CloudLightning };

export function WeatherIcon({ icon, size = 20, className }: { icon: Icon; size?: number; className?: string }) {
  const I = ICONS[icon];
  return <I size={size} className={className} aria-hidden="true" />;
}

const hourShort = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`;

const TONE: Record<WeatherAlert['level'], { bar: string; text: string; icon: typeof Umbrella }> = {
  'rain-now': { bar: 'bg-info text-white', text: 'text-white/85', icon: CloudRain },
  'rain-soon': { bar: 'bg-info-soft text-[#123E66]', text: 'text-[#1F5A94]', icon: Umbrella },
  heat: { bar: 'bg-amber-soft text-[#5C3A00]', text: 'text-[#6B4700]', icon: ThermometerSun },
  clear: { bar: '', text: '', icon: Sun },
};

// Only interrupt the rider for things that matter in the next few hours.
const urgent = (a: WeatherAlert) => a.level === 'rain-now' || a.level === 'heat' || (a.level === 'rain-soon' && a.inHours <= 3);

/**
 * App-wide rain banner. Shows for rain now / rain soon / heat, and (if the rider allows it)
 * sends one browser notification per weather event while Kilometre is open.
 */
export function RainAlertBanner({ report }: { report: WeatherReport | null }) {
  const [dismissed, setDismissed] = useState<string | null>(null);
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>('default');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only values, read once after hydration
    setPerm(typeof Notification === 'undefined' ? 'unsupported' : Notification.permission);
    try { setDismissed(sessionStorage.getItem('km-weather-dismissed')); } catch { /* private mode */ }
  }, []);

  const alert = report?.alert;
  useEffect(() => {
    if (!alert || !urgent(alert) || perm !== 'granted') return;
    try {
      if (localStorage.getItem('km-weather-notified') === alert.key) return;
      localStorage.setItem('km-weather-notified', alert.key);
    } catch { /* ignore */ }
    new Notification(`Kilometre · ${alert.title}`, { body: alert.body, tag: 'km-weather' });
  }, [alert, perm]);

  if (!alert || !urgent(alert) || dismissed === alert.key) return null;
  const t = TONE[alert.level];
  const I = t.icon;
  return (
    <div role="status" className={`flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 ${t.bar}`}>
      <I size={20} className="shrink-0" />
      <p className="min-w-0 flex-1 text-sm font-extrabold">
        {alert.title}<span className={`ml-2 font-semibold ${t.text}`}>{alert.body}</span>
      </p>
      <div className="flex items-center gap-2">
        {alert.level !== 'heat' && (
          <Link href="/app/pulse" className="rounded-full bg-white/90 px-3.5 py-1.5 text-xs font-extrabold text-ink hover:bg-white">See rain surge zones</Link>
        )}
        {perm === 'default' && (
          <button type="button" onClick={async () => setPerm(await Notification.requestPermission())}
            className="flex cursor-pointer items-center gap-1.5 rounded-full border border-current/30 px-3 py-1.5 text-xs font-extrabold">
            <Bell size={14} /> Notify me
          </button>
        )}
        {perm === 'granted' && <span className="flex items-center gap-1 text-xs font-bold opacity-80"><BellRing size={14} /> Alerts on</span>}
        <button type="button" aria-label="Dismiss" onClick={() => { setDismissed(alert.key); try { sessionStorage.setItem('km-weather-dismissed', alert.key); } catch { /* ignore */ } }}
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full hover:bg-black/10"><X size={16} /></button>
      </div>
    </div>
  );
}

/** 12-hour rain outlook: one bar per hour, height = chance of rain. */
export function RainBars({ hours, highlightHour }: { hours: HourForecast[]; highlightHour?: number }) {
  return (
    <div className="flex h-24 items-end gap-1.5" role="img" aria-label={`Rain chance for the next ${hours.length} hours`}>
      {hours.map((h, i) => (
        <div key={h.time} className="group flex h-full flex-1 flex-col items-center justify-end gap-1">
          <span className="num text-[10px] font-extrabold text-muted opacity-0 transition group-hover:opacity-100">{h.prob}%</span>
          <span
            className={`block w-full rounded-t-md transition-all ${h.rainy ? 'bg-info' : 'bg-[#C9DDF0]'} ${highlightHour === h.hour ? 'ring-2 ring-ink ring-offset-1' : ''}`}
            style={{ height: `${Math.max(6, h.prob)}%` }}
          />
          <span className={`text-[10px] font-extrabold ${i === 0 ? 'text-ink' : 'text-muted'}`}>{i === 0 ? 'Now' : hourShort(h.hour)}</span>
        </div>
      ))}
    </div>
  );
}

export function WeatherCard({ report }: { report: WeatherReport | null }) {
  if (!report) {
    return <div className="h-[168px] animate-pulse rounded-[24px] bg-surface lg:col-span-12" aria-hidden="true" />;
  }
  const { now, next, alert } = report;
  const peak = next.reduce((m, h) => (h.prob > m.prob ? h : m), next[0]);
  const alertTone = alert.level === 'rain-now' ? 'bg-info text-white' : alert.level === 'rain-soon' ? 'bg-info-soft text-[#123E66]' : alert.level === 'heat' ? 'bg-amber-soft text-[#5C3A00]' : 'bg-money-soft text-[#075C3B]';
  return (
    <section className="grid gap-5 rounded-[24px] bg-surface p-5 shadow-[0_1px_2px_rgba(21,23,27,0.05)] sm:p-6 lg:col-span-12 lg:grid-cols-[220px_1fr_300px] lg:items-center">
      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-info-soft text-info"><WeatherIcon icon={now.icon} size={32} /></span>
        <div>
          <p className="num text-4xl font-extrabold leading-none">{Math.round(now.temp)}°</p>
          <p className="mt-1 text-sm font-extrabold">{now.label}</p>
          <p className="text-xs font-semibold text-muted">Feels {Math.round(now.feels)}° · {report.place}</p>
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-[15px] font-extrabold">Rain in the next 12 hours</h2>
          <span className="text-xs font-bold text-muted">peak {peak.prob}% at {peak.hour % 12 === 0 ? 12 : peak.hour % 12} {peak.hour < 12 ? 'AM' : 'PM'}</span>
        </div>
        <RainBars hours={next} />
      </div>
      <div className={`rounded-2xl p-4 ${alertTone}`}>
        <p className="text-sm font-extrabold">{alert.title}</p>
        <p className="mt-1 text-[13px] font-semibold opacity-85">{alert.body}</p>
        <p className="mt-2 text-[11px] font-bold opacity-60">{report.simulated ? 'Simulated rain for demo · remove ?rain=1 for live' : 'Live · Open-Meteo · updates every 10 min'}</p>
      </div>
    </section>
  );
}
