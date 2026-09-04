/**
 * Pure helpers for building chart-ready time series and comparison metrics.
 *
 * The dashboards need series that are DENSE — a day with no activity must
 * appear as a zero, not be missing — otherwise a line chart draws a straight
 * line across a quiet weekend and the shape lies. Mongo's `$group` only
 * returns days that have data, so every series is filled against a generated
 * range here.
 *
 * All functions are pure and take an explicit `now`, so they can be tested
 * without mocking the clock.
 */

/** 'YYYY-MM-DD' in UTC. */
export function dayKey(date) {
  const d = new Date(date);
  return d.toISOString().slice(0, 10);
}

/** 'YYYY-MM' in UTC. */
export function monthKey(date) {
  return new Date(date).toISOString().slice(0, 7);
}

/**
 * The last `n` day keys, oldest first, inclusive of today.
 * lastNDays(3, '2026-09-02') -> ['2026-08-31','2026-09-01','2026-09-02']
 */
export function lastNDays(n = 30, ref = new Date()) {
  const out = [];
  const base = new Date(ref);
  base.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** The last `n` month keys, oldest first, inclusive of this month. */
export function lastNMonths(n = 12, ref = new Date()) {
  const out = [];
  const base = new Date(
    Date.UTC(new Date(ref).getUTCFullYear(), new Date(ref).getUTCMonth(), 1)
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() - i);
    out.push(monthKey(d));
  }
  return out;
}

/**
 * Fill a sparse aggregation result against a dense key list.
 *
 * @param {Array<{_id:string,count:number}>} rows  Mongo $group output
 * @param {string[]} keys                          dense key list
 * @param {string} [label]                         output label field name
 * @returns {Array<{label:string,value:number}>}
 */
export function densify(rows = [], keys = [], label = 'label') {
  const map = new Map(
    rows.map((r) => [String(r._id ?? r.key ?? r[label]), Number(r.count ?? r.value ?? 0)])
  );
  return keys.map((k) => ({ [label]: k, value: map.get(k) || 0 }));
}

/**
 * Percentage change between two periods, guarding the divide-by-zero that
 * otherwise renders as "Infinity%" on a KPI tile.
 *
 * @returns {{ value:number, previous:number, delta:number|null, direction:'up'|'down'|'flat' }}
 *   `delta` is null when there is no previous baseline to compare against —
 *   the tile should then show "—" rather than a fake +100%.
 */
export function compare(value, previous) {
  const v = Number(value) || 0;
  const p = Number(previous) || 0;
  let delta = null;
  if (p > 0) delta = Math.round(((v - p) / p) * 100);
  else if (v > 0) delta = null; // new activity from a zero base: no honest %
  else delta = 0;

  return {
    value: v,
    previous: p,
    delta,
    direction: v > p ? 'up' : v < p ? 'down' : 'flat',
  };
}

/** Safe rounded percentage. */
export function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((Number(numerator) / Number(denominator)) * 100);
}

/** Average of a numeric array, rounded, 0 for empty. */
export function avg(values = []) {
  if (!values.length) return 0;
  return Math.round(values.reduce((a, b) => a + (Number(b) || 0), 0) / values.length);
}

/**
 * Median — reported alongside the mean because a handful of very engaged
 * students skews an average badly, and a teacher reading "average XP 1,400"
 * when the median is 180 is being misled.
 */
export function median(values = []) {
  if (!values.length) return 0;
  const sorted = [...values].map(Number).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/**
 * Bucket a set of values into labelled bands.
 * @param {number[]} values
 * @param {Array<{label:string,min:number,max:number}>} bands  max exclusive
 */
export function bucketize(values = [], bands = []) {
  const counts = bands.map((b) => ({ label: b.label, value: 0 }));
  for (const raw of values) {
    const v = Number(raw) || 0;
    const idx = bands.findIndex((b) => v >= b.min && v < b.max);
    if (idx !== -1) counts[idx].value += 1;
  }
  return counts;
}

export default {
  dayKey,
  monthKey,
  lastNDays,
  lastNMonths,
  densify,
  compare,
  pct,
  avg,
  median,
  bucketize,
};
