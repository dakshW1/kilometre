'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import Lenis from 'lenis';
import { motion, useScroll, useTransform } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Map as MLMap } from 'maplibre-gl';
import { ArrowRight, CloudRain, FileText, Flag, ScanLine, Timer, TrendingUp, Upload } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import { CountTo, Reveal, Typewriter, Words } from './motion-bits';
import { PLATFORMS, ZONES, formatHour, periodLabel, zoneStates } from '@/lib/geo';
import { istHour, istTime, useNow } from '@/lib/clock';
import { useWeather } from '@/lib/useWeather';
import { WeatherIcon } from '@/components/weather/WeatherBits';

const CityMap = dynamic(() => import('@/components/map/CityMap'), { ssr: false });

type Cam = { center: [number, number]; zoom: number; pitch: number; bearing: number };

// One camera keyframe per chapter; the bearing keeps increasing so scrolling feels like one long orbit.
const CHAPTERS: { id: string; label: string; cam: Cam; elevation: number; opacity: number }[] = [
  { id: 'top', label: 'Bengaluru', cam: { center: [77.6, 12.95], zoom: 11.3, pitch: 58, bearing: -24 }, elevation: 1, opacity: 0.8 },
  { id: 'wage', label: 'Real wage', cam: { center: [77.6245, 12.9352], zoom: 14.2, pitch: 62, bearing: 28 }, elevation: 0.06, opacity: 0 },
  { id: 'wait', label: 'Waiting', cam: { center: [77.6262, 12.9362], zoom: 15, pitch: 66, bearing: 72 }, elevation: 0.03, opacity: 0 },
  { id: 'import', label: 'Screenshots', cam: { center: [77.642, 12.95], zoom: 12.8, pitch: 52, bearing: 112 }, elevation: 0.35, opacity: 0.6 },
  { id: 'where', label: 'Where to ride', cam: { center: [77.645, 12.945], zoom: 11.9, pitch: 60, bearing: 150 }, elevation: 1.5, opacity: 0.95 },
  { id: 'appeal', label: 'Appeals', cam: { center: [77.628, 12.972], zoom: 12.6, pitch: 46, bearing: 190 }, elevation: 0.3, opacity: 0.45 },
  { id: 'join', label: 'Join', cam: { center: [77.63, 12.955], zoom: 10.9, pitch: 42, bearing: 222 }, elevation: 1, opacity: 0.85 },
];

const RIDER_HOME: [number, number] = [77.6101, 12.9166]; // BTM Layout

const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function cameraAt(x: number): Cam {
  const max = CHAPTERS.length - 1;
  const cx = Math.min(Math.max(x, 0), max);
  const i = Math.min(Math.floor(cx), max - 1);
  const t = smooth(cx - i);
  const a = CHAPTERS[i].cam, b = CHAPTERS[i + 1].cam;
  return {
    center: [lerp(a.center[0], b.center[0], t), lerp(a.center[1], b.center[1], t)],
    zoom: lerp(a.zoom, b.zoom, t),
    pitch: lerp(a.pitch, b.pitch, t),
    bearing: lerp(a.bearing, b.bearing, t),
  };
}

export default function Landing({ signedIn }: { signedIn: boolean }) {
  const mapRef = useRef<MLMap | null>(null);
  const hudRef = useRef<HTMLSpanElement>(null);
  const lenisRef = useRef<Lenis | null>(null);
  const [chapter, setChapter] = useState(0);
  const [hour, setHour] = useState(() => istHour());

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduce) lenisRef.current = new Lenis({ autoRaf: true, lerp: 0.085 });

    let raf = 0;
    let lastCh = -1, lastHour = -1;
    const start = performance.now();
    const tick = () => {
      const x = window.scrollY / window.innerHeight;
      const cam = cameraAt(x);
      // Slow drift on the hero only, fading out as you scroll away.
      const drift = reduce ? 0 : ((performance.now() - start) / 1000) * 1.6 * Math.max(0, 1 - x);
      const map = mapRef.current;
      if (map) map.jumpTo({ center: cam.center, zoom: cam.zoom, pitch: cam.pitch, bearing: cam.bearing + drift });

      const ch = Math.min(CHAPTERS.length - 1, Math.max(0, Math.round(x)));
      if (ch !== lastCh) { lastCh = ch; setChapter(ch); }

      // Everywhere the map shows Bengaluru right now; only the "where to ride" chapter scrubs lunch to dinner.
      const scrubbing = ch === 4;
      const h = scrubbing ? Math.round(lerp(11, 22, Math.min(1, Math.max(0, x - 3.5)))) : istHour();
      if (h !== lastHour) { lastHour = h; setHour(h); }

      if (hudRef.current) {
        hudRef.current.textContent = `${cam.center[1].toFixed(4)}° N · ${cam.center[0].toFixed(4)}° E`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
      lenisRef.current = null;
    };
  }, []);

  const ch = CHAPTERS[chapter];
  const conditions = useMemo(() => ({ hour }), [hour]);
  const top = useMemo(() => zoneStates({ hour }).filter((z) => z.id !== 'chs')[0], [hour]);
  const arc = useMemo(
    () => (chapter === 4 ? { from: RIDER_HOME, to: [top.lng, top.lat] as [number, number] } : null),
    [chapter, top],
  );

  const goTo = (i: number) => {
    const y = i * window.innerHeight;
    if (lenisRef.current) lenisRef.current.scrollTo(y, { duration: 1.6 });
    else window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <div className="grain relative bg-night text-night-text">
      {/* Fixed 3D city behind every chapter */}
      <div className="fixed inset-0 z-0" aria-hidden="true">
        <CityMap
          theme="night"
          interactive={false}
          conditions={conditions}
          initialCamera={CHAPTERS[0].cam}
          elevationScale={ch.elevation}
          hexOpacity={ch.opacity}
          showRestaurants={chapter === 2}
          arc={arc}
          onReady={(m) => { mapRef.current = m; }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(9,12,18,0.92)_0%,rgba(9,12,18,0.6)_38%,rgba(9,12,18,0)_68%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-[linear-gradient(0deg,rgba(9,12,18,0.9),rgba(9,12,18,0))]" />
      </div>

      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-18 max-w-[1400px] items-center justify-between px-5 sm:px-8">
          <button type="button" onClick={() => goTo(0)} aria-label="Kilometre home" className="cursor-pointer">
            <Logo dark />
          </button>
          <nav className="flex items-center gap-2">
            {signedIn ? (
              <Link href="/app" className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-ink transition hover:bg-white/90">
                Open Kilometre <ArrowRight size={16} />
              </Link>
            ) : (
              <>
                <Link href="/login" className="hidden h-11 items-center rounded-full px-4 text-sm font-bold text-night-text/80 transition hover:text-white sm:flex">Log in</Link>
                <Link href="/signup" className="flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold text-ink transition hover:bg-white/90">
                  Start free <ArrowRight size={16} />
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Chapter rail */}
      <nav aria-label="Chapters" className="fixed right-6 top-1/2 z-30 hidden -translate-y-1/2 flex-col gap-3 lg:flex">
        {CHAPTERS.map((c, i) => (
          <button key={c.id} type="button" onClick={() => goTo(i)} className="group flex cursor-pointer items-center justify-end gap-3">
            <span className={`text-xs font-bold transition ${i === chapter ? 'text-white opacity-100' : 'text-night-muted opacity-0 group-hover:opacity-100'}`}>{c.label}</span>
            <span className={`num w-6 text-right text-xs font-bold transition ${i === chapter ? 'text-glow-heat' : 'text-night-muted'}`}>{String(i).padStart(2, '0')}</span>
            <span className={`h-[2px] transition-all ${i === chapter ? 'w-10 bg-glow-heat' : 'w-4 bg-white/25'}`} />
          </button>
        ))}
      </nav>

      {/* HUD */}
      <div className="fixed bottom-5 left-5 z-30 hidden items-center gap-3 rounded-full border border-night-line bg-night/70 px-4 py-2 text-[11px] font-bold tracking-wide text-night-muted backdrop-blur sm:flex">
        <span className="relative flex h-2 w-2"><span className="pulse-ring absolute inline-flex h-full w-full rounded-full bg-glow-heat" /><span className="relative inline-flex h-2 w-2 rounded-full bg-glow-heat" /></span>
        <span ref={hudRef} className="num">12.9500° N · 77.6000° E</span>
        <span className="num">· <HudClock scrubbing={chapter === 4} hour={hour} /></span>
        <span className="text-night-muted/70">· simulated demand</span>
      </div>

      <main className="relative z-10">
        <Hero goNext={() => goTo(1)} />
        <WageChapter />
        <WaitChapter />
        <ImportChapter />
        <WhereChapter hour={hour} top={top} />
        <AppealChapter />
        <JoinChapter signedIn={signedIn} />
      </main>
    </div>
  );
}

function Chapter({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} className={`relative flex h-screen items-center ${className ?? ''}`}>
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">{children}</div>
    </section>
  );
}

function Kicker({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <Reveal y={16} className="mb-6 flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.2em] text-night-muted">
      <span className="num text-glow-heat">{n}</span>
      <span className="h-px w-10 bg-white/25" />
      {children}
    </Reveal>
  );
}

// Live IST clock; in the "where to ride" chapter it shows the hour you've scrolled to instead.
function HudClock({ scrubbing, hour }: { scrubbing: boolean; hour: number }) {
  const now = useNow();
  if (scrubbing) return <>{formatHour(hour)} · scroll to change</>;
  return <>{now === null ? '--:--' : `${istTime(now, true)} IST`}</>;
}

// "Bengaluru · 3:42 AM · Late night", ticking live in IST.
function LiveChip() {
  const now = useNow();
  const weather = useWeather();
  if (now === null) return <>Bengaluru · live</>;
  return (
    <>
      Bengaluru · <span className="num">{istTime(now)}</span> · {periodLabel(istHour(now))}
      {weather && <span className="flex items-center gap-1.5">· <WeatherIcon icon={weather.now.icon} size={14} /><span className="num">{Math.round(weather.now.temp)}°</span> {weather.now.label}</span>}
    </>
  );
}

function Hero({ goNext }: { goNext: () => void }) {
  return (
    <section id="top" className="relative flex h-screen flex-col justify-end pb-24 pt-24 sm:justify-center sm:pb-16">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        <Reveal y={12} className="mb-7 inline-flex items-center gap-2 rounded-full border border-night-line bg-white/5 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-night-text/85 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-glow-money" /> <LiveChip />
        </Reveal>
        <h1 className="max-w-[14ch] font-display text-[clamp(38px,min(8.4vw,10.5vh),128px)] font-extrabold leading-[0.9] tracking-[-0.045em]">
          <Words text="Four apps track Ravi." />
          <br />
          <Words text="None of them" delay={0.25} />{' '}
          <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.02em] text-glow-heat">
            <Words text="work for him." delay={0.45} />
          </span>
        </h1>
        <Reveal delay={0.7} className="mt-6 max-w-[520px] text-[17px] font-medium leading-relaxed text-night-text/75 sm:text-lg">
          The earnings coach, accountant and union rep in every gig worker&apos;s pocket. Real hourly wage, unpaid waiting, where to ride next, and appeals written for you.
        </Reveal>
        <Reveal delay={0.85} className="mt-7 flex flex-wrap gap-3">
          <Link href="/signup" className="group flex h-13 items-center gap-2 rounded-full bg-glow-heat px-7 text-[15px] font-extrabold text-night transition hover:brightness-110">
            Start free <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
          </Link>
          <button type="button" onClick={goNext} className="flex h-13 cursor-pointer items-center gap-2 rounded-full border border-white/20 bg-white/5 px-6 text-[15px] font-bold text-white backdrop-blur transition hover:bg-white/10">
            See how it works
          </button>
        </Reveal>
      </div>
      <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-night-line bg-night/60 py-3 backdrop-blur-sm">
        <div className="marquee flex w-max gap-10 whitespace-nowrap text-xs font-extrabold uppercase tracking-[0.25em] text-night-muted">
          {[0, 1].map((k) => (
            <span key={k} className="flex gap-10" aria-hidden={k === 1}>
              <span className="text-night-text/60">Works across</span>
              {PLATFORMS.map((p) => (
                <span key={p.id} className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full" style={{ background: p.color === '#15171B' ? '#fff' : p.color }} />{p.name}</span>
              ))}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function WageChapter() {
  return (
    <Chapter id="wage">
      <Kicker n="01">The real wage</Kicker>
      <div className="grid max-w-[1100px] items-end gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <Reveal className="text-2xl font-bold text-night-text/70 sm:text-3xl">The apps say</Reveal>
          <Reveal delay={0.1} className="num relative inline-block text-[clamp(51px,min(10vw,14.5vh),150px)] font-extrabold leading-none tracking-[-0.04em] text-night-text/35">
            ₹180<span className="text-[0.4em]">/hr</span>
            <motion.span
              className="absolute left-0 top-1/2 h-[6px] w-full origin-left rounded-full bg-danger"
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ amount: 0.6 }}
              transition={{ duration: 0.7, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </Reveal>
          <Reveal delay={0.3} className="mt-4 text-2xl font-bold text-night-text/85 sm:text-3xl">
            Ravi actually <span className="font-serif text-[1.15em] italic text-glow-money">takes home</span>
          </Reveal>
          <div className="num text-[clamp(67px,min(14vw,20.3vh),210px)] font-extrabold leading-[0.9] tracking-[-0.05em] text-glow-money">
            <CountTo from={180} to={94} prefix="₹" delay={0.6} />
            <span className="text-[0.32em] tracking-tight">/hr</span>
          </div>
        </div>
        <Reveal delay={0.4} className="rounded-3xl border border-night-line bg-night-2/80 p-6 backdrop-blur-md">
          <p className="mb-4 text-sm font-extrabold text-night-text">Where the ₹86 goes</p>
          <ul className="flex flex-col gap-3 text-[15px] font-semibold">
            {[
              ['App earnings · 8.2 hrs on orders', '₹1,470', 'text-night-text'],
              ['Petrol · 85 km', '−₹212', 'text-[#FF8A8A]'],
              ['Bike EMI + phone · today’s share', '−₹138', 'text-[#FF8A8A]'],
              ['Hours logged in, incl. waiting', '11.9 hrs', 'text-night-text'],
            ].map(([k, v, c]) => (
              <li key={k} className="flex justify-between gap-4 border-b border-night-line pb-3 last:border-0 last:pb-0">
                <span className="text-night-muted">{k}</span>
                <span className={`num font-extrabold ${c}`}>{v}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs font-semibold text-night-muted">Example rider day. Kilometre does this maths across every app automatically.</p>
        </Reveal>
      </div>
    </Chapter>
  );
}

function WaitChapter() {
  return (
    <Chapter id="wait">
      <Kicker n="02">Unpaid waiting</Kicker>
      <h2 className="max-w-[12ch] font-display text-[clamp(38px,min(7.4vw,10.7vh),112px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
        <Words text="47 minutes." />
        <br />
        <span className="font-serif font-normal italic text-glow-heat"><Words text="Unpaid." delay={0.2} /></span>{' '}
        <Words text="Every day." delay={0.35} />
      </h2>
      <div className="mt-10 flex flex-wrap items-start gap-6">
        <Reveal delay={0.3} className="max-w-[440px] text-[17px] font-medium leading-relaxed text-night-text/75">
          One tap when he reaches the restaurant, one when the food&apos;s ready. Every rider&apos;s taps build the city&apos;s first wait-time map, so everyone knows which kitchens to avoid.
        </Reveal>
        <Reveal delay={0.45} className="flex items-center gap-4 rounded-3xl border border-night-line bg-night-2/80 p-5 backdrop-blur-md">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/20 text-[#FF8A8A]"><Timer size={26} /></span>
          <span className="flex flex-col">
            <span className="num text-4xl font-extrabold tracking-tight">18:42</span>
            <span className="text-xs font-bold text-night-muted">waiting at Biryani Junction · costs ₹29</span>
          </span>
        </Reveal>
      </div>
      <Reveal delay={0.55} className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
        {[['#1E9E5A', 'Under 8 min'], ['#E8A317', '8–18 min'], ['#C22F3D', 'Over 18 min']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-2 rounded-full border border-night-line bg-night/70 px-3 py-1.5 backdrop-blur"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>
        ))}
        <span className="flex items-center rounded-full px-2 py-1.5 text-night-muted">Restaurant names are fictional</span>
      </Reveal>
    </Chapter>
  );
}

function ImportChapter() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const rotY = useTransform(scrollYProgress, [0, 0.5, 1], [-38, -14, 12]);
  const rotX = useTransform(scrollYProgress, [0, 0.5, 1], [18, 8, -6]);
  const lift = useTransform(scrollYProgress, [0, 0.5, 1], [120, 0, -120]);
  const rows = [
    ['12:18 PM', '#SW-48213', '₹52', '+₹10 incentive'],
    ['12:51 PM', '#SW-48247', '₹44', '2.4 km'],
    ['1:42 PM', '#SW-48290', '₹48', 'matches a voice log'],
    ['2:20 PM', '#SW-48315', '₹61', '+₹15 incentive'],
  ];
  return (
    <Chapter id="import">
      <div ref={ref} className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Kicker n="03">Screenshot in, ledger out</Kicker>
          <h2 className="font-display text-[clamp(35px,min(6.4vw,9.3vh),96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
            <Words text="Forward a screenshot." />
            <br />
            <span className="font-serif font-normal italic text-glow-money"><Words text="We do the maths." delay={0.25} /></span>
          </h2>
          <Reveal delay={0.3} className="mt-8 max-w-[460px] text-[17px] font-medium leading-relaxed text-night-text/75">
            No platform gives riders an API, so riders bring their own data. AI reads payout screens from any app, in English, Hindi or Kannada, and skips anything already logged.
          </Reveal>
          <Reveal delay={0.45} className="mt-6 flex flex-wrap gap-2">
            {[[ScanLine, 'Reads any app'], [Upload, 'Duplicates skipped'], [TrendingUp, 'True wage updates']].map(([Icon, t]) => {
              const I = Icon as typeof ScanLine;
              return <span key={t as string} className="flex items-center gap-2 rounded-full border border-night-line bg-night/70 px-3 py-2 text-xs font-bold backdrop-blur"><I size={14} />{t as string}</span>;
            })}
          </Reveal>
        </div>
        <div className="hidden justify-center lg:flex" style={{ perspective: 1400 }}>
          <motion.div style={{ rotateY: rotY, rotateX: rotX, y: lift, transformStyle: 'preserve-3d' }} className="relative w-[360px]">
            <div className="absolute -inset-8 rounded-[48px] bg-glow-money/10 blur-3xl" />
            <div className="relative rounded-[36px] border border-white/15 bg-paper p-5 text-ink shadow-[0_40px_120px_rgba(0,0,0,0.6)]">
              <div className="mb-4 flex items-center justify-between">
                <span className="num text-lg font-extrabold">Review import</span>
                <span className="rounded-full bg-[#FFF1E6] px-2.5 py-1 text-[11px] font-extrabold text-[#9A4A06]">Swiggy</span>
              </div>
              <div className="mb-3 rounded-2xl bg-money-soft px-3 py-2.5 text-[13px] font-bold text-[#075C3B]">✓ 1 duplicate skipped · read in 3 s</div>
              <div className="rounded-2xl bg-white px-4">
                {rows.map(([t, id, amt, note]) => (
                  <div key={id} className="flex items-center gap-3 border-b border-[#EEF0EA] py-3 last:border-0">
                    <div className="flex flex-1 flex-col">
                      <span className="text-sm font-extrabold">{t} · {id}</span>
                      <span className="text-xs font-semibold text-muted">{note}</span>
                    </div>
                    <span className="num text-lg font-extrabold">{amt}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex h-13 items-center justify-center rounded-2xl bg-money text-[15px] font-extrabold text-white">Add ₹205 to my ledger</div>
            </div>
          </motion.div>
        </div>
      </div>
    </Chapter>
  );
}

function WhereChapter({ hour, top }: { hour: number; top: ReturnType<typeof zoneStates>[number] }) {
  const states = zoneStates({ hour }).filter((z) => z.id !== 'chs').slice(0, 3);
  return (
    <Chapter id="where">
      <Kicker n="04">Where the money is</Kicker>
      <div className="grid items-end gap-10 lg:grid-cols-[1.2fr_0.8fr]">
        <h2 className="font-display text-[clamp(35px,min(6.8vw,9.9vh),104px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
          <Words text="Know where to ride" />
          <br />
          <span className="font-serif font-normal italic text-glow-heat"><Words text="before you move." delay={0.25} /></span>
        </h2>
        <Reveal delay={0.3} className="rounded-3xl border border-night-line bg-night-2/85 p-6 backdrop-blur-md">
          <div className="flex items-baseline justify-between">
            <span className="num text-5xl font-extrabold tracking-tight">{formatHour(hour)}</span>
            <span className="rounded-full bg-glow-heat/15 px-3 py-1 text-xs font-extrabold text-glow-heat">{periodLabel(hour)}</span>
          </div>
          <p className="mt-1 text-xs font-bold text-night-muted">Keep scrolling to move the clock</p>
          <ol className="mt-5 flex flex-col gap-2">
            {states.map((z, i) => (
              <li key={z.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${i === 0 ? 'bg-white text-ink' : 'bg-white/5'}`}>
                <span className={`num w-5 text-sm font-extrabold ${i === 0 ? 'text-heat' : 'text-night-muted'}`}>{i + 1}</span>
                <span className="flex-1 text-[15px] font-extrabold">{z.name}</span>
                <span className={`num text-lg font-extrabold ${i === 0 ? 'text-money' : ''}`}>₹{z.rate}<span className="text-xs font-semibold opacity-60">/hr</span></span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[13px] font-semibold text-night-text/70">The line on the map: from Ravi in BTM to {top.name}, the best zone right now.</p>
          <div className="mt-4 flex gap-2 text-xs font-bold text-night-muted">
            <span className="flex items-center gap-1.5 rounded-full border border-night-line px-3 py-1.5"><CloudRain size={14} /> Rain surge</span>
            <span className="flex items-center gap-1.5 rounded-full border border-night-line px-3 py-1.5"><Flag size={14} /> Match nights</span>
          </div>
        </Reveal>
      </div>
    </Chapter>
  );
}

const LETTER = 'Dear Swiggy Partner Support, my delivery partner account was deactivated after my last shift on 22 Sep 2026, and I have not been given a reason. Since March I have completed 312 deliveries with a 4.8 rating and no customer complaints on record. I request the specific reason for this action, reinstatement of my account, and a written reply within 7 days.';

function AppealChapter() {
  return (
    <Chapter id="appeal">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Kicker n="05">Rights, written for you</Kicker>
          <h2 className="font-display text-[clamp(35px,min(6.4vw,9.3vh),96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
            <Words text="ID blocked?" />
            <br />
            <Words text="Your appeal is ready in" delay={0.15} />{' '}
            <span className="font-serif font-normal italic text-glow-money"><Words text="ten seconds." delay={0.4} /></span>
          </h2>
          <Reveal delay={0.3} className="mt-8 max-w-[460px] text-[17px] font-medium leading-relaxed text-night-text/75">
            Speak in any language. Kilometre writes a formal letter using only facts from the rider&apos;s own log: trips, ratings, dates. The platforms won&apos;t build this. It isn&apos;t on their side.
          </Reveal>
        </div>
        <Reveal delay={0.2} className="rounded-3xl border border-night-line bg-night-2/90 p-6 backdrop-blur-md">
          <div className="mb-4 rounded-2xl bg-white/5 p-4">
            <span className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-night-muted">Ravi said</span>
            <p lang="hi" className="mt-1 text-[15px] font-semibold">मेरी ID 3 दिन से ब्लॉक है। कोई कारण नहीं बताया।</p>
          </div>
          <div className="mb-4 flex flex-wrap gap-2 text-xs font-bold">
            {['312 deliveries', '4.8 ★ rating', '0 complaints', 'Last active 22 Sep'].map((t) => (
              <span key={t} className="rounded-full bg-glow-money/15 px-3 py-1.5 text-glow-money">{t}</span>
            ))}
          </div>
          <div className="rounded-2xl bg-paper p-5 text-ink">
            <div className="mb-2 flex items-center gap-2 text-xs font-extrabold text-muted"><FileText size={14} /> AI draft · facts from your log only</div>
            <p className="min-h-[168px] text-[14px] font-medium leading-relaxed"><Typewriter text={LETTER} /></p>
          </div>
        </Reveal>
      </div>
    </Chapter>
  );
}

function JoinChapter({ signedIn }: { signedIn: boolean }) {
  return (
    <section id="join" className="relative flex min-h-screen flex-col justify-center">
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8">
        <Kicker n="06">Free for riders</Kicker>
        <h2 className="font-display text-[clamp(45px,min(10vw,14.5vh),160px)] font-extrabold leading-[0.88] tracking-[-0.05em]">
          <Words text="Ride smarter." />
          <br />
          <span className="font-serif font-normal italic text-glow-heat"><Words text="Get paid fairly." delay={0.2} /></span>
        </h2>
        <Reveal delay={0.35} className="mt-10 flex flex-wrap gap-3">
          <Link href={signedIn ? '/app' : '/signup'} className="group flex h-14 items-center gap-2 rounded-full bg-glow-heat px-8 text-base font-extrabold text-night transition hover:brightness-110">
            {signedIn ? 'Open Kilometre' : 'Create free account'} <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
          </Link>
          {!signedIn && (
            <Link href="/login" className="flex h-14 items-center rounded-full border border-white/20 bg-white/5 px-7 text-base font-bold backdrop-blur transition hover:bg-white/10">Log in</Link>
          )}
        </Reveal>
        <Reveal delay={0.45} className="mt-10 grid max-w-[900px] gap-4 sm:grid-cols-3">
          {[
            ['Riders pay nothing', 'Revenue comes from loan, insurance and EV-rental partners.'],
            [`${ZONES.length} zones mapped`, 'Koramangala to Electronic City, lunch to late night.'],
            ['Your data, your side', 'Consent first. Only anonymised totals reach the map.'],
          ].map(([h, p]) => (
            <div key={h} className="rounded-2xl border border-night-line bg-night-2/70 p-5 backdrop-blur">
              <p className="text-[15px] font-extrabold">{h}</p>
              <p className="mt-1 text-[13px] font-medium leading-relaxed text-night-muted">{p}</p>
            </div>
          ))}
        </Reveal>
      </div>
      <footer className="mx-auto mt-16 w-full max-w-[1400px] px-5 pb-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6 border-t border-night-line pt-6">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-night-muted">Co-founders</p>
            <ol className="mt-2 flex flex-wrap gap-x-8 gap-y-1 font-display text-lg font-extrabold text-night-text">
              <li><span className="num mr-2 text-glow-heat">1.</span>Daksh Bhatt</li>
              <li><span className="num mr-2 text-glow-heat">2.</span>Shourya Chouhan</li>
            </ol>
          </div>
          <p className="max-w-md text-xs font-semibold text-night-muted">
            Map demand is simulated for this demo. Map data © OpenStreetMap contributors · tiles by OpenFreeMap.
          </p>
        </div>
      </footer>
    </section>
  );
}
