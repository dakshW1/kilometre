'use client';

import { useSyncExternalStore } from 'react';

// One shared 1-second ticker for every live clock on the page.
let now = Date.now();
const subscribers = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(cb: () => void) {
  subscribers.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => { now = Date.now(); subscribers.forEach((f) => f()); }, 1000);
  }
  return () => {
    subscribers.delete(cb);
    if (!subscribers.size) { clearInterval(timer); timer = undefined; }
  };
}

/** Current time in ms, ticking every second. `null` during server render, so nothing fake is ever shown. */
export function useNow(): number | null {
  return useSyncExternalStore(subscribe, () => now, () => null);
}

const hourFmt = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', hour12: false });
const timeFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', hour12: true });
const secFmt = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });

/** Hour of day (0–23) in Bengaluru. */
export const istHour = (ms: number = Date.now()) => Number(hourFmt.format(ms)) % 24;
/** "3:42 am" style, upper-cased: "3:42 AM". */
export const istTime = (ms: number, seconds = false) => (seconds ? secFmt : timeFmt).format(ms).toUpperCase();
