'use client';

import { animate, motion, useInView } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Reveal({ children, delay = 0, className, y = 40 }: { children: ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(10px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ amount: 0.4 }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

// Headline that rises in word by word, like a title sequence.
// The trigger lives on the wrapper: the words start clipped out of view, so they can't observe themselves.
export function Words({ text, className, delay = 0, stagger = 0.06 }: { text: string; className?: string; delay?: number; stagger?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.3 });
  const words = text.split(' ');
  return (
    <span ref={ref} className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom" aria-hidden="true">
          <motion.span
            className="inline-block"
            initial={{ y: '110%', rotate: 4 }}
            animate={inView ? { y: '0%', rotate: 0 } : { y: '110%', rotate: 4 }}
            transition={{ duration: 0.85, ease: EASE, delay: inView ? delay + i * stagger : 0 }}
          >
            {w}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

export function CountTo({ from, to, prefix = '', suffix = '', className, duration = 1.6, delay = 0.3, onMount = false }: {
  from: number; to: number; prefix?: string; suffix?: string; className?: string; duration?: number; delay?: number;
  /** Start immediately instead of waiting to scroll into view (for above-the-fold numbers). */
  onMount?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { amount: 0.6 });
  const inView = onMount || seen;
  const [value, setValue] = useState(from);
  useEffect(() => {
    if (!inView) return;
    // Drive React state (not a motion value) so the text updates even when animation frames are throttled.
    const controls = animate(from, to, { duration, delay, ease: EASE, onUpdate: (v) => setValue(v) });
    const settle = setTimeout(() => { controls.stop(); setValue(to); }, (delay + duration) * 1000 + 150);
    return () => { controls.stop(); clearTimeout(settle); };
  }, [inView, from, to, duration, delay]);
  return <span ref={ref} className={className}>{`${prefix}${Math.round(value).toLocaleString('en-IN')}${suffix}`}</span>;
}

export function Typewriter({ text, className, speed = 14 }: { text: string; className?: string; speed?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: true });
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!inView) return;
    const id = setInterval(() => setN((v) => (v >= text.length ? v : v + 2)), speed);
    return () => clearInterval(id);
  }, [inView, text, speed]);
  return (
    <span ref={ref} className={className}>
      {text.slice(0, n)}
      {n < text.length && <span className="caret ml-0.5 inline-block h-[1em] w-[2px] translate-y-[2px] bg-current" />}
    </span>
  );
}
