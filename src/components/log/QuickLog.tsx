'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { CheckCircle2, LoaderCircle, Send, Timer, Trash2, Wallet } from 'lucide-react';
import { useProfile } from '@/components/app/ProfileContext';
import MicButton from '@/components/ui/MicButton';
import { commitImport, commitWaits } from '@/app/actions/ai';
import type { ParsedLog } from '@/lib/ai/schemas';
import { rupees } from '@/lib/dates';
import { PLATFORMS } from '@/lib/geo';

const EXAMPLES = [
  'Zomato 3 orders 180 rupees, waited 25 min at Biryani Junction',
  'aaj swiggy pe 5 order kiye 260 mile',
  'Rapido 2 rides 210',
];

type Earn = ParsedLog['earnings'][number] & { key: string };
type Wait = ParsedLog['waits'][number] & { key: string };

export default function QuickLog() {
  const { profile } = useProfile();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [earn, setEarn] = useState<Earn[] | null>(null);
  const [waits, setWaits] = useState<Wait[]>([]);
  const [unclear, setUnclear] = useState<string | null>(null);
  const [now, setNow] = useState('12:00');
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const parse = async (value = text) => {
    if (value.trim().length < 2) return;
    setLoading(true); setError(null); setDone(null);
    try {
      const res = await fetch('/api/parse-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: value }) });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      const p: ParsedLog = data.parsed;
      setEarn(p.earnings.map((e, i) => ({ ...e, key: `e${i}`, platform: e.platform === 'unknown' ? (profile.platforms[0] ?? 'swiggy') : e.platform })));
      setWaits(p.waits.map((w, i) => ({ ...w, key: `w${i}` })));
      setUnclear(p.unclear);
      setNow(data.now);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  };

  const save = () => start(async () => {
    let added = 0, skipped = 0, money = 0;
    for (const e of earn ?? []) {
      // "3 orders, ₹180" becomes three ₹60 orders, so counts and per-order maths stay right.
      const n = Math.max(1, Math.round(e.orders_count));
      const base = Math.floor(e.amount / n);
      const orders = Array.from({ length: n }, (_, i) => ({
        order_id: null, time: e.time ?? now, amount: i === 0 ? e.amount - base * (n - 1) : base, incentive: null, tip: null,
        distance_km: e.distance_km !== null ? Math.round((e.distance_km / n) * 10) / 10 : null, pickup: null, confidence: null, mergeInto: null,
      }));
      const res = await commitImport({ sha256: null, platform: e.platform as never, kind: 'order', date: e.date ?? '', source: 'voice', orders, summary: null });
      if (res.error) { setError(res.error); return; }
      added += res.added ?? 0; skipped += res.skipped ?? 0; money += res.total ?? 0;
    }
    if (waits.length) {
      const res = await commitWaits(waits.map((w) => ({ restaurant_name: w.restaurant_name, platform: w.platform === 'unknown' ? null : w.platform, duration_min: w.duration_min })));
      if (res.error) { setError(res.error); return; }
    }
    setDone(`Logged ${added} order${added === 1 ? '' : 's'} (${rupees(money)})${waits.length ? ` and ${waits.length} wait${waits.length === 1 ? '' : 's'}` : ''}${skipped ? `, ${skipped} duplicate skipped` : ''}.`);
    setEarn(null); setWaits([]); setText('');
  });

  const updEarn = (key: string, p: Partial<Earn>) => setEarn((xs) => xs?.map((x) => (x.key === key ? { ...x, ...p } : x)) ?? null);
  const updWait = (key: string, p: Partial<Wait>) => setWaits((xs) => xs.map((x) => (x.key === key ? { ...x, ...p } : x)));

  return (
    <main className="mx-auto flex max-w-[860px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-none tracking-[-0.04em]">Say it. <span className="font-serif font-normal italic text-heat">We log it.</span></h1>
        <p className="mt-2 text-[15px] font-medium text-muted">One line between orders, in English, हिंदी, ಕನ್ನಡ or Hinglish. Check it, then save.</p>
      </header>

      <div className="rounded-[26px] bg-surface p-4 sm:p-5">
        <label className="sr-only" htmlFor="quicklog">What did you earn or wait for?</label>
        <textarea id="quicklog" rows={3} value={text} onChange={(e) => setText(e.target.value)} lang={profile.language}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void parse(); }}
          placeholder="Zomato 3 orders 180 rupees, waited 25 min at Biryani Junction"
          className="w-full resize-none rounded-2xl bg-paper p-4 text-[17px] font-semibold leading-relaxed outline-none focus:ring-4 focus:ring-ink/10" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <MicButton lang={profile.language} onText={(t) => { setText(t); void parse(t); }} />
          <button type="button" onClick={() => parse()} disabled={loading || text.trim().length < 2}
            className="ml-auto flex h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-extrabold text-white disabled:opacity-40">
            {loading ? <LoaderCircle size={16} className="animate-spin" /> : <Send size={16} />} Understand this
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => { setText(ex); void parse(ex); }} className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-xs font-bold text-ink-2 hover:border-ink/30">{ex}</button>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{error}</p>}
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-money-soft px-4 py-3 text-sm font-bold text-[#075C3B]">
          <CheckCircle2 size={17} /> {done} <Link href="/app" className="underline underline-offset-2">See your real wage</Link>
        </p>
      )}

      {earn && (
        <section className="flex flex-col gap-3" aria-label="Review">
          {earn.length === 0 && waits.length === 0 && <p className="rounded-2xl bg-amber-soft px-4 py-3 text-sm font-bold text-[#5C3A00]">Nothing to log found. {unclear}</p>}
          {earn.map((e) => (
            <div key={e.key} className="flex flex-wrap items-end gap-3 rounded-[20px] bg-surface p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-money-soft text-money"><Wallet size={20} /></span>
              <label className="flex flex-col gap-1"><span className="text-xs font-extrabold text-muted">App</span>
                <select value={e.platform} onChange={(ev) => updEarn(e.key, { platform: ev.target.value as Earn['platform'] })} className="h-11 rounded-xl border border-line bg-surface px-3 font-bold">
                  {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
              <Num label="Orders" value={e.orders_count} onChange={(v) => updEarn(e.key, { orders_count: Math.max(1, v) })} w="w-20" />
              <Num label="Total ₹" value={e.amount} onChange={(v) => updEarn(e.key, { amount: v })} w="w-28" />
              <span className="pb-3 text-xs font-bold text-muted">{e.time ? `at ${e.time}` : 'time: now'} · {e.date}</span>
              <button type="button" aria-label="Remove" onClick={() => setEarn((xs) => xs?.filter((x) => x.key !== e.key) ?? null)} className="ml-auto flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl hover:bg-paper"><Trash2 size={17} /></button>
            </div>
          ))}
          {waits.map((w) => (
            <div key={w.key} className="flex flex-wrap items-end gap-3 rounded-[20px] bg-surface p-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-soft text-[#8A5600]"><Timer size={20} /></span>
              <label className="flex min-w-[180px] flex-1 flex-col gap-1"><span className="text-xs font-extrabold text-muted">Restaurant</span>
                <input value={w.restaurant_name} onChange={(ev) => updWait(w.key, { restaurant_name: ev.target.value })} className="h-11 rounded-xl border border-line px-3 font-bold" />
              </label>
              <Num label="Minutes" value={w.duration_min} onChange={(v) => updWait(w.key, { duration_min: Math.max(0.5, v) })} w="w-24" />
              <button type="button" aria-label="Remove" onClick={() => setWaits((xs) => xs.filter((x) => x.key !== w.key))} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl hover:bg-paper"><Trash2 size={17} /></button>
            </div>
          ))}
          {unclear && (earn.length > 0 || waits.length > 0) && <p className="text-sm font-semibold text-muted">Not understood: {unclear}</p>}
          {(earn.length > 0 || waits.length > 0) && (
            <button type="button" onClick={save} disabled={pending} className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-money font-extrabold text-white disabled:opacity-60">
              {pending ? <LoaderCircle size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Save to my log
            </button>
          )}
        </section>
      )}
    </main>
  );
}

function Num({ label, value, onChange, w }: { label: string; value: number; onChange: (v: number) => void; w: string }) {
  return (
    <label className="flex flex-col gap-1"><span className="text-xs font-extrabold text-muted">{label}</span>
      <input type="number" inputMode="decimal" value={value} onChange={(e) => onChange(Number(e.target.value))} className={`num h-11 ${w} rounded-xl border border-line px-3 font-extrabold`} />
    </label>
  );
}
