'use client';

import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Check, Copy, Download, FileText, LoaderCircle, Mail, MessageCircle, Sparkles } from 'lucide-react';
import { useProfile } from '@/components/app/ProfileContext';
import MicButton from '@/components/ui/MicButton';
import { saveAppeal } from '@/app/actions/ai';
import type { AppealDraft } from '@/lib/ai/schemas';
import { PLATFORMS } from '@/lib/geo';

const ISSUES = [
  { id: 'deactivated', label: 'ID deactivated' },
  { id: 'payout_missing', label: 'Payout missing' },
  { id: 'incentive', label: 'Incentive not paid' },
  { id: 'false_complaint', label: 'False complaint' },
  { id: 'other', label: 'Something else' },
] as const;

type Evidence = { total_orders: number; active_days: number; last_active: string | null; earned_last_30_days_inr: number; rating: string | null; orders_on_issue_dates: number | null };
type Past = { id: string; platform: string; issue_type: string; created_at: string; letter_en: string };

export default function AppealView({ past }: { past: Past[] }) {
  const { profile } = useProfile();
  const [platform, setPlatform] = useState(profile.platforms[0] ?? 'swiggy');
  const [issue, setIssue] = useState<(typeof ISSUES)[number]['id']>('deactivated');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rating, setRating] = useState('');
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<AppealDraft | null>(null);
  const [letter, setLetter] = useState('');
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(0);

  // Reveal the letter like it's being written, then hand it over for editing.
  useEffect(() => {
    if (!draft) return;
    const id = setInterval(() => setShown((n) => (n >= draft.letter_en.length ? n : n + 6)), 12);
    return () => clearInterval(id);
  }, [draft]);
  const typing = !!draft && shown < draft.letter_en.length;

  const generate = async () => {
    setLoading(true); setError(null); setDraft(null); setShown(0);
    try {
      const res = await fetch('/api/appeal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, issue_type: issue, dates: [from, to].filter(Boolean), description: text, rating: rating || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setDraft(data.draft); setLetter(data.draft.letter_en); setEvidence(data.evidence);
      void saveAppeal({ platform, issue_type: issue, dates: [from, to].filter(Boolean), description: text, letter_en: data.draft.letter_en, summary_local: data.draft.summary_local });
    } catch {
      setError('Could not reach the server. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const full = draft ? `Subject: ${draft.subject}\n\n${letter}` : '';
  const copy = async () => { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  const download = () => {
    const url = URL.createObjectURL(new Blob([full], { type: 'text/plain' }));
    const a = document.createElement('a'); a.href = url; a.download = `appeal-${platform}.txt`; a.click();
    URL.revokeObjectURL(url);
  };
  const pName = PLATFORMS.find((p) => p.id === platform)?.name ?? platform;

  return (
    <main className="mx-auto grid max-w-[1200px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,460px)_1fr] lg:py-8">
      <section className="flex flex-col gap-5">
        <header>
          <h1 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-none tracking-[-0.04em]">Your rights, <span className="font-serif font-normal italic text-heat">written for you.</span></h1>
          <p className="mt-2 text-[15px] font-medium text-muted">Describe the problem in any language. The letter only uses facts from your own Kilometre log.</p>
        </header>

        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold text-ink-2">Which app?</legend>
          <div className="flex flex-wrap gap-2">
            {profile.platforms.map((id) => {
              const p = PLATFORMS.find((x) => x.id === id)!;
              return (
                <button key={id} type="button" aria-pressed={platform === id} onClick={() => setPlatform(id)}
                  className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border-[1.5px] px-4 text-sm font-extrabold transition ${platform === id ? 'border-ink bg-ink text-white' : 'border-line bg-surface'}`}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color === '#15171B' && platform === id ? '#fff' : p.color }} />{p.name}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-[13px] font-extrabold text-ink-2">What went wrong?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ISSUES.map((i) => (
              <button key={i.id} type="button" aria-pressed={issue === i.id} onClick={() => setIssue(i.id)}
                className={`h-14 cursor-pointer rounded-2xl border-[1.5px] px-3 text-sm font-extrabold transition ${issue === i.id ? 'border-danger bg-danger-soft text-[#A3202E]' : 'border-line bg-surface hover:border-ink/30'}`}>
                {i.label}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1"><span className="text-xs font-extrabold text-muted">From date</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-extrabold text-muted">To date</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold" /></label>
          <label className="flex flex-col gap-1"><span className="text-xs font-extrabold text-muted">Your rating</span><input value={rating} onChange={(e) => setRating(e.target.value)} placeholder="4.8" className="h-11 rounded-xl border border-line bg-surface px-3 text-sm font-bold" /></label>
        </div>

        <label className="flex flex-col gap-2">
          <span className="text-[13px] font-extrabold text-ink-2">Tell us what happened, in any language</span>
          <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} lang={profile.language}
            placeholder="मेरी ID 3 दिन से ब्लॉक है। कोई कारण नहीं बताया।"
            className="resize-none rounded-2xl border border-line bg-surface p-4 text-[15px] font-semibold leading-relaxed outline-none focus:border-ink focus:ring-4 focus:ring-ink/10" />
        </label>
        <MicButton lang={profile.language} onText={(t) => setText((x) => (x ? `${x} ${t}` : t))} className="-mt-2 self-start" />

        {error && <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{error}</p>}
        <button type="button" onClick={generate} disabled={loading}
          className="flex h-15 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink py-4 text-base font-extrabold text-white transition hover:bg-ink/90 disabled:opacity-60">
          {loading ? <><LoaderCircle size={20} className="animate-spin" /> Writing your appeal…</> : <><Sparkles size={20} /> Write my appeal</>}
        </button>
      </section>

      <section aria-live="polite" className="flex flex-col gap-4">
        {!draft && !loading && (
          <div className="flex h-full min-h-[420px] flex-col justify-end overflow-hidden rounded-[28px] bg-night p-8 text-night-text">
            <FileText size={34} className="text-glow-heat" />
            <p className="mt-4 font-display text-3xl font-extrabold leading-tight tracking-tight">Platforms won&apos;t write this for you.</p>
            <p className="mt-2 max-w-md font-medium text-night-muted">Kilometre pulls your deliveries, active days and last shift from your log, so the letter is specific and hard to ignore.</p>
            {past.length > 0 && (
              <div className="mt-6 border-t border-night-line pt-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-night-muted">Earlier appeals</p>
                <ul className="mt-2 flex flex-col gap-1.5 text-sm font-semibold">
                  {past.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3"><span>{PLATFORMS.find((x) => x.id === p.platform)?.name ?? p.platform} · {ISSUES.find((i) => i.id === p.issue_type)?.label ?? p.issue_type}</span><span className="text-night-muted">{new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        {loading && (
          <div className="flex min-h-[420px] flex-col gap-3 rounded-[28px] bg-surface p-7">
            {[90, 100, 96, 70, 100, 84, 60].map((w, i) => (
              <motion.span key={i} className="block h-3.5 rounded-full bg-paper" style={{ width: `${w}%` }} animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.1 }} />
            ))}
          </div>
        )}
        {draft && (
          <>
            {evidence && (
              <div className="flex flex-wrap gap-2">
                {[
                  `${evidence.total_orders} ${pName} orders logged`,
                  `${evidence.active_days} active days`,
                  evidence.last_active ? `Last active ${evidence.last_active}` : null,
                  evidence.rating ? `${evidence.rating} ★ rating` : null,
                ].filter(Boolean).map((t) => <span key={t} className="rounded-full bg-money-soft px-3 py-1.5 text-xs font-extrabold text-[#075C3B]">{t}</span>)}
              </div>
            )}
            <div className="rounded-[26px] border-[1.5px] border-ink bg-surface p-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-extrabold text-white">AI draft</span>
                <span className="text-xs font-bold text-muted">Uses only facts from your log · edit anything before sending</span>
              </div>
              <p className="mb-3 text-[15px] font-extrabold">Subject: {draft.subject}</p>
              {typing ? (
                <p className="min-h-[320px] whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{draft.letter_en.slice(0, shown)}<span className="caret ml-0.5 inline-block h-4 w-[2px] translate-y-[3px] bg-ink" /></p>
              ) : (
                <textarea value={letter} onChange={(e) => setLetter(e.target.value)} rows={14} aria-label="Appeal letter"
                  className="min-h-[320px] w-full resize-y rounded-xl bg-paper/50 p-3 text-[15px] font-medium leading-relaxed outline-none focus:ring-4 focus:ring-ink/10" />
              )}
            </div>
            <p lang={profile.language} className="rounded-2xl bg-money-soft px-4 py-3 text-[15px] font-bold leading-relaxed text-[#075C3B]">{draft.summary_local}</p>
            <div className="rounded-2xl bg-surface p-4">
              <p className="text-sm font-extrabold">Attach with it</p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {draft.attach_checklist.map((c) => <li key={c} className="flex items-start gap-2 text-sm font-semibold text-ink-2"><Check size={16} className="mt-0.5 shrink-0 text-money" />{c}</li>)}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Action onClick={copy} icon={copied ? <Check size={17} /> : <Copy size={17} />}>{copied ? 'Copied' : 'Copy'}</Action>
              <Action onClick={download} icon={<Download size={17} />}>Download</Action>
              <a href={`https://wa.me/?text=${encodeURIComponent(full)}`} target="_blank" rel="noreferrer" className="flex h-13 items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-extrabold hover:border-ink/30"><MessageCircle size={17} /> WhatsApp</a>
              <a href={`mailto:?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(letter)}`} className="flex h-13 items-center justify-center gap-2 rounded-2xl bg-money text-sm font-extrabold text-white"><Mail size={17} /> Email it</a>
            </div>
          </>
        )}
      </section>
    </main>
  );
}

function Action({ onClick, icon, children }: { onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex h-13 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-line bg-surface text-sm font-extrabold hover:border-ink/30">
      {icon}{children}
    </button>
  );
}
