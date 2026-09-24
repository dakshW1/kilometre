// Record-level duplicate detection for imported orders (file-level dedup is the sha256 check).
export type ExistingOrder = { id: string; platform: string; date: string; time: string | null; order_id: string | null; amount: number; source: string };
export type Candidate = { order_id: string | null; time: string | null; amount: number };
export type DedupResult =
  | { status: 'new' }
  | { status: 'duplicate'; match: ExistingOrder }
  | { status: 'possible'; match: ExistingOrder };

const minutes = (t: string | null) => {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};

export function classify(c: Candidate, platform: string, date: string | null, existing: ExistingOrder[]): DedupResult {
  const same = existing.filter((e) => e.platform === platform);
  // Layer 2: same order id on the same platform is the same order.
  if (c.order_id) {
    const hit = same.find((e) => e.order_id && e.order_id.toLowerCase() === c.order_id!.toLowerCase());
    if (hit) return { status: 'duplicate', match: hit };
  }
  // Layer 3: no id (or a new id vs an id-less manual log): same day, amount within ₹1, time within 10 min.
  if (date) {
    const t = minutes(c.time);
    const hit = same.find((e) => {
      if (e.date !== date || Math.abs(Number(e.amount) - c.amount) > 1) return false;
      if (c.order_id && e.order_id) return false; // two different ids are two different orders
      const et = minutes(e.time);
      return t === null || et === null ? true : Math.abs(et - t) <= 10;
    });
    if (hit) return { status: 'possible', match: hit };
  }
  return { status: 'new' };
}
