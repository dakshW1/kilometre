'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { istHour } from '@/lib/clock';
import type { Map as MLMap } from 'maplibre-gl';
import { Logo } from '@/components/ui/Logo';

const CityMap = dynamic(() => import('@/components/map/CityMap'), { ssr: false });

export default function AuthShell({ children, title, subtitle, supabaseReady }: {
  children: ReactNode; title: ReactNode; subtitle: string; supabaseReady: boolean;
}) {
  const mapRef = useRef<MLMap | null>(null);
  const [conditions] = useState(() => ({ hour: istHour() }));

  // Slow orbit behind the quote card.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const m = mapRef.current;
      if (m) m.setBearing(m.getBearing() + 0.04);
      raf = requestAnimationFrame(tick);
    };
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[minmax(0,560px)_1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Link href="/" aria-label="Kilometre home" className="self-start"><Logo /></Link>
        <div className="flex flex-1 flex-col justify-center py-10">
          <div className="mx-auto w-full max-w-[400px]">
            <h1 className="font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.04em]">{title}</h1>
            <p className="mt-3 text-[15px] font-medium text-muted">{subtitle}</p>
            {!supabaseReady && (
              <p className="mt-6 rounded-2xl bg-amber-soft px-4 py-3 text-sm font-bold text-[#5C3A00]">
                Supabase isn&apos;t connected yet. Add your keys to <code className="font-mono">.env.local</code> and restart the dev server.
              </p>
            )}
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-night lg:block">
        <CityMap
          theme="night"
          interactive={false}
          conditions={conditions}
          initialCamera={{ center: [77.628, 12.945], zoom: 12.2, pitch: 62, bearing: 20 }}
          onReady={(m) => { mapRef.current = m; }}
        />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(0deg,rgba(9,12,18,0.85)_0%,rgba(9,12,18,0)_55%)]" />
        <figure className="absolute inset-x-10 bottom-10 max-w-[560px] text-night-text">
          <blockquote className="font-serif text-[40px] italic leading-[1.1]">
            &ldquo;I thought I made ₹180 an hour. Kilometre showed me it was ₹94.&rdquo;
          </blockquote>
          <figcaption className="mt-4 text-sm font-bold text-night-muted">Ravi, delivery partner · example persona</figcaption>
        </figure>
      </div>
    </div>
  );
}

export function Field({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-extrabold text-ink-2">{label}</span>
      <input
        {...props}
        className="h-13 rounded-2xl border border-line bg-surface px-4 text-[15px] font-semibold text-ink outline-none transition placeholder:text-muted/60 focus:border-ink focus:ring-4 focus:ring-ink/10"
      />
    </label>
  );
}
