'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useMemo, useState, useTransition } from 'react';
import { ArrowRight, Crown, Database, LoaderCircle, Map, Mic, Navigation, Scale, Timer, Trash2, Upload } from 'lucide-react';
import { useProfile } from '@/components/app/ProfileContext';
import { trialStatus } from '@/lib/plan';
import { WeatherCard } from '@/components/weather/WeatherBits';
import { useWeatherReport } from '@/components/weather/WeatherContext';
import { CountTo } from '@/components/landing/motion-bits';
import { clearDemoData, seedDemoWeek } from '@/app/actions/rider';
import { dayStats, type EarningRow, type WaitRow } from '@/lib/calc';
import { addDaysISO, prettyDate, rupees } from '@/lib/dates';
import { istHour, istTime, useNow } from '@/lib/clock';
import { periodLabel, platformById, zoneStates } from '@/lib/geo';

const GREETING = { en: 'Namaskara', hi: 'नमस्ते', kn: 'ನಮಸ್ಕಾರ' } as const;

export default function Dashboard({ today, earnings, waits }: { today: string; earnings: EarningRow[]; waits: WaitRow[] }) {
  const { profile } = useProfile();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => dayStats(addDaysISO(today, i - 6), earnings, waits, profile)),
    [today, earnings, waits, profile],
  );
  const d = days[6];
  const hasToday = d.orders > 0;
  const hasAny = earnings.length > 0;
  const hasSeed = earnings.some((e) => e.source === 'seed');

  const now = useNow();
  const weather = useWeatherReport();
  const hour = istHour(now ?? undefined);
  const top = zoneStates({ hour, rain: weather?.now.raining }).filter((z) => z.id !== 'chs')[0];
  const target = Number(profile.daily_target);
  const progress = Math.max(0, Math.min(1, d.net / target));
  const toGo = Math.max(0, target - d.net);

  const run = (fn: () => Promise<{ error?: string }>, ok: string) => start(async () => {
    const res = await fn();
    setMsg(res.error ? res.error : ok);
  });

  return (
    <main className="mx-auto flex max-w-[1240px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <header className="flex flex-wrap items-end gap-4">
        <div className="flex-1">
          <p className="text-sm font-bold text-muted">{prettyDate(today)}{now !== null && <> · <span className="num">{istTime(now)}</span></>}</p>
          <h1 className="mt-1 font-display text-[clamp(32px,4.4vw,48px)] font-extrabold leading-[1.15] tracking-[-0.04em]">
            <span lang={profile.language}>{GREETING[profile.language]}</span>, {profile.name.split(' ')[0] || 'rider'}.
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/app/plan" className="flex h-11 items-center gap-2 rounded-xl bg-money-soft px-4 text-sm font-extrabold text-[#075C3B] hover:brightness-95">
            <Crown size={16} /> Free trial · {trialStatus(profile.created_at).daysLeft} days left
          </Link>
          {hasSeed ? (
            <button type="button" disabled={pending} onClick={() => run(clearDemoData, 'Demo data cleared.')} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-extrabold hover:border-ink/30 disabled:opacity-50">
              {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />} Clear demo data
            </button>
          ) : (
            <button type="button" disabled={pending} onClick={() => run(seedDemoWeek, 'Demo week loaded.')} className="flex h-11 cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-extrabold hover:border-ink/30 disabled:opacity-50">
              {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Database size={16} />} Load demo week
            </button>
          )}
        </div>
      </header>
      {msg && <p role="status" className="rounded-2xl bg-money-soft px-4 py-2.5 text-sm font-bold text-[#075C3B]">{msg}</p>}

      {!hasAny ? (
        <EmptyState pending={pending} onSeed={() => run(seedDemoWeek, 'Demo week loaded.')} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Goal ring */}
          <Card className="relative overflow-hidden bg-night text-night-text lg:col-span-5" dark>
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-glow-money/20 blur-[70px]" />
            <div className="relative flex items-center gap-6">
              <Ring progress={progress} />
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-extrabold uppercase tracking-[0.18em] text-night-muted">Today · take-home</span>
                <span className="num text-[40px] font-extrabold leading-none text-glow-money"><CountTo from={0} to={Math.round(d.net)} prefix="₹" delay={0.1} duration={1.2} onMount /></span>
                <span className="text-sm font-bold text-night-muted">of {rupees(target)} goal</span>
                <span className="mt-2 text-[15px] font-extrabold">{toGo > 0 ? `${rupees(toGo)} to go` : 'Goal reached. Nice work.'}</span>
                {toGo > 0 && <span className="text-[13px] font-semibold text-night-text/70">≈ {(toGo / top.rate).toFixed(1)} hrs in {top.name} at {periodLabel(hour).toLowerCase()} rates</span>}
              </div>
            </div>
          </Card>

          {/* True wage */}
          <Card className="lg:col-span-7">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold">Your real hourly wage</h2>
              <span className="text-xs font-bold text-muted">{hasToday ? 'today' : 'no orders today yet'}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-paper p-4">
                <p className="text-xs font-bold text-muted">What apps show</p>
                <p className="num text-[34px] font-extrabold leading-tight text-muted line-through decoration-danger decoration-[3px]">{rupees(d.shownHourly)}<span className="text-base">/hr</span></p>
              </div>
              <div className="rounded-2xl bg-ink p-4 text-white">
                <p className="text-xs font-bold text-white/70">What you really earn</p>
                <p className="num text-[34px] font-extrabold leading-tight text-glow-money"><CountTo from={Math.round(d.shownHourly)} to={Math.round(d.trueHourly)} prefix="₹" onMount /><span className="text-base">/hr</span></p>
              </div>
            </div>
            <dl className="mt-4 grid gap-2 text-sm font-semibold sm:grid-cols-2 sm:gap-x-8">
              <Line k={`App earnings · ${d.orders} orders, ${d.activeHours.toFixed(1)} hrs on orders`} v={rupees(d.gross)} />
              <Line k={`Fuel · ${Math.round(d.distance)} km`} v={`−${rupees(d.fuel)}`} bad />
              <Line k="EMI + phone · today's share" v={`−${rupees(d.fixed)}`} bad />
              <Line k="Hours logged in, incl. waiting" v={`${d.totalHours.toFixed(1)} hrs`} />
            </dl>
          </Card>

          <WeatherCard report={weather} />

          {/* Waiting */}
          <Card className="flex items-center gap-4 bg-amber-soft lg:col-span-5">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface text-[#8A5600]"><Timer size={26} /></span>
            <div className="flex-1">
              <p className="text-[16px] font-extrabold text-[#5C3A00]">{Math.round(d.waitMin)} min unpaid waiting today</p>
              <p className="text-[13px] font-semibold text-[#6B4700]">
                Worth {rupees(d.waitCost)} of your time{d.worstWait ? ` · Worst: ${d.worstWait.restaurant_name}, ${Math.round(d.worstWait.duration_min)} min` : ''}
              </p>
            </div>
            <Link href="/app/wait" className="flex h-11 items-center gap-1.5 rounded-xl bg-surface px-4 text-sm font-extrabold">Start timer</Link>
          </Card>

          {/* Go here */}
          <Card className="bg-ink text-white lg:col-span-7" dark>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-heat px-2.5 py-0.5 text-[11px] font-extrabold">{periodLabel(hour)}</span>
                  <span className="text-xs font-bold text-white/60">Suggested move</span>
                </div>
                <p className="mt-2 font-display text-2xl font-extrabold tracking-tight">Go to {top.name}</p>
                <p className="text-sm font-semibold text-white/70">{rupees(top.rate)}/hr expected · {top.orders} orders/hr · {top.waitNow} min avg wait</p>
              </div>
              <div className="flex gap-2">
                <Link href="/app/pulse" className="flex h-12 items-center gap-2 rounded-xl border border-white/20 px-4 text-sm font-extrabold hover:bg-white/10"><Map size={17} /> City Pulse</Link>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${top.lat},${top.lng}&travelmode=driving`} target="_blank" rel="noreferrer" className="flex h-12 items-center gap-2 rounded-xl bg-white px-4 text-sm font-extrabold text-ink"><Navigation size={17} /> Guide me</a>
              </div>
            </div>
          </Card>

          {/* Week */}
          <Card className="lg:col-span-7">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold">Last 7 days · take-home</h2>
              <span className="text-xs font-bold text-muted">avg {rupees(weekAvg(days))}/hr real</span>
            </div>
            <WeekChart days={days} target={target} />
          </Card>

          {/* By app */}
          <Card className="lg:col-span-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-extrabold">By app today</h2>
              <span className="text-xs font-bold text-muted">gross {rupees(d.gross)}</span>
            </div>
            <div className="mt-4 flex flex-col gap-3.5">
              {d.byPlatform.length === 0 && <p className="text-sm font-semibold text-muted">No orders logged today.</p>}
              {d.byPlatform.map((p) => {
                const meta = platformById(p.platform);
                const w = d.byPlatform[0].gross ? (p.gross / d.byPlatform[0].gross) * 100 : 0;
                return (
                  <div key={p.platform} className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2.5 text-sm font-bold">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta?.color }} />
                      <span className="flex-1">{meta?.name ?? p.platform} · {p.orders} {['rapido', 'uber', 'ola'].includes(p.platform) ? 'rides' : 'orders'}</span>
                      <span className="num font-extrabold">{rupees(p.gross)}</span>
                    </div>
                    <span className="block h-2 rounded-full bg-paper">
                      <motion.span className="block h-2 rounded-full" style={{ background: meta?.color }} initial={{ width: 0 }} animate={{ width: `${w}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:col-span-12">
            <Quick href="/app/wait" icon={<Timer size={22} />} label="Start wait timer" />
            <Quick href="/app/import" icon={<Upload size={22} />} label="Upload screenshot" />
            <Quick href="/app/log" icon={<Mic size={22} />} label="Say it, we log it" />
            <Quick href="/app/appeal" icon={<Scale size={22} />} label="Appeal / complaint" />
          </nav>
        </div>
      )}
    </main>
  );
}

function weekAvg(days: ReturnType<typeof dayStats>[]) {
  const worked = days.filter((x) => x.orders > 0);
  return worked.length ? worked.reduce((s, x) => s + x.trueHourly, 0) / worked.length : 0;
}

function Card({ children, className = '', dark = false }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-[24px] p-5 sm:p-6 ${dark ? '' : 'bg-surface shadow-[0_1px_2px_rgba(21,23,27,0.05)]'} ${className}`}
    >
      {children}
    </motion.section>
  );
}

function Line({ k, v, bad = false }: { k: string; v: string; bad?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-line py-1.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className={`num font-extrabold ${bad ? 'text-danger' : ''}`}>{v}</dd>
    </div>
  );
}

function Ring({ progress }: { progress: number }) {
  const r = 62, c = 2 * Math.PI * r;
  return (
    <svg width="150" height="150" viewBox="0 0 150 150" className="shrink-0" role="img" aria-label={`${Math.round(progress * 100)}% of daily goal`}>
      <circle cx="75" cy="75" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" />
      <motion.circle cx="75" cy="75" r={r} fill="none" stroke="#6EE0A4" strokeWidth="14" strokeLinecap="round" transform="rotate(-90 75 75)"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - progress) }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} />
      <text x="75" y="84" textAnchor="middle" className="num" fill="#ECEEF3" fontSize="26" fontWeight="800">{Math.round(progress * 100)}%</text>
    </svg>
  );
}

function WeekChart({ days, target }: { days: ReturnType<typeof dayStats>[]; target: number }) {
  const max = Math.max(target, ...days.map((d) => d.net)) * 1.1;
  return (
    <div className="relative mt-5 h-48">
      <div className="absolute inset-x-0 border-t-2 border-dashed border-money/40" style={{ bottom: `${(target / max) * 100}%` }}>
        <span className="absolute -top-5 right-0 text-[11px] font-extrabold text-money">goal {rupees(target)}</span>
      </div>
      <div className="absolute inset-0 flex items-end gap-2 sm:gap-3">
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="num text-[11px] font-extrabold opacity-0 transition group-hover:opacity-100">{rupees(d.net)}</span>
              <motion.span
                className={`block w-full rounded-t-lg ${isToday ? 'bg-ink' : 'bg-[#D5D9CE] group-hover:bg-[#BFC4B7]'}`}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(2, (Math.max(0, d.net) / max) * 100)}%` }}
                transition={{ duration: 0.8, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              />
              <span className={`text-[11px] font-extrabold ${isToday ? 'text-ink' : 'text-muted'}`}>{isToday ? 'Today' : prettyDate(d.date, { weekday: 'short' })}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Quick({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="group flex h-24 flex-col justify-between rounded-[20px] bg-surface p-4 shadow-[0_1px_2px_rgba(21,23,27,0.05)] transition hover:-translate-y-0.5 hover:shadow-md">
      {icon}
      <span className="flex items-center justify-between text-[15px] font-extrabold">{label}<ArrowRight size={16} className="opacity-0 transition group-hover:opacity-100" /></span>
    </Link>
  );
}

function EmptyState({ pending, onSeed }: { pending: boolean; onSeed: () => void }) {
  return (
    <section className="relative overflow-hidden rounded-[28px] bg-night p-8 text-night-text sm:p-12">
      <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-glow-heat/25 blur-[90px]" />
      <h2 className="relative max-w-xl font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-[0.98] tracking-[-0.04em]">
        No rides logged yet. <span className="font-serif font-normal italic text-glow-heat">Let&apos;s fix that.</span>
      </h2>
      <p className="relative mt-3 max-w-lg font-medium text-night-text/70">Upload a payout screenshot from any app, time your next restaurant wait, or load a demo week to see how Kilometre works.</p>
      <div className="relative mt-7 flex flex-wrap gap-3">
        <button type="button" disabled={pending} onClick={onSeed} className="flex h-13 cursor-pointer items-center gap-2 rounded-2xl bg-glow-heat px-6 font-extrabold text-night disabled:opacity-60">
          {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Database size={18} />} Load demo week
        </button>
        <Link href="/app/import" className="flex h-13 items-center gap-2 rounded-2xl border border-white/20 px-6 font-extrabold hover:bg-white/10"><Upload size={18} /> Upload screenshot</Link>
        <Link href="/app/wait" className="flex h-13 items-center gap-2 rounded-2xl border border-white/20 px-6 font-extrabold hover:bg-white/10"><Timer size={18} /> Start wait timer</Link>
      </div>
    </section>
  );
}
