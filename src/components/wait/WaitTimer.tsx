'use client';

import { motion } from 'motion/react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { AlertTriangle, Check, LoaderCircle, LocateFixed, MapPin, Search, Timer, X } from 'lucide-react';
import { useProfile } from '@/components/app/ProfileContext';
import { saveWaitLog } from '@/app/actions/rider';
import type { WaitRow } from '@/lib/calc';
import { rupees } from '@/lib/dates';
import { PLATFORMS, RESTAURANTS, ZONES, type Platform } from '@/lib/geo';

type Place = { id: string | null; name: string; zone: string | null; lat: number | null; lng: number | null };
type Running = { place: Place; platform: Platform | null; startedAt: string };
const KEY = 'kilometre-wait-running';

const distKm = (a: [number, number], b: [number, number]) => {
  const R = 6371, toR = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toR, dLng = (b[0] - a[0]) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toR) * Math.cos(b[1] * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const tone = (min: number) =>
  min < 8 ? { stroke: '#0B7A4F', soft: '#E4F3EB', text: 'text-[#075C3B]', label: 'Normal wait' }
    : min < 15 ? { stroke: '#E8A317', soft: '#FFF3D6', text: 'text-[#8A5600]', label: 'Getting long' }
      : { stroke: '#C22F3D', soft: '#FDE8EA', text: 'text-[#A3202E]', label: 'Over 15 min · this time is unpaid' };

function loadRunning(): Running | null {
  try { return JSON.parse(localStorage.getItem(KEY) ?? 'null'); } catch { return null; }
}

export default function WaitTimer({ ratePerHour, recent }: { ratePerHour: number; recent: WaitRow[] }) {
  const { profile } = useProfile();
  const [running, setRunning] = useState<Running | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [platform, setPlatform] = useState<Platform | null>(profile.platforms[0] ?? null);
  const [here, setHere] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [done, setDone] = useState<{ name: string; min: number; cost: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Survive reloads and app switches: a running timer lives in localStorage.
  // Read after hydration: the server can't see localStorage, so the first render must match it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setRunning(loadRunning()); }, []);
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const options = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = RESTAURANTS.map((r) => ({ ...r, km: here ? distKm(here, [r.lng, r.lat]) : null, zoneName: ZONES.find((z) => z.id === r.zone)?.name ?? '' }));
    if (q) list = list.filter((r) => r.name.toLowerCase().includes(q) || r.zoneName.toLowerCase().includes(q));
    if (here) list.sort((a, b) => (a.km ?? 0) - (b.km ?? 0));
    return list.slice(0, 6);
  }, [query, here]);

  const locate = () => {
    if (!navigator.geolocation) { setError('Location is not available on this device.'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setHere(p);
        setLocating(false);
        const nearest = RESTAURANTS.map((r) => ({ r, km: distKm(p, [r.lng, r.lat]) })).sort((a, b) => a.km - b.km)[0];
        if (nearest && nearest.km < 0.4) setPlace({ id: nearest.r.id, name: nearest.r.name, zone: nearest.r.zone, lat: nearest.r.lat, lng: nearest.r.lng });
      },
      () => { setLocating(false); setError('Could not get your location. Search for the restaurant instead.'); },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const begin = () => {
    const chosen = place ?? (query.trim() ? { id: null, name: query.trim(), zone: null, lat: here?.[1] ?? null, lng: here?.[0] ?? null } : null);
    if (!chosen) { setError('Pick the restaurant first.'); return; }
    const r: Running = { place: chosen, platform, startedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(r));
    setRunning(r);
    setNow(Date.now());
    setDone(null);
    setError(null);
  };

  const cancel = () => { localStorage.removeItem(KEY); setRunning(null); };

  const stop = () => {
    if (!running) return;
    const endedAt = new Date().toISOString();
    start(async () => {
      const res = await saveWaitLog({
        restaurant_id: running.place.id,
        restaurant_name: running.place.name,
        zone: running.place.zone,
        platform: running.platform,
        started_at: running.startedAt,
        ended_at: endedAt,
        lat: running.place.lat,
        lng: running.place.lng,
      });
      if (res.error) { setError(res.error); return; }
      const min = (Date.parse(endedAt) - Date.parse(running.startedAt)) / 60000;
      setDone({ name: running.place.name, min, cost: (min * ratePerHour) / 60 });
      localStorage.removeItem(KEY);
      setRunning(null);
      setPlace(null);
      setQuery('');
    });
  };

  const elapsedMs = running ? Math.max(0, now - Date.parse(running.startedAt)) : 0;
  const elapsedMin = elapsedMs / 60000;
  const t = tone(elapsedMin);
  const mm = String(Math.floor(elapsedMs / 60000)).padStart(2, '0');
  const ss = String(Math.floor((elapsedMs % 60000) / 1000)).padStart(2, '0');
  const known = running?.place.id ? RESTAURANTS.find((r) => r.id === running.place.id) : null;
  const r = 104, c = 2 * Math.PI * r;
  const ringProgress = Math.min(1, elapsedMin / 25);

  return (
    <main className="mx-auto grid max-w-[1100px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_380px] lg:py-8">
      <section className="flex flex-col gap-4">
        <header>
          <h1 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-none tracking-[-0.04em]">{running ? 'Waiting at pickup' : 'Wait timer'}</h1>
          <p className="mt-2 text-[15px] font-medium text-muted">Tap when you reach the restaurant and again when the food is ready. Your reports build the city&apos;s wait-time map.</p>
        </header>

          {running ? (
            <motion.div key="running" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col gap-4">
              <div className="flex items-center gap-3 rounded-[20px] bg-surface p-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-heat-soft text-heat"><MapPin size={22} /></span>
                <div className="flex-1">
                  <p className="text-[17px] font-extrabold">{running.place.name}</p>
                  <p className="text-xs font-semibold text-muted">
                    {ZONES.find((z) => z.id === running.place.zone)?.name ?? 'Custom location'}
                    {running.platform ? ` · ${PLATFORMS.find((p) => p.id === running.platform)?.name}` : ''}
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 rounded-[28px] bg-surface p-8">
                <div className="relative h-[240px] w-[240px]">
                  <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
                    <circle cx="120" cy="120" r={r} fill="none" stroke={t.soft} strokeWidth="16" />
                    <circle cx="120" cy="120" r={r} fill="none" stroke={t.stroke} strokeWidth="16" strokeLinecap="round" transform="rotate(-90 120 120)"
                      strokeDasharray={c} strokeDashoffset={c * (1 - ringProgress)} style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.6s' }} />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="num text-[60px] font-extrabold leading-none tracking-[-0.03em]" aria-live="off">{mm}:{ss}</span>
                    <span className="mt-1 text-[13px] font-bold text-muted">minutes waiting</span>
                  </div>
                  {elapsedMin >= 15 && <span className="pulse-ring absolute inset-6 rounded-full border-4" style={{ borderColor: t.stroke }} />}
                </div>
                <span className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-extrabold ${t.text}`} style={{ background: t.soft }}>
                  {elapsedMin >= 15 && <AlertTriangle size={15} />}{t.label}
                </span>
                <p className="text-center text-[15px] font-bold text-ink-2">
                  At your real rate of {rupees(ratePerHour)}/hr, this wait has cost you <span className="num text-ink">{rupees((elapsedMin * ratePerHour) / 60)}</span>
                </p>
              </div>

              {known && (
                <div className="grid grid-cols-3 gap-2 rounded-[20px] bg-surface p-4">
                  <Stat v={`${known.avgWait}m`} l="avg wait here" />
                  <Stat v={String(known.reports)} l="rider reports" />
                  <Stat v={known.avgWait > 15 ? 'Slow' : known.avgWait > 8 ? 'Average' : 'Fast'} l="kitchen" />
                </div>
              )}

              {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{error}</p>}
              <button type="button" onClick={stop} disabled={pending} className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-money text-lg font-extrabold text-white transition hover:brightness-110 disabled:opacity-60">
                {pending ? <LoaderCircle className="animate-spin" /> : <><Check size={22} /> Picked up · stop timer</>}
              </button>
              <button type="button" onClick={cancel} className="flex h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-surface font-extrabold"><X size={18} /> Order cancelled · discard</button>
            </motion.div>
          ) : (
            <motion.div key="idle" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
              {done && (
                <div className="flex items-center gap-3 rounded-[20px] bg-money-soft p-4 text-[#075C3B]">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-money text-white"><Check size={20} /></span>
                  <p className="text-[15px] font-bold">Saved {Math.max(1, Math.round(done.min))} min at {done.name}. That was {rupees(done.cost)} of your time.</p>
                </div>
              )}
              <div className="rounded-[24px] bg-surface p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex h-13 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-line px-4 focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
                    <Search size={18} className="text-muted" />
                    <span className="sr-only">Restaurant</span>
                    <input value={query} onChange={(e) => { setQuery(e.target.value); setPlace(null); }} placeholder="Search restaurant or area" className="min-w-0 flex-1 bg-transparent font-semibold outline-none" />
                  </label>
                  <button type="button" onClick={locate} className="flex h-13 cursor-pointer items-center gap-2 rounded-2xl border border-line px-4 font-extrabold hover:border-ink/30">
                    {locating ? <LoaderCircle size={18} className="animate-spin" /> : <LocateFixed size={18} />} Near me
                  </button>
                </div>
                <ul className="mt-3 flex flex-col gap-1.5">
                  {options.map((o) => {
                    const sel = place?.id === o.id;
                    return (
                      <li key={o.id}>
                        <button type="button" onClick={() => setPlace({ id: o.id, name: o.name, zone: o.zone, lat: o.lat, lng: o.lng })} aria-pressed={sel}
                          className={`flex w-full cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-3.5 py-3 text-left transition ${sel ? 'border-ink bg-paper' : 'border-transparent hover:bg-paper'}`}>
                          <MapPin size={17} className="text-muted" />
                          <span className="flex-1"><span className="block text-[15px] font-extrabold">{o.name}</span><span className="text-xs font-semibold text-muted">{o.zoneName}{o.km !== null ? ` · ${o.km < 1 ? `${Math.round(o.km * 1000)} m` : `${o.km.toFixed(1)} km`}` : ''}</span></span>
                          <span className="num text-sm font-extrabold text-muted">{o.avgWait}m avg</span>
                        </button>
                      </li>
                    );
                  })}
                  {query.trim() && !options.length && <li className="px-3 py-2 text-sm font-semibold text-muted">Not in our list. We&apos;ll save &ldquo;{query.trim()}&rdquo; as a new place.</li>}
                </ul>
                <p className="mt-3 text-xs font-semibold text-muted">Demo restaurants are fictional.</p>
              </div>

              <fieldset className="flex flex-wrap gap-2">
                <legend className="mb-2 text-[13px] font-extrabold text-ink-2">Order from</legend>
                {profile.platforms.map((id) => {
                  const p = PLATFORMS.find((x) => x.id === id)!;
                  return (
                    <button key={id} type="button" aria-pressed={platform === id} onClick={() => setPlatform(id)}
                      className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-extrabold transition ${platform === id ? 'border-ink bg-surface' : 'border-line bg-surface/60'}`}>
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} />{p.name}
                    </button>
                  );
                })}
              </fieldset>

              {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{error}</p>}
              <button type="button" onClick={begin} className="flex h-16 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink text-lg font-extrabold text-white transition hover:bg-ink/90">
                <Timer size={22} /> I&apos;ve arrived · start timer
              </button>
            </motion.div>
          )}
      </section>

      <aside className="flex flex-col gap-3">
        <h2 className="text-[15px] font-extrabold">Recent waits</h2>
        {recent.length === 0 && <p className="rounded-2xl bg-surface p-4 text-sm font-semibold text-muted">No waits logged yet.</p>}
        <ol className="flex flex-col gap-2">
          {recent.slice(0, 8).map((w) => {
            const m = Number(w.duration_min);
            const tt = tone(m);
            return (
              <li key={w.id} className="flex items-center gap-3 rounded-2xl bg-surface p-3">
                <span className={`num flex h-11 w-12 items-center justify-center rounded-xl text-base font-extrabold ${tt.text}`} style={{ background: tt.soft }}>{Math.round(m)}m</span>
                <span className="flex-1">
                  <span className="block text-sm font-extrabold">{w.restaurant_name}</span>
                  <span className="text-xs font-semibold text-muted">{new Date(w.started_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </aside>
    </main>
  );
}

function Stat({ v, l }: { v: string; l: string }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2.5">
      <div className="num text-lg font-extrabold">{v}</div>
      <div className="text-[11px] font-bold text-muted">{l}</div>
    </div>
  );
}
