'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'motion/react';
import { BellRing, Check, CloudRain, Crown, Map, Scale, ScanLine, ShieldCheck, Sparkles, Timer, Wallet } from 'lucide-react';
import { useProfile } from '@/components/app/ProfileContext';
import { PRICE_PER_MONTH, TRIAL_DAYS, trialStatus } from '@/lib/plan';

const INCLUDED = [
  { icon: Wallet, text: 'Real hourly wage across every app' },
  { icon: Map, text: 'City Pulse 3D demand map, every hour' },
  { icon: CloudRain, text: 'Live rain alerts and forecasts' },
  { icon: ScanLine, text: 'Unlimited AI screenshot imports' },
  { icon: Scale, text: 'Unlimited AI appeals and complaints' },
  { icon: Timer, text: 'Restaurant wait timer and wait map' },
  { icon: BellRing, text: 'Browser alerts for rain and surges' },
  { icon: ShieldCheck, text: 'Your data stays private to you' },
];

const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

export default function PlanView({ createdAt }: { createdAt: string | null }) {
  const { profile } = useProfile();
  const t = trialStatus(createdAt);
  const [note, setNote] = useState<string | null>(null);

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-6 px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-muted">Kilometre Pro</p>
        <h1 className="mt-1 font-display text-[clamp(32px,4.6vw,52px)] font-extrabold leading-[0.98] tracking-[-0.04em]">
          {TRIAL_DAYS} days free. <span className="font-serif font-normal italic text-heat">Then ₹{PRICE_PER_MONTH} a month.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] font-medium text-muted">
          Less than one delivery a week. If Kilometre helps you earn even ₹100 more a month, it pays for itself.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Trial status */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] bg-night p-7 text-night-text">
          <div className="absolute -right-16 -top-16 h-60 w-60 rounded-full bg-glow-money/20 blur-[70px]" />
          <div className="relative flex items-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-extrabold ${t.active ? 'bg-glow-money/15 text-glow-money' : 'bg-glow-heat/15 text-glow-heat'}`}>
              {t.active ? 'Free trial active' : 'Trial ended'}
            </span>
            <span className="text-xs font-bold text-night-muted">{profile.name ? `for ${profile.name.split(' ')[0]}` : ''}</span>
          </div>
          <p className="relative mt-5 font-display text-[64px] font-extrabold leading-none tracking-[-0.04em]">
            {t.daysLeft}<span className="ml-2 text-2xl text-night-muted">days left</span>
          </p>
          <div className="relative mt-5 h-2.5 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`${t.used} of ${TRIAL_DAYS} trial days used`}>
            <motion.span className="block h-full rounded-full bg-glow-money" initial={{ width: 0 }} animate={{ width: `${Math.max(3, t.progress * 100)}%` }} transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }} />
          </div>
          <div className="relative mt-2 flex justify-between text-xs font-bold text-night-muted">
            <span>Started {fmt(t.start)}</span>
            <span>{t.active ? `Free until ${fmt(t.end)}` : `Ended ${fmt(t.end)}`}</span>
          </div>
          <p className="relative mt-6 text-[15px] font-medium leading-relaxed text-night-text/75">
            Everything is unlocked during your trial. No card needed to start, and we will remind you before it ends.
          </p>
          <Link href="/app" className="relative mt-6 inline-flex h-12 items-center gap-2 rounded-2xl bg-white px-5 text-sm font-extrabold text-ink">
            Keep using Kilometre
          </Link>
        </motion.section>

        {/* Price card */}
        <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="flex flex-col rounded-[28px] border-[1.5px] border-ink bg-surface p-7">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-heat-soft text-heat"><Crown size={20} /></span>
            <span className="font-display text-xl font-extrabold">Kilometre Pro</span>
            <span className="ml-auto rounded-full bg-money-soft px-2.5 py-1 text-[11px] font-extrabold text-[#075C3B]">{TRIAL_DAYS} days free</span>
          </div>
          <p className="mt-5 flex items-baseline gap-1">
            <span className="num text-[56px] font-extrabold leading-none tracking-tight">₹{PRICE_PER_MONTH}</span>
            <span className="text-base font-bold text-muted">/ month after trial</span>
          </p>
          <p className="mt-1 text-sm font-semibold text-muted">About ₹3 a day · cancel anytime · pay by UPI</p>
          <ul className="mt-5 flex flex-col gap-2.5">
            {INCLUDED.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-[14px] font-semibold">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-paper"><Icon size={15} /></span>
                {text}
                <Check size={16} className="ml-auto shrink-0 text-money" />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setNote(`You're on the free trial until ${fmt(t.end)}. UPI autopay for ₹${PRICE_PER_MONTH}/month switches on after the pilot.`)}
            className="mt-6 flex h-13 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink text-[15px] font-extrabold text-white transition hover:bg-ink/90">
            <Sparkles size={18} /> {t.active ? 'Continue after trial · ₹99/month' : `Subscribe · ₹${PRICE_PER_MONTH}/month`}
          </button>
          {note && <p role="status" className="mt-3 rounded-2xl bg-money-soft px-4 py-3 text-sm font-bold text-[#075C3B]">{note}</p>}
        </motion.section>
      </div>

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          ['1', 'Day 1–30', 'Everything free. Try every feature, no card needed.'],
          ['2', 'Day 27', 'We remind you in the app that your trial is ending.'],
          ['3', 'Day 31+', `₹${PRICE_PER_MONTH}/month by UPI. Cancel anytime in one tap.`],
        ].map(([n, h, b]) => (
          <div key={n} className="rounded-[20px] bg-surface p-5">
            <span className="num flex h-8 w-8 items-center justify-center rounded-full bg-heat-soft text-sm font-extrabold text-heat">{n}</span>
            <p className="mt-3 text-[15px] font-extrabold">{h}</p>
            <p className="mt-1 text-[13px] font-semibold text-muted">{b}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
