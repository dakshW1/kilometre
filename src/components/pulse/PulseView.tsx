'use client';

import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'motion/react';
import { useMemo, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { Box, Clock, CloudRain, Compass, Flag, Layers, Minus, Navigation, Plus, Timer, X } from 'lucide-react';
import { useProfile } from '@/components/app/ProfileContext';
import { istHour, istTime, useNow } from '@/lib/clock';
import { describe } from '@/lib/weather';
import { WeatherIcon } from '@/components/weather/WeatherBits';
import { useWeatherReport } from '@/components/weather/WeatherContext';
import {
  CITY_CENTER, PLATFORMS, RESTAURANTS, ZONES, formatHour, hourMultiplier, periodLabel, zoneStates,
  type Platform, type ZoneState,
} from '@/lib/geo';

const CityMap = dynamic(() => import('@/components/map/CityMap'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#ECEEE7]" />,
});

// Always open on Bengaluru's actual current hour.
const defaultHour = () => istHour();

const RIDE_APPS: Platform[] = ['uber', 'ola', 'rapido', 'porter'];
const HOME_CAM = { center: CITY_CENTER, zoom: 11.3, pitch: 55, bearing: -18 };

// Stable per-zone, per-app variation so the "best app here" list differs by area.
function appFactor(zoneId: string, app: string) {
  let h = 0;
  for (const c of zoneId + app) h = (h * 31 + c.charCodeAt(0)) | 0;
  return 0.85 + ((Math.abs(h) % 1000) / 1000) * 0.3;
}

function bestApps(z: ZoneState, apps: Platform[]) {
  const perOrder = z.orders > 0 ? z.rate / z.orders : 40;
  return apps
    .map((id) => {
      const p = PLATFORMS.find((x) => x.id === id)!;
      const f = appFactor(z.id, id);
      const ride = RIDE_APPS.includes(id);
      return { id, name: p.name, color: p.color, value: Math.round((ride ? z.rate * 0.42 : perOrder) * f), unit: ride ? '/hr' : '/order', score: f };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

const waitTone = (m: number) =>
  m < 8 ? { dot: '#1E9E5A', text: 'text-[#0B6B3A]', bg: 'bg-money-soft' }
    : m <= 18 ? { dot: '#E8A317', text: 'text-[#8A5600]', bg: 'bg-amber-soft' }
      : { dot: '#C22F3D', text: 'text-[#A3202E]', bg: 'bg-danger-soft' };

export default function PulseView() {
  const { profile } = useProfile();
  const mapRef = useRef<MLMap | null>(null);
  const [hour, setHour] = useState(() => defaultHour());
  // null = follow live weather; true/false = the rider forced it for a what-if.
  const [rainOverride, setRainOverride] = useState<boolean | null>(null);
  const weather = useWeatherReport();
  const [match, setMatch] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<'zones' | 'waits'>('zones');
  const [showHeat, setShowHeat] = useState(true);
  const [showWaits, setShowWaits] = useState(true);
  const [tilted, setTilted] = useState(true);
  const [hover, setHover] = useState<{ value: number; x: number; y: number } | null>(null);

  const now = useNow();
  const isLive = now !== null && hour === istHour(now);
  const forecast = weather?.today.find((h) => h.hour === hour) ?? null;
  const autoRain = !!(isLive ? weather?.now.raining || forecast?.rainy : forecast?.rainy);
  const rain = rainOverride ?? autoRain;
  const conditions = useMemo(() => ({ hour, rain, match }), [hour, rain, match]);
  const states = useMemo(() => zoneStates(conditions).filter((z) => match || z.id !== 'chs'), [conditions, match]);
  const cityAvg = Math.round(states.reduce((s, z) => s + z.rate, 0) / states.length);
  const sel = states.find((z) => z.id === selected) ?? null;
  const myApps = profile.platforms.length ? profile.platforms : (['swiggy', 'zomato', 'rapido'] as Platform[]);
  const waits = useMemo(
    () => RESTAURANTS.map((r) => ({ ...r, waitNow: r.avgWait + (rain ? 4 : 0), zoneName: ZONES.find((z) => z.id === r.zone)?.name ?? '' }))
      .sort((a, b) => b.waitNow - a.waitNow),
    [rain],
  );

  const fly = (center: [number, number], zoom = 13.4) => {
    mapRef.current?.flyTo({ center, zoom, pitch: tilted ? 58 : 0, duration: 1600, essential: true });
  };
  const pick = (id: string) => {
    setSelected(id);
    const z = ZONES.find((x) => x.id === id);
    if (z) fly([z.lng, z.lat]);
  };
  const toggleMatch = () => {
    const on = !match;
    setMatch(on);
    if (on) {
      if (hour < 19) setHour(20);
      setSelected('chs');
      fly([77.5996, 12.9788], 13.2);
    } else if (selected === 'chs') setSelected(null);
  };
  const toggleTilt = () => {
    const next = !tilted;
    setTilted(next);
    mapRef.current?.easeTo({ pitch: next ? 55 : 0, bearing: next ? -18 : 0, duration: 900 });
  };

  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:min-h-0">
      {/* Top bar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-line bg-surface px-5 py-3.5 lg:px-6">
        <div className="mr-2 flex flex-col">
          <h1 className="font-display text-[22px] font-extrabold leading-tight tracking-tight">City Pulse</h1>
          <span className="text-xs font-semibold text-muted">Bengaluru · simulated demand across all apps</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Toggle on={rain} onClick={() => setRainOverride(!rain)} tone="info" icon={<CloudRain size={17} />}>
            Rain mode
            {rainOverride === null && weather && <span className="rounded-full bg-info px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">live</span>}
          </Toggle>
          {rainOverride !== null && weather && (
            <button type="button" onClick={() => setRainOverride(null)} className="h-11 cursor-pointer rounded-xl px-3 text-xs font-extrabold text-info hover:bg-info-soft">Use live weather</button>
          )}
          <Toggle on={match} onClick={toggleMatch} tone="heat" icon={<Flag size={17} />}>Match at Chinnaswamy</Toggle>
        </div>
        <div className="ml-auto hidden items-center gap-2 md:flex">
          <span className="text-xs font-bold text-muted">Your apps</span>
          {myApps.slice(0, 5).map((id) => {
            const p = PLATFORMS.find((x) => x.id === id);
            return p ? <span key={id} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-bold"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</span> : null;
          })}
        </div>
      </header>

      <div className="flex flex-1 flex-col-reverse gap-5 p-4 lg:min-h-0 lg:flex-row lg:p-5">
        {/* List */}
        <section aria-label="Zones and restaurants" className="flex flex-col gap-4 lg:w-[400px] lg:shrink-0 lg:overflow-y-auto lg:pr-1">
          <div>
            <h2 className="font-display text-[26px] font-extrabold leading-tight tracking-tight">{tab === 'zones' ? 'Best zones right now' : 'Worst waits right now'}</h2>
            <p className="text-[13px] font-semibold text-muted">{isLive ? 'Right now' : formatHour(hour)} · {periodLabel(hour)} · {tab === 'zones' ? 'ranked by expected ₹/hr' : 'from rider wait reports'}</p>
          </div>
          <div role="tablist" className="flex gap-1 rounded-2xl bg-[#E7E9E2] p-1">
            {(['zones', 'waits'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)}
                className={`h-10 flex-1 cursor-pointer rounded-xl text-[13px] font-extrabold transition ${tab === t ? 'bg-surface shadow-sm' : 'text-ink-2 hover:text-ink'}`}>
                {t === 'zones' ? 'Zones' : 'Restaurant waits'}
              </button>
            ))}
          </div>

          {tab === 'zones' ? (
            <ol className="flex flex-col gap-2.5">
              {states.slice(0, 9).map((z, i) => (
                <li key={z.id}>
                  <ZoneCard z={z} rank={i + 1} selected={z.id === selected} hour={hour} rain={rain} onClick={() => pick(z.id)} />
                </li>
              ))}
            </ol>
          ) : (
            <ol className="flex flex-col gap-2">
              {waits.slice(0, 12).map((r) => {
                const t = waitTone(r.waitNow);
                return (
                  <li key={r.id}>
                    <button type="button" onClick={() => fly([r.lng, r.lat], 15)} className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-left transition hover:border-ink/30">
                      <span className={`num flex h-12 w-14 shrink-0 flex-col items-center justify-center rounded-xl ${t.bg} ${t.text}`}>
                        <span className="text-lg font-extrabold leading-none">{r.waitNow}m</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-extrabold">{r.name}</span>
                        <span className="text-xs font-semibold text-muted">{r.zoneName} · {r.reports} rider reports</span>
                      </span>
                      <Timer size={16} className="text-muted" />
                    </button>
                  </li>
                );
              })}
              <li className="px-1 text-xs font-semibold text-muted">Restaurant names are fictional demo data.</li>
            </ol>
          )}
        </section>

        {/* Map */}
        <section aria-label="City map" className="relative h-[62vh] min-h-[420px] overflow-hidden rounded-[24px] border border-[#DDE0D7] bg-[#ECEEE7] lg:h-auto lg:flex-1">
          <CityMap
            theme="day"
            conditions={conditions}
            initialCamera={HOME_CAM}
            hexOpacity={showHeat ? 0.82 : 0}
            elevationScale={showHeat ? 1 : 0}
            showRestaurants={showWaits}
            zones={states}
            selectedZoneId={selected}
            onZoneClick={pick}
            onHexHover={setHover}
            onReady={(m) => { mapRef.current = m; }}
          />

          {hover && showHeat && (
            <div className="pointer-events-none absolute z-10 rounded-xl bg-ink px-3 py-2 text-xs font-bold text-white shadow-lg" style={{ left: hover.x + 14, top: hover.y + 14 }}>
              Demand score <span className="num">{hover.value.toFixed(1)}</span>
            </div>
          )}

          {/* Time card */}
          <div className="absolute left-3 top-3 w-[min(400px,calc(100%-88px))] rounded-2xl bg-surface/95 p-4 shadow-[0_8px_30px_rgba(21,23,27,0.14)] backdrop-blur">
            <div className="flex items-center gap-2">
              <Clock size={17} />
              <span className="num text-[17px] font-extrabold">{isLive && now ? istTime(now, true) : formatHour(hour)}</span>
              <span className="rounded-full bg-heat-soft px-2.5 py-0.5 text-xs font-extrabold text-[#B8431D]">{periodLabel(hour)}</span>
              {rain && <span className="rounded-full bg-info-soft px-2 py-0.5 text-[11px] font-extrabold text-[#1F5A94]">Rain +30%</span>}
              {isLive
                ? <span className="ml-auto flex items-center gap-1.5 text-xs font-extrabold text-money"><span className="relative flex h-2 w-2"><span className="pulse-ring absolute h-full w-full rounded-full bg-money" /><span className="relative h-2 w-2 rounded-full bg-money" /></span>Live</span>
                : <button type="button" onClick={() => setHour(defaultHour())} className="ml-auto cursor-pointer rounded-lg px-2 py-1 text-xs font-extrabold text-muted hover:bg-paper hover:text-ink">Back to now</button>}
            </div>
            <label className="mt-2 block">
              <span className="sr-only">Hour of day</span>
              <input type="range" min={0} max={23} step={1} value={hour} onChange={(e) => setHour(Number(e.target.value))} className="w-full accent-ink" />
            </label>
            {weather && weather.today.length === 24 && (
              <div className="mt-1 flex h-5 items-end gap-[2px] px-[7px]" aria-hidden="true" title="Chance of rain today">
                {weather.today.map((h) => (
                  <span key={h.time} className={`block flex-1 rounded-[2px] ${h.rainy ? 'bg-info' : 'bg-[#C9DDF0]'} ${h.hour === hour ? 'outline-2 outline-ink' : ''}`} style={{ height: `${Math.max(12, h.prob)}%` }} />
                ))}
              </div>
            )}
            <div className="flex justify-between text-[11px] font-bold text-muted"><span>12 AM</span><span>6 AM</span><span>12 PM</span><span>6 PM</span><span>11 PM</span></div>
            {weather && (
              <p className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-xs font-bold text-ink-2">
                <WeatherIcon icon={isLive ? weather.now.icon : describe(forecast?.code ?? 0).icon} size={16} className="text-info" />
                {isLive
                  ? <>{Math.round(weather.now.temp)}° · {weather.now.label}{forecast ? ` · ${forecast.prob}% rain this hour` : ''}</>
                  : forecast ? <>{Math.round(forecast.temp)}° · {forecast.prob}% chance of rain{forecast.rainy ? ' · rain surge likely' : ''}</> : 'No forecast for this hour'}
                <span className="ml-auto text-[10px] font-semibold text-muted">live forecast</span>
              </p>
            )}
          </div>

          {/* Map controls */}
          <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
            <div className="flex gap-1 rounded-2xl bg-surface/95 p-1 shadow-[0_8px_30px_rgba(21,23,27,0.14)]">
              <IconToggle on={showHeat} onClick={() => setShowHeat(!showHeat)} icon={<Layers size={16} />} label="Demand" />
              <IconToggle on={showWaits} onClick={() => setShowWaits(!showWaits)} icon={<Timer size={16} />} label="Waits" />
            </div>
            <div className="flex flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_8px_30px_rgba(21,23,27,0.14)]">
              <MapBtn label="Zoom in" onClick={() => mapRef.current?.zoomIn()}><Plus size={18} /></MapBtn>
              <MapBtn label="Zoom out" onClick={() => mapRef.current?.zoomOut()}><Minus size={18} /></MapBtn>
              <MapBtn label={tilted ? 'Flat view' : '3D view'} onClick={toggleTilt}><Box size={18} /></MapBtn>
              <MapBtn label="Reset view" onClick={() => { setSelected(null); mapRef.current?.flyTo({ ...HOME_CAM, pitch: tilted ? 55 : 0, duration: 1400 }); }}><Compass size={18} /></MapBtn>
            </div>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-3 hidden flex-wrap items-center gap-3 rounded-xl bg-surface/95 px-3.5 py-2.5 text-[11px] font-bold text-ink-2 sm:flex">
            <span className="flex items-center gap-1.5"><span className="h-2 w-6 rounded-full bg-[linear-gradient(90deg,#F7D6C4,#E46A3A,#A03210)]" />Demand</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#1E9E5A]" />Wait &lt;8m</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber" />8–18m</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-danger" />&gt;18m</span>
            <span className="font-semibold text-muted">· City avg ₹{cityAvg}/hr</span>
          </div>

          {/* Detail card */}
          <AnimatePresence>
            {sel && (
              <motion.div
                key={sel.id}
                initial={{ opacity: 0, y: 24, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-3 right-3 w-[min(310px,calc(100%-24px))] rounded-[22px] bg-surface p-5 shadow-[0_14px_44px_rgba(21,23,27,0.2)]"
              >
                <ZoneDetail z={sel} cityAvg={cityAvg} apps={bestApps(sel, myApps)} onClose={() => setSelected(null)} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

function ZoneCard({ z, rank, selected, hour, rain, onClick }: { z: ZoneState; rank: number; selected: boolean; hour: number; rain: boolean; onClick: () => void }) {
  const bars = [8, 10, 12, 14, 16, 18, 20, 22].map((h) => ({ h, m: hourMultiplier(h, z.profile) }));
  const tag = z.boost > 2 ? ['Match surge', 'bg-heat-soft text-[#B8431D]']
    : rank === 1 ? ['Hottest now', 'bg-heat-soft text-[#B8431D]']
      : rain && rank <= 4 ? ['Rain surge', 'bg-info-soft text-[#1F5A94]']
        : z.profile === 'lunch' && periodLabel(hour) === 'Lunch rush' && rank <= 5 ? ['Tech-park lunch', 'bg-money-soft text-[#075C3B]'] : null;
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`flex w-full cursor-pointer items-center gap-3.5 rounded-[18px] border-[1.5px] bg-surface p-3 text-left shadow-[0_1px_2px_rgba(21,23,27,0.05)] transition hover:-translate-y-0.5 hover:shadow-md ${selected ? 'border-ink' : 'border-line'}`}>
      <span className="flex h-[72px] w-[72px] shrink-0 items-end gap-[3px] rounded-xl bg-heat-soft p-2.5" aria-hidden="true">
        {bars.map((b) => (
          <span key={b.h} className="block flex-1 rounded-[2px]" style={{ height: `${Math.round(8 + 40 * b.m / 1.15)}px`, background: Math.abs(b.h - hour) <= 1 ? '#D9501F' : '#F2B9A0' }} />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="num text-xs font-extrabold text-muted">#{rank}</span>
          <span className="truncate text-[16px] font-extrabold">{z.name}</span>
          {tag && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${tag[1]}`}>{tag[0]}</span>}
        </span>
        <span className="text-xs font-semibold text-muted">{z.area} · {z.ridersNow} riders here</span>
        <span className="flex items-baseline gap-3">
          <span className="num text-[22px] font-extrabold text-money">₹{z.rate}<span className="text-[13px] font-semibold text-muted">/hr</span></span>
          <span className="text-xs font-bold text-ink-2">{z.orders} orders/hr</span>
          <span className="text-xs font-bold text-ink-2">{z.waitNow}m wait</span>
        </span>
      </span>
    </button>
  );
}

function ZoneDetail({ z, cityAvg, apps, onClose }: { z: ZoneState; cityAvg: number; apps: ReturnType<typeof bestApps>; onClose: () => void }) {
  const delta = z.rate - cityAvg;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-col">
          <span className="font-display text-xl font-extrabold tracking-tight">{z.name}</span>
          <span className="text-xs font-semibold text-muted">{z.area}</span>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border border-line hover:bg-paper"><X size={16} /></button>
      </div>
      <div>
        <span className="text-xs font-bold text-muted">Expected earnings now</span>
        <div className="num text-[34px] font-extrabold leading-none text-money">₹{z.rate}<span className="text-base font-semibold text-muted">/hr</span></div>
        <span className={`text-xs font-extrabold ${delta >= 0 ? 'text-money' : 'text-danger'}`}>{delta >= 0 ? '+' : '−'}₹{Math.abs(delta)}/hr vs city average</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[[z.orders, 'orders/hr'], [`${z.waitNow}m`, 'avg wait'], [z.ridersNow, 'riders here']].map(([v, l]) => (
          <div key={l as string} className="rounded-xl bg-paper px-2.5 py-2"><div className="num text-base font-extrabold">{v}</div><div className="text-[11px] font-bold text-muted">{l}</div></div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-extrabold text-ink-2">Best of your apps here (est.)</span>
        {apps.map((a) => (
          <div key={a.id} className="flex items-center gap-2 text-[13px] font-bold">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: a.color }} />
            <span className="flex-1">{a.name}</span>
            <span className="num font-extrabold">₹{a.value}</span><span className="w-12 text-xs font-semibold text-muted">{a.unit}</span>
          </div>
        ))}
      </div>
      <a
        href={`https://www.google.com/maps/dir/?api=1&destination=${z.lat},${z.lng}&travelmode=driving`}
        target="_blank"
        rel="noreferrer"
        className="flex h-12 items-center justify-center gap-2 rounded-xl bg-ink text-sm font-extrabold text-white transition hover:bg-ink/90"
      >
        <Navigation size={17} /> Guide me here
      </a>
    </div>
  );
}

function Toggle({ on, onClick, tone, icon, children }: { on: boolean; onClick: () => void; tone: 'info' | 'heat'; icon: React.ReactNode; children: React.ReactNode }) {
  const onCls = tone === 'info' ? 'border-info bg-info-soft text-[#1F5A94]' : 'border-heat bg-heat-soft text-[#B8431D]';
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`flex h-11 cursor-pointer items-center gap-2 rounded-xl border-[1.5px] px-3.5 text-sm font-extrabold transition ${on ? onCls : 'border-line bg-surface hover:border-ink/30'}`}>
      {icon}{children}
    </button>
  );
}

function IconToggle({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={`flex h-9 cursor-pointer items-center gap-1.5 rounded-xl px-3 text-[13px] font-extrabold transition ${on ? 'bg-ink text-white' : 'text-ink-2 hover:bg-paper'}`}>
      {icon}{label}
    </button>
  );
}

function MapBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className="flex h-11 w-11 cursor-pointer items-center justify-center border-b border-line last:border-0 hover:bg-paper">
      {children}
    </button>
  );
}
