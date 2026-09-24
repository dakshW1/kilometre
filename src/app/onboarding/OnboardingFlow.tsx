'use client';

import { AnimatePresence, motion } from 'motion/react';
import { useState, useTransition } from 'react';
import { ArrowLeft, ArrowRight, Bike, Check, LoaderCircle, PlugZap, Zap } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { completeOnboarding, type OnboardingInput } from '@/app/actions/rider';
import { PLATFORMS, ZONES, type Platform } from '@/lib/geo';
import { WORKING_DAYS_PER_MONTH } from '@/lib/calc';

const VEHICLES = [
  { id: 'petrol', label: 'Petrol bike', hint: '≈ ₹2.5/km', fuel: 2.5, icon: Bike },
  { id: 'ev', label: 'EV scooter', hint: '≈ ₹0.6/km', fuel: 0.6, icon: PlugZap },
  { id: 'ecycle', label: 'E-cycle', hint: '≈ ₹0.2/km', fuel: 0.2, icon: Zap },
] as const;

const LANGS = [
  { id: 'en', label: 'English', sample: 'Hello' },
  { id: 'hi', label: 'हिंदी', sample: 'नमस्ते' },
  { id: 'kn', label: 'ಕನ್ನಡ', sample: 'ನಮಸ್ಕಾರ' },
] as const;

const STEPS = ['You', 'Apps', 'Costs', 'Goal'];

export default function OnboardingFlow({ initialName }: { initialName: string }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [f, setF] = useState<OnboardingInput>({
    name: initialName,
    language: 'en',
    platforms: ['swiggy', 'zepto', 'rapido'],
    vehicle: 'petrol',
    fuel_cost_per_km: 2.5,
    monthly_emi: 3200,
    monthly_phone_data: 400,
    daily_target: 1500,
    home_zone: 'btm',
    seed_demo: true,
  });
  const set = <K extends keyof OnboardingInput>(k: K, v: OnboardingInput[K]) => setF((x) => ({ ...x, [k]: v }));

  const canNext = [f.name.trim().length > 0, f.platforms.length > 0, true, true][step];
  const go = (d: number) => { setDir(d); setError(null); setStep((s) => Math.min(3, Math.max(0, s + d))); };
  const finish = () => start(async () => {
    const res = await completeOnboarding(f);
    if (res?.error) setError(res.error);
  });
  const fixedPerDay = Math.round((Number(f.monthly_emi) + Number(f.monthly_phone_data)) / WORKING_DAYS_PER_MONTH);
  const togglePlatform = (id: Platform) =>
    set('platforms', f.platforms.includes(id) ? f.platforms.filter((p) => p !== id) : [...f.platforms, id]);

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1fr_440px]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Logo />
          <span className="num text-sm font-extrabold text-muted">Step {step + 1} of 4</span>
        </div>
        <div className="mt-6 flex gap-2" aria-hidden="true">
          {STEPS.map((s, i) => (
            <div key={s} className="flex flex-1 flex-col gap-1.5">
              <span className="h-1.5 overflow-hidden rounded-full bg-line">
                <motion.span className="block h-full rounded-full bg-ink" initial={false} animate={{ width: i <= step ? '100%' : '0%' }} transition={{ duration: 0.5 }} />
              </span>
              <span className={`text-xs font-extrabold ${i <= step ? 'text-ink' : 'text-muted'}`}>{s}</span>
            </div>
          ))}
        </div>

        <div className="relative flex flex-1 items-center py-10">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 60, filter: 'blur(6px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, x: dir * -60, filter: 'blur(6px)' }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-[620px]"
            >
              {step === 0 && (
                <Step title={<>What should we <em className="font-serif font-normal text-heat">call you?</em></>} sub="Your name goes on appeal letters, so use the one the apps know.">
                  <label className="flex flex-col gap-2">
                    <span className="text-[13px] font-extrabold text-ink-2">Your name</span>
                    <input value={f.name} onChange={(e) => set('name', e.target.value)} autoFocus placeholder="Ravi Kumar"
                      className="h-14 rounded-2xl border border-line bg-surface px-4 text-lg font-bold outline-none focus:border-ink focus:ring-4 focus:ring-ink/10" />
                  </label>
                  <fieldset className="mt-6">
                    <legend className="mb-2 text-[13px] font-extrabold text-ink-2">Language for summaries and voice</legend>
                    <div className="grid grid-cols-3 gap-3">
                      {LANGS.map((l) => (
                        <button key={l.id} type="button" aria-pressed={f.language === l.id} onClick={() => set('language', l.id)}
                          className={`flex h-24 cursor-pointer flex-col items-start justify-between rounded-2xl border-[1.5px] p-4 text-left transition ${f.language === l.id ? 'border-ink bg-surface shadow-md' : 'border-line bg-surface/60 hover:border-ink/30'}`}>
                          <span lang={l.id} className="text-xl font-extrabold">{l.label}</span>
                          <span lang={l.id} className="text-xs font-semibold text-muted">{l.sample}</span>
                        </button>
                      ))}
                    </div>
                  </fieldset>
                </Step>
              )}

              {step === 1 && (
                <Step title={<>Which apps do you <em className="font-serif font-normal text-heat">work on?</em></>} sub="Pick every app you switch between. Kilometre adds them up into one real wage.">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {PLATFORMS.map((p) => {
                      const on = f.platforms.includes(p.id);
                      return (
                        <button key={p.id} type="button" aria-pressed={on} onClick={() => togglePlatform(p.id)}
                          className={`relative flex h-20 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-4 text-left transition ${on ? 'border-ink bg-surface shadow-md' : 'border-line bg-surface/60 hover:border-ink/30'}`}>
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white" style={{ background: p.color }}>{p.name.slice(0, 1)}</span>
                          <span className="text-[15px] font-extrabold">{p.name}</span>
                          {on && <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-ink text-white"><Check size={13} strokeWidth={3} /></span>}
                        </button>
                      );
                    })}
                  </div>
                </Step>
              )}

              {step === 2 && (
                <Step title={<>What does a day <em className="font-serif font-normal text-heat">cost you?</em></>} sub="The apps never subtract these. We do, so you see what you really keep.">
                  <div className="grid grid-cols-3 gap-3">
                    {VEHICLES.map((v) => (
                      <button key={v.id} type="button" aria-pressed={f.vehicle === v.id} onClick={() => setF((x) => ({ ...x, vehicle: v.id, fuel_cost_per_km: v.fuel }))}
                        className={`flex h-28 cursor-pointer flex-col justify-between rounded-2xl border-[1.5px] p-4 text-left transition ${f.vehicle === v.id ? 'border-ink bg-surface shadow-md' : 'border-line bg-surface/60 hover:border-ink/30'}`}>
                        <v.icon size={24} />
                        <span><span className="block text-[15px] font-extrabold">{v.label}</span><span className="text-xs font-semibold text-muted">{v.hint}</span></span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <Num label="Fuel / charge per km" prefix="₹" step={0.1} value={f.fuel_cost_per_km} onChange={(v) => set('fuel_cost_per_km', v)} />
                    <Num label="Vehicle EMI / month" prefix="₹" step={100} value={f.monthly_emi} onChange={(v) => set('monthly_emi', v)} />
                    <Num label="Phone + data / month" prefix="₹" step={50} value={f.monthly_phone_data} onChange={(v) => set('monthly_phone_data', v)} />
                  </div>
                  <p className="mt-4 rounded-2xl bg-heat-soft px-4 py-3 text-sm font-bold text-[#8A3414]">
                    That&apos;s <span className="num">₹{fixedPerDay}</span> of fixed cost every working day, before a single order.
                  </p>
                </Step>
              )}

              {step === 3 && (
                <Step title={<>Set your <em className="font-serif font-normal text-heat">daily goal.</em></>} sub="We track progress against what you actually take home, not app totals.">
                  <label className="block">
                    <span className="flex items-baseline justify-between">
                      <span className="text-[13px] font-extrabold text-ink-2">Take-home target per day</span>
                      <span className="num text-4xl font-extrabold text-money">₹{Number(f.daily_target).toLocaleString('en-IN')}</span>
                    </span>
                    <input type="range" min={500} max={3000} step={50} value={f.daily_target} onChange={(e) => set('daily_target', Number(e.target.value))} className="mt-3 w-full accent-ink" />
                  </label>
                  <fieldset className="mt-6">
                    <legend className="mb-2 text-[13px] font-extrabold text-ink-2">Where do you usually start?</legend>
                    <div className="flex flex-wrap gap-2">
                      {ZONES.filter((z) => z.profile !== 'event').map((z) => (
                        <button key={z.id} type="button" aria-pressed={f.home_zone === z.id} onClick={() => set('home_zone', z.id)}
                          className={`h-10 cursor-pointer rounded-full border-[1.5px] px-4 text-[13px] font-extrabold transition ${f.home_zone === z.id ? 'border-ink bg-ink text-white' : 'border-line bg-surface hover:border-ink/30'}`}>
                          {z.name}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                  <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface p-4">
                    <input type="checkbox" checked={f.seed_demo} onChange={(e) => set('seed_demo', e.target.checked)} className="mt-0.5 h-5 w-5 accent-ink" />
                    <span>
                      <span className="block text-[15px] font-extrabold">Load a demo week so I can explore</span>
                      <span className="text-[13px] font-semibold text-muted">7 days of sample orders and waits. You can clear it any time.</span>
                    </span>
                  </label>
                </Step>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {error && <p role="alert" className="mx-auto mb-3 w-full max-w-[620px] rounded-2xl bg-danger-soft px-4 py-3 text-sm font-bold text-[#A3202E]">{error}</p>}
        <div className="mx-auto flex w-full max-w-[620px] gap-3">
          {step > 0 && (
            <button type="button" onClick={() => go(-1)} className="flex h-14 cursor-pointer items-center gap-2 rounded-2xl border border-line bg-surface px-5 font-extrabold hover:border-ink/30">
              <ArrowLeft size={18} /> Back
            </button>
          )}
          <button type="button" disabled={!canNext || pending} onClick={() => (step < 3 ? go(1) : finish())}
            className="group flex h-14 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-ink font-extrabold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40">
            {pending ? <LoaderCircle size={20} className="animate-spin" /> : step < 3 ? <>Continue <ArrowRight size={18} className="transition group-hover:translate-x-0.5" /></> : <>Start riding smarter <ArrowRight size={18} /></>}
          </button>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-night p-10 text-night-text lg:flex lg:flex-col lg:justify-center" aria-label="Preview">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-glow-heat/25 blur-[90px]" />
        <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-glow-money/20 blur-[90px]" />
        <p className="relative text-xs font-extrabold uppercase tracking-[0.2em] text-night-muted">Your rider card</p>
        <motion.div layout className="relative mt-4 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          <p className="font-display text-3xl font-extrabold tracking-tight">{f.name || 'Your name'}</p>
          <p className="text-sm font-semibold text-night-muted">{ZONES.find((z) => z.id === f.home_zone)?.name} · {VEHICLES.find((v) => v.id === f.vehicle)?.label}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {f.platforms.map((id) => {
              const p = PLATFORMS.find((x) => x.id === id)!;
              return <motion.span layout key={id} className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold"><span className="h-2 w-2 rounded-full" style={{ background: p.color === '#15171B' ? '#fff' : p.color }} />{p.name}</motion.span>;
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-bold text-night-muted">Fixed cost / day</p><p className="num text-2xl font-extrabold text-[#FF8A8A]">₹{fixedPerDay}</p></div>
            <div className="rounded-2xl bg-white/5 p-4"><p className="text-xs font-bold text-night-muted">Daily goal</p><p className="num text-2xl font-extrabold text-glow-money">₹{Number(f.daily_target).toLocaleString('en-IN')}</p></div>
          </div>
        </motion.div>
        <p className="relative mt-6 max-w-sm text-sm font-medium leading-relaxed text-night-muted">Everything stays private to your account. Only anonymised totals ever reach the city map.</p>
      </aside>
    </div>
  );
}

function Step({ title, sub, children }: { title: React.ReactNode; sub: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="font-display text-[clamp(34px,5vw,52px)] font-extrabold leading-[0.98] tracking-[-0.04em]">{title}</h1>
      <p className="mb-8 mt-3 text-[15px] font-medium text-muted">{sub}</p>
      {children}
    </div>
  );
}

function Num({ label, prefix, value, onChange, step }: { label: string; prefix: string; value: number; onChange: (v: number) => void; step: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-extrabold text-ink-2">{label}</span>
      <span className="flex h-13 items-center rounded-2xl border border-line bg-surface px-4 focus-within:border-ink focus-within:ring-4 focus-within:ring-ink/10">
        <span className="font-bold text-muted">{prefix}</span>
        <input type="number" inputMode="decimal" min={0} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
          className="num w-full bg-transparent pl-1 text-lg font-extrabold outline-none" />
      </span>
    </label>
  );
}
