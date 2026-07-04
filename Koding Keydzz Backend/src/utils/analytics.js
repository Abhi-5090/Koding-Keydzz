// Pure (DB-free) analytics helpers, extracted so they can be unit-tested.

// XP buckets used for the platform-wide student XP distribution.
export const XP_BUCKETS = [
  { bucket: '0-99', min: 0, max: 100 },
  { bucket: '100-499', min: 100, max: 500 },
  { bucket: '500-1999', min: 500, max: 2000 },
  { bucket: '2000-4999', min: 2000, max: 5000 },
  { bucket: '5000-9999', min: 5000, max: 10000 },
  { bucket: '10000+', min: 10000, max: Infinity },
];

/**
 * Return the bucket label for a given XP value.
 */
export function xpBucket(xp) {
  const value = Math.max(0, Number(xp) || 0);
  const found = XP_BUCKETS.find((b) => value >= b.min && value < b.max);
  return found ? found.bucket : XP_BUCKETS[XP_BUCKETS.length - 1].bucket;
}

/**
 * Bucketize a list of xp values into the standard XP_BUCKETS, always returning
 * every bucket (zero-filled) in canonical order.
 */
export function bucketizeXp(xpValues = []) {
  const counts = Object.fromEntries(XP_BUCKETS.map((b) => [b.bucket, 0]));
  for (const xp of xpValues) {
    counts[xpBucket(xp)] += 1;
  }
  return XP_BUCKETS.map((b) => ({ bucket: b.bucket, count: counts[b.bucket] }));
}

/**
 * Format a Date as 'YYYY-MM'.
 */
export function monthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Return the last `n` month keys ('YYYY-MM') ending with the month of `ref`
 * (defaults to now), oldest first.
 */
export function lastNMonths(n = 6, ref = new Date()) {
  const base = ref instanceof Date ? ref : new Date(ref);
  const keys = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() - i, 1));
    keys.push(monthKey(d));
  }
  return keys;
}

/**
 * Given aggregation rows of { period:'YYYY-MM', count } and a list of month
 * keys, produce a zero-filled series in the order of `months`.
 */
export function fillMonthlySeries(rows = [], months = []) {
  const map = new Map(rows.map((r) => [r.period, r.count]));
  return months.map((period) => ({ period, count: map.get(period) || 0 }));
}

export default {
  XP_BUCKETS,
  xpBucket,
  bucketizeXp,
  monthKey,
  lastNMonths,
  fillMonthlySeries,
};
