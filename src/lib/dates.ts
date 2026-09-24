// All dates are Bengaluru dates (IST), whatever timezone the server runs in.
const IST = 'Asia/Kolkata';

export function isoDateIST(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00+05:30`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDateIST(d);
}

export function prettyDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' }) {
  return new Intl.DateTimeFormat('en-IN', { timeZone: IST, ...opts }).format(new Date(`${iso}T12:00:00+05:30`));
}

export function hourIST(d = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hour12: false }).format(d)) % 24;
}

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
