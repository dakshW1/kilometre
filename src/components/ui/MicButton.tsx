'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { Mic, MicOff } from 'lucide-react';

type Rec = {
  lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
type SpeechWindow = { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
const LOCALE = { en: 'en-IN', hi: 'hi-IN', kn: 'kn-IN' } as const;
const noop = () => () => {};
const hasSpeech = () => {
  const w = window as unknown as SpeechWindow;
  return !!(w.SpeechRecognition || w.webkitSpeechRecognition);
};

// Browser speech-to-text (Chrome and Edge). Renders nothing where the browser has no support.
export default function MicButton({ lang, onText, className = '' }: { lang: keyof typeof LOCALE; onText: (t: string) => void; className?: string }) {
  const supported = useSyncExternalStore(noop, hasSpeech, () => false);
  const [on, setOn] = useState(false);
  const rec = useRef<Rec | null>(null);

  const toggle = () => {
    if (on) { rec.current?.stop(); return; }
    const w = window as unknown as SpeechWindow;
    const R = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!R) return;
    const r = new R();
    r.lang = LOCALE[lang];
    r.interimResults = false;
    r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(' '));
    r.onend = () => setOn(false);
    r.onerror = () => setOn(false);
    rec.current = r;
    setOn(true);
    r.start();
  };

  if (!supported) return null;
  return (
    <button type="button" onClick={toggle} aria-pressed={on} aria-label={on ? 'Stop listening' : 'Speak instead'}
      className={`flex h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm font-extrabold transition ${on ? 'border-danger bg-danger-soft text-[#A3202E]' : 'border-line bg-surface hover:border-ink/30'} ${className}`}>
      {on
        ? <><span className="relative flex h-2.5 w-2.5"><span className="pulse-ring absolute h-full w-full rounded-full bg-danger" /><span className="relative h-2.5 w-2.5 rounded-full bg-danger" /></span><MicOff size={16} /> Listening… tap to stop</>
        : <><Mic size={16} /> Speak instead</>}
    </button>
  );
}
