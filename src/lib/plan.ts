// Kilometre Pro: 30-day free trial from sign-up, then ₹99/month. Display only: nothing is ever locked.
export const TRIAL_DAYS = 30;
export const PRICE_PER_MONTH = 99;

export function trialStatus(createdAt?: string | null, now = Date.now()) {
  const start = createdAt ? Date.parse(createdAt) : now;
  const end = start + TRIAL_DAYS * 86400000;
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
  const used = Math.min(TRIAL_DAYS, TRIAL_DAYS - daysLeft);
  return { start, end, daysLeft, used, active: daysLeft > 0, progress: used / TRIAL_DAYS };
}
