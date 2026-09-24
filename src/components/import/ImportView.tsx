'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { AlertTriangle, Check, CheckCircle2, CopyCheck, ImagePlus, LoaderCircle, Merge, ScanLine, Sparkles, Trash2, X } from 'lucide-react';
import { commitImport } from '@/app/actions/ai';
import { isoDateIST, rupees, prettyDate } from '@/lib/dates';
import { SAMPLES, sampleSVG, type SampleId } from '@/lib/samples';
import { PLATFORMS } from '@/lib/geo';
import type { Extraction } from '@/lib/ai/schemas';

type RowStatus = 'new' | 'duplicate' | 'possible';
type Row = {
  key: string;
  order_id: string | null; time: string | null; amount: number; incentive: number | null; tip: number | null;
  distance_km: number | null; pickup: string | null; confidence: number;
  status: RowStatus; matchId?: string; matchSource?: string; decision: 'keep' | 'merge' | 'skip';
};
type Item = {
  id: string; name: string; preview: string;
  state: 'reading' | 'ready' | 'dupfile' | 'error' | 'saved';
  error?: string; uploadedAt?: string; demo?: boolean;
  sha256?: string; platform?: string; kind?: 'order' | 'daily_summary'; date?: string; type?: Extraction['screenshot_type'];
  rows?: Row[]; summary?: { amount: number; incentive: number; tip: number; distance_km: number | null; login_hours: number | null } | null;
  notes?: string | null; existingSummary?: boolean;
  result?: { added: number; merged: number; skipped: number; total: number };
};

// Shrink big phone screenshots before upload: faster AI, same readable text.
async function compress(file: File): Promise<File> {
  if (file.size < 600_000) return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1800 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.88));
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' }) : file;
  } finally { URL.revokeObjectURL(url); }
}

// Draws a built-in sample with today's date, exactly like a phone screenshot the rider would upload.
async function sampleFile(id: SampleId): Promise<File> {
  const url = URL.createObjectURL(new Blob([sampleSVG(id, isoDateIST())], { type: 'image/svg+xml' }));
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
  c.getContext('2d')!.drawImage(img, 0, 0, 1080, 1920);
  URL.revokeObjectURL(url);
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/png'));
  return new File([blob!], `sample-${id}.png`, { type: 'image/png' });
}

export default function ImportView() {
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const patch = (id: string, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  const process = useCallback(async (raw: File) => {
    const id = crypto.randomUUID();
    setItems((xs) => [{ id, name: raw.name, preview: URL.createObjectURL(raw), state: 'reading' }, ...xs]);
    try {
      const file = await compress(raw);
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/extract', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) return patch(id, { state: 'error', error: data.error ?? 'Something went wrong.' });
      if (data.duplicateFile) return patch(id, { state: 'dupfile', uploadedAt: data.duplicateFile.uploadedAt, sha256: data.sha256 });
      const ex: Extraction = data.extraction;
      const rows: Row[] = ex.orders.map((o, i) => {
        const r = data.results[i] as { status: RowStatus; matchId?: string; matchSource?: string };
        return {
          key: `${id}-${i}`, order_id: o.order_id, time: o.time, amount: o.amount, incentive: o.incentive, tip: o.tip,
          distance_km: o.distance_km, pickup: o.restaurant_or_pickup, confidence: o.confidence,
          status: r.status, matchId: r.matchId, matchSource: r.matchSource,
          decision: r.status === 'duplicate' ? 'skip' : r.status === 'possible' ? 'merge' : 'keep',
        };
      });
      const isSummary = ex.screenshot_type === 'daily_summary' || ex.screenshot_type === 'weekly_payout';
      patch(id, {
        state: 'ready', sha256: data.sha256, platform: ex.platform, date: ex.date ?? undefined, type: ex.screenshot_type,
        kind: isSummary && rows.length === 0 ? 'daily_summary' : 'order', rows, notes: ex.notes, existingSummary: data.existingSummary, demo: data.demo,
        summary: isSummary && rows.length === 0 ? {
          amount: Math.max(0, (ex.summary.total_earnings ?? 0) - (ex.summary.incentives ?? 0) - (ex.summary.tips ?? 0)),
          incentive: ex.summary.incentives ?? 0, tip: ex.summary.tips ?? 0, distance_km: ex.summary.distance_km, login_hours: ex.summary.login_hours,
        } : null,
      });
    } catch {
      patch(id, { state: 'error', error: 'Upload failed. Check your connection and try again.' });
    }
  }, []);

  const addFiles = (files: FileList | File[]) => {
    [...files].filter((f) => f.type.startsWith('image/')).slice(0, 6).forEach((f) => void process(f));
  };

  // Paste a screenshot straight from the clipboard.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length) addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  return (
    <main className="mx-auto flex max-w-[1100px] flex-col gap-5 px-4 py-6 sm:px-6 lg:py-8">
      <header>
        <h1 className="font-display text-[clamp(30px,4vw,44px)] font-extrabold leading-none tracking-[-0.04em]">Screenshot in, <span className="font-serif font-normal italic text-heat">ledger out.</span></h1>
        <p className="mt-2 max-w-2xl text-[15px] font-medium text-muted">Upload payout or order screenshots from any app. AI reads them, you check them, and anything already logged is skipped.</p>
      </header>

      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        className={`relative flex flex-col items-center gap-4 overflow-hidden rounded-[28px] border-2 border-dashed p-8 text-center transition sm:p-10 ${drag ? 'border-ink bg-surface' : 'border-[#CDD1C6] bg-surface/60'}`}
      >
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ink text-white"><ImagePlus size={28} /></span>
        <div>
          <p className="text-lg font-extrabold">Drop screenshots here, or paste with Ctrl + V</p>
          <p className="text-sm font-semibold text-muted">Swiggy, Zomato, Zepto, Blinkit, Uber, Rapido, Ola, Porter… English, हिंदी or ಕನ್ನಡ</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className="flex h-12 cursor-pointer items-center gap-2 rounded-2xl bg-ink px-5 font-extrabold text-white hover:bg-ink/90">
            <ImagePlus size={18} /> Choose images
          </button>
        </div>
        <div className="flex flex-col items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-muted"><Sparkles size={14} /> Or try a sample, dated today</span>
          <div className="flex flex-wrap justify-center gap-2">
            {SAMPLES.map((s) => (
              <button key={s.id} type="button" onClick={async () => process(await sampleFile(s.id))}
                className="flex h-10 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface px-4 text-[13px] font-extrabold hover:border-ink/30">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}
              </button>
            ))}
          </div>
        </div>
        <input ref={inputRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      <div className="flex flex-col gap-4">
        {items.map((it) => <ItemCard key={it.id} it={it} patch={(p) => patch(it.id, p)} remove={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} />)}
      </div>
    </main>
  );
}

function ItemCard({ it, patch, remove }: { it: Item; patch: (p: Partial<Item>) => void; remove: () => void }) {
  const [pending, start] = useTransition();
  const rows = it.rows ?? [];
  const setRow = (key: string, p: Partial<Row>) => patch({ rows: rows.map((r) => (r.key === key ? { ...r, ...p } : r)) });
  const counted = rows.filter((r) => r.decision !== 'skip');
  const total = it.kind === 'daily_summary' && it.summary
    ? it.summary.amount + it.summary.incentive + it.summary.tip
    : counted.reduce((s, r) => s + r.amount + (r.incentive ?? 0) + (r.tip ?? 0), 0);
  const platform = PLATFORMS.find((p) => p.id === it.platform);

  const save = () => start(async () => {
    const res = await commitImport({
      sha256: it.sha256 ?? null,
      platform: (it.platform ?? 'unknown') as never,
      kind: it.kind ?? 'order',
      date: it.date ?? '',
      source: 'screenshot',
      orders: it.kind === 'daily_summary' ? [] : counted.map((r) => ({
        order_id: r.order_id, time: r.time, amount: Number(r.amount), incentive: r.incentive, tip: r.tip,
        distance_km: r.distance_km, pickup: r.pickup, confidence: r.confidence, mergeInto: r.decision === 'merge' ? r.matchId ?? null : null,
      })),
      summary: it.kind === 'daily_summary' ? it.summary ?? null : null,
    });
    if (res.error) patch({ error: res.error });
    else patch({ state: 'saved', error: undefined, result: { added: res.added ?? 0, merged: res.merged ?? 0, skipped: (res.skipped ?? 0) + rows.filter((r) => r.decision === 'skip').length, total: res.total ?? 0 } });
  });

  return (
    <motion.article initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 rounded-[26px] bg-surface p-4 shadow-[0_1px_2px_rgba(21,23,27,0.05)] sm:grid-cols-[150px_1fr] sm:p-5">
      <div className="relative h-[220px] overflow-hidden rounded-2xl bg-paper sm:h-[260px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={it.preview} alt={`Uploaded screenshot ${it.name}`} className="h-full w-full object-cover object-top" />
        {it.state === 'reading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/55 text-white backdrop-blur-[2px]">
            <motion.span className="absolute inset-x-0 h-1 bg-glow-money shadow-[0_0_24px_#6EE0A4]" animate={{ top: ['8%', '92%', '8%'] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
            <ScanLine size={26} />
            <span className="text-xs font-extrabold">Reading…</span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[15px] font-extrabold">{it.name}</span>
          {it.state === 'ready' && platform && <Chip style={{ background: `${platform.color}1f`, color: '#15171B' }}><span className="h-2 w-2 rounded-full" style={{ background: platform.color }} />{platform.name}</Chip>}
          {it.state === 'ready' && it.type && <Chip>{it.type.replace('_', ' ')}</Chip>}
          {it.state === 'ready' && it.date && <Chip>{prettyDate(it.date, { day: 'numeric', month: 'short' })}</Chip>}
          {it.demo && <Chip style={{ background: '#FFF3D6', color: '#5C3A00' }}>offline answer</Chip>}
          <button type="button" onClick={remove} aria-label="Remove" className="ml-auto flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl hover:bg-paper"><X size={16} /></button>
        </div>

        {it.state === 'reading' && <p className="text-sm font-semibold text-muted">AI is reading orders, amounts and incentives…</p>}
        {it.state === 'error' && <Notice tone="bad" icon={<AlertTriangle size={17} />}>{it.error}</Notice>}
        {it.state === 'dupfile' && <Notice tone="ok" icon={<CopyCheck size={17} />}>Already imported on {new Date(it.uploadedAt!).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}. Nothing was added twice.</Notice>}
        {it.state === 'saved' && it.result && (
          <Notice tone="ok" icon={<CheckCircle2 size={17} />}>
            Added {rupees(it.result.total)} to your ledger · {it.result.added} new{it.result.merged ? `, ${it.result.merged} merged` : ''}{it.result.skipped ? `, ${it.result.skipped} duplicate skipped` : ''}. <Link href="/app" className="underline underline-offset-2">See your real wage</Link>
          </Notice>
        )}

        {it.state === 'ready' && (
          <>
            {it.platform === 'unknown' && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-extrabold text-[#8A5600]">Which app is this from?</span>
                <select value="unknown" onChange={(e) => patch({ platform: e.target.value })} className="h-11 rounded-xl border-[1.5px] border-amber bg-amber-soft px-3 font-bold">
                  <option value="unknown" disabled>Choose app</option>
                  {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </label>
            )}
            {it.notes && it.platform === 'unknown' && <p className="text-sm font-semibold text-muted">{it.notes}</p>}
            {rows.filter((r) => r.status === 'duplicate').length > 0 && (
              <Notice tone="ok" icon={<Check size={17} />}>{rows.filter((r) => r.status === 'duplicate').length} duplicate skipped: that order ID is already in your ledger.</Notice>
            )}
            {it.kind === 'daily_summary' && it.summary && (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Field label="Base earnings" value={it.summary.amount} onChange={(v) => patch({ summary: { ...it.summary!, amount: v ?? 0 } })} />
                <Field label="Incentives" value={it.summary.incentive} onChange={(v) => patch({ summary: { ...it.summary!, incentive: v ?? 0 } })} />
                <Field label="Distance km" value={it.summary.distance_km} onChange={(v) => patch({ summary: { ...it.summary!, distance_km: v } })} />
                <Field label="Login hours" value={it.summary.login_hours} onChange={(v) => patch({ summary: { ...it.summary!, login_hours: v } })} />
                {it.existingSummary && <p className="col-span-full text-xs font-bold text-[#8A5600]">This replaces the earlier summary for that day, so it is never counted twice.</p>}
              </div>
            )}
            {it.kind === 'order' && (
              <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line">
                {rows.length === 0 && <li className="p-4 text-sm font-semibold text-muted">No orders found in this screenshot.</li>}
                {rows.map((r) => (
                  <li key={r.key} className={`flex flex-wrap items-center gap-3 p-3 ${r.decision === 'skip' ? 'opacity-45' : ''} ${r.confidence < 0.7 && r.decision !== 'skip' ? 'bg-amber-soft/60' : ''}`}>
                    <div className="flex min-w-[150px] flex-1 flex-col">
                      <span className="flex items-center gap-2 text-sm font-extrabold">
                        {r.time ?? '--:--'} · {r.order_id ?? 'no order ID'}
                        {r.status === 'duplicate' && <Badge tone="gray">duplicate</Badge>}
                        {r.status === 'possible' && <Badge tone="amber">matches a {r.matchSource === 'seed' ? 'logged' : r.matchSource ?? 'logged'} order</Badge>}
                        {r.confidence < 0.7 && r.decision !== 'skip' && <Badge tone="amber">AI unsure</Badge>}
                      </span>
                      <span className="text-xs font-semibold text-muted">
                        {r.incentive ? `+₹${r.incentive} incentive · ` : ''}{r.distance_km !== null ? `${r.distance_km} km` : 'distance not visible'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MiniNum label="₹" value={r.amount} onChange={(v) => setRow(r.key, { amount: v ?? 0 })} warn={r.confidence < 0.7} />
                      <MiniNum label="km" value={r.distance_km} onChange={(v) => setRow(r.key, { distance_km: v })} warn={r.confidence < 0.7 && r.distance_km === null} />
                    </div>
                    {r.status === 'possible' && (
                      <div className="flex gap-1 rounded-xl bg-paper p-1">
                        <Seg on={r.decision === 'merge'} onClick={() => setRow(r.key, { decision: 'merge' })}><Merge size={14} /> Merge</Seg>
                        <Seg on={r.decision === 'keep'} onClick={() => setRow(r.key, { decision: 'keep' })}>Keep both</Seg>
                      </div>
                    )}
                    {r.status === 'new' && (
                      <button type="button" aria-label="Don't add this order" onClick={() => setRow(r.key, { decision: r.decision === 'skip' ? 'keep' : 'skip' })} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl hover:bg-paper">
                        {r.decision === 'skip' ? <Check size={16} /> : <Trash2 size={16} />}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {it.error && <Notice tone="bad" icon={<AlertTriangle size={17} />}>{it.error}</Notice>}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-bold text-ink-2">
                {it.kind === 'daily_summary' ? 'Daily summary' : `${counted.filter((r) => r.decision === 'keep').length} new · ${counted.filter((r) => r.decision === 'merge').length} merge · ${rows.filter((r) => r.decision === 'skip').length} skip`}
              </span>
              <button type="button" disabled={pending || it.platform === 'unknown' || total <= 0} onClick={save}
                className="ml-auto flex h-13 cursor-pointer items-center gap-2 rounded-2xl bg-money px-6 font-extrabold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">
                {pending ? <LoaderCircle size={18} className="animate-spin" /> : <Check size={18} />} Add {rupees(total)} to my ledger
              </button>
            </div>
          </>
        )}
      </div>
    </motion.article>
  );
}

function Chip({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <span className="flex items-center gap-1.5 rounded-full bg-paper px-2.5 py-1 text-[11px] font-extrabold capitalize" style={style}>{children}</span>;
}
function Badge({ children, tone }: { children: React.ReactNode; tone: 'amber' | 'gray' }) {
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${tone === 'amber' ? 'bg-amber-soft text-[#8A5600]' : 'bg-paper text-muted'}`}>{children}</span>;
}
function Notice({ tone, icon, children }: { tone: 'ok' | 'bad'; icon: React.ReactNode; children: React.ReactNode }) {
  return <p role={tone === 'bad' ? 'alert' : 'status'} className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${tone === 'ok' ? 'bg-money-soft text-[#075C3B]' : 'bg-danger-soft text-[#A3202E]'}`}><span className="mt-0.5">{icon}</span><span>{children}</span></p>;
}
function Seg({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick} className={`flex h-8 cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-extrabold ${on ? 'bg-ink text-white' : 'text-ink-2'}`}>{children}</button>;
}
function MiniNum({ label, value, onChange, warn }: { label: string; value: number | null; onChange: (v: number | null) => void; warn?: boolean }) {
  return (
    <label className={`flex h-10 w-[92px] items-center gap-1 rounded-xl border-[1.5px] px-2.5 ${warn ? 'border-amber bg-[#FFFBF0]' : 'border-line bg-surface'}`}>
      <span className="text-xs font-extrabold text-muted">{label}</span>
      <input type="number" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className="num w-full bg-transparent text-sm font-extrabold outline-none" aria-label={label === '₹' ? 'Amount' : 'Distance in km'} />
    </label>
  );
}
function Field({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-extrabold text-muted">{label}</span>
      <input type="number" inputMode="decimal" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className="num h-11 rounded-xl border border-line px-3 font-extrabold" />
    </label>
  );
}
