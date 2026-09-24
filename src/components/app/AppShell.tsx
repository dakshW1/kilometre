'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { House, LogOut, Map, Mic, Scale, Timer, Upload } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { useProfile } from './ProfileContext';
import { useWeather } from '@/lib/useWeather';
import { RainAlertBanner } from '@/components/weather/WeatherBits';
import { WeatherContext } from '@/components/weather/WeatherContext';

const NAV = [
  { href: '/app', label: 'Home', icon: House },
  { href: '/app/pulse', label: 'City Pulse', icon: Map },
  { href: '/app/wait', label: 'Wait timer', icon: Timer },
  { href: '/app/import', label: 'Import', icon: Upload },
  { href: '/app/log', label: 'Quick log', icon: Mic },
  { href: '/app/appeal', label: 'Appeals', icon: Scale },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const { profile, dbReady } = useProfile();
  // Add ?rain=1 to any app URL to demo the rain alert on a dry day (clearly marked simulated).
  // ?rain=1 stays on while you move around the app (for the stage demo); ?rain=0 turns it off.
  const params = useSearchParams();
  const rainParam = params.get('rain');
  const [simRain, setSimRain] = useState(false);
  useEffect(() => {
    try {
      if (rainParam === '1') sessionStorage.setItem('km-sim-rain', '1');
      if (rainParam === '0') sessionStorage.removeItem('km-sim-rain');
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sessionStorage is browser-only
      setSimRain(sessionStorage.getItem('km-sim-rain') === '1');
    } catch { setSimRain(rainParam === '1'); }
  }, [rainParam]);
  const weather = useWeather(profile.home_zone, simRain);
  const active = (href: string) => (href === '/app' ? path === '/app' : path.startsWith(href));

  return (
    <div className="min-h-screen bg-paper lg:pl-[76px]">
      <nav aria-label="Main" className="fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col items-center gap-2 border-r border-line bg-surface py-4 lg:flex">
        <Link href="/" aria-label="Kilometre home" className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-ink text-white">
          <LogoMark size={26} className="text-white" />
        </Link>
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active(href) ? 'page' : undefined}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition ${active(href) ? 'bg-ink text-white' : 'text-muted hover:bg-paper hover:text-ink'}`}
          >
            <Icon size={21} strokeWidth={1.9} />
            <span className="pointer-events-none absolute left-[60px] whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-xs font-bold text-white opacity-0 transition group-hover:opacity-100">{label}</span>
          </Link>
        ))}
        <div className="flex-1" />
        <form action="/auth/signout" method="post">
          <button type="submit" aria-label="Sign out" className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-2xl text-muted transition hover:bg-paper hover:text-ink">
            <LogOut size={20} />
          </button>
        </form>
        <div className="num mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-heat-soft text-sm font-extrabold text-heat" title={profile.name}>
          {(profile.name || 'R').slice(0, 1).toUpperCase()}
        </div>
      </nav>

      {!dbReady && (
        <div className="bg-amber-soft px-5 py-2.5 text-center text-[13px] font-bold text-[#5C3A00]">
          Database tables not found. Run <code className="font-mono">supabase/schema.sql</code> in the Supabase SQL Editor, then refresh.
        </div>
      )}

      <RainAlertBanner report={weather} />

      <WeatherContext.Provider value={weather}>
        <div className="pb-24 lg:pb-0">{children}</div>
      </WeatherContext.Provider>

      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 flex h-[72px] items-stretch justify-around border-t border-line bg-surface/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        {NAV.filter((n) => n.href !== '/app/log').map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href) ? 'page' : undefined}
            className={`flex min-w-[56px] flex-col items-center justify-center gap-1 text-[10.5px] font-bold ${active(href) ? 'text-ink' : 'text-muted'}`}
          >
            <span className={`flex h-8 w-12 items-center justify-center rounded-full transition ${active(href) ? 'bg-ink text-white' : ''}`}><Icon size={19} /></span>
            {label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}
