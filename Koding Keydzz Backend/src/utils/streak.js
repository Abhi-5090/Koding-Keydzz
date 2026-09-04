/**
 * DAILY STREAKS — the reward the app was already promising.
 *
 * The student XP legend advertised "Daily streak bonus +150" and the landing
 * page mentioned streaks, and there was no streak field, no counter and no
 * award anywhere on the server. A child was told there was a reason to come
 * back tomorrow and there wasn't one.
 *
 * WHAT COUNTS AS A STREAK DAY
 * ---------------------------
 * A day on which the pupil finished some LEARNING: a lesson, a quiz, a
 * challenge, a game level, or a final test. Signing in does not count. A
 * streak that could be kept alive by opening the app would reward the habit of
 * opening the app, which is not the habit worth building.
 *
 * WHY THE TIMEZONE MATTERS
 * ------------------------
 * A "day" has to be the pupil's local day. Counted in UTC, the boundary for a
 * child in India falls at 05:30 local time, so an evening session and the next
 * evening's session are two days apart in local terms but can land on the same
 * UTC date — or three days apart. Streaks would break for exactly the children
 * who use the app after school, which is most of them.
 *
 * Organizations carry a timezone (defaulting to Asia/Kolkata), and it is
 * threaded in here. `Intl` does the conversion, so there is no dependency and
 * no hand-rolled offset table to go stale at a DST change.
 */

/** The bonus a pupil earns for extending a streak, as advertised in the UI. */
export const STREAK_BONUS_XP = 150;

/** Streak length at which the bonus starts (a first day is not yet a streak). */
export const STREAK_BONUS_FROM_DAY = 2;

/**
 * The pupil's local calendar day, as `YYYY-MM-DD`.
 *
 * `en-CA` is used because it formats as ISO — the point is a comparable,
 * sortable day key, not a display string. An unknown timezone falls back to
 * UTC rather than throwing: a bad org setting must not break a lesson.
 */
export function dayKey(when, timeZone = 'Asia/Kolkata') {
  const date = when instanceof Date ? when : new Date(when);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

/** Whole days between two `YYYY-MM-DD` keys. Negative if `b` precedes `a`. */
export function daysBetween(a, b) {
  if (!a || !b) return null;
  // Parsed as UTC midnight on both sides, so the difference is exact and
  // unaffected by the timezone the keys were produced in.
  const from = Date.parse(`${a}T00:00:00Z`);
  const to = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / 86_400_000);
}

/**
 * Work out the next streak state. PURE — no database, no clock.
 *
 * Returns the new state plus what changed, so the caller can decide whether to
 * award the bonus and whether a write is needed at all.
 *
 * The four cases:
 *   • no previous day        → day 1 of a new streak
 *   • same day               → nothing happens (this is the common case, and
 *                              it must not award a second bonus)
 *   • exactly one day later  → the streak extends
 *   • two or more days later → the streak is broken and restarts at 1
 *
 * A `lastActiveOn` in the FUTURE (a clock skew, or an organization moved to a
 * timezone behind the old one) is treated as the same day rather than as a
 * break: penalising a child for an administrator's setting change would be
 * both unfair and impossible for them to understand.
 */
export function nextStreak(previous, today) {
  const current = Math.max(0, Number(previous?.current) || 0);
  const longest = Math.max(0, Number(previous?.longest) || 0);
  const lastActiveOn = previous?.lastActiveOn || null;

  if (!today) {
    return { current, longest, lastActiveOn, changed: false, extended: false, reset: false };
  }

  if (!lastActiveOn || current === 0) {
    return {
      current: 1,
      longest: Math.max(longest, 1),
      lastActiveOn: today,
      changed: true,
      extended: true,
      reset: false,
    };
  }

  const gap = daysBetween(lastActiveOn, today);

  if (gap === null || gap <= 0) {
    // Same day, or a clock/timezone anomaly. Nothing to record.
    return { current, longest, lastActiveOn, changed: false, extended: false, reset: false };
  }

  if (gap === 1) {
    const next = current + 1;
    return {
      current: next,
      longest: Math.max(longest, next),
      lastActiveOn: today,
      changed: true,
      extended: true,
      reset: false,
    };
  }

  return {
    current: 1,
    longest: Math.max(longest, current),
    lastActiveOn: today,
    changed: true,
    extended: false,
    reset: true,
  };
}

/**
 * The XP bonus for the streak state just reached.
 *
 * Paid only when the streak actually MOVED to a new day, and not on day one —
 * a first day is the start of a streak, not the continuation of one, and
 * paying it there would hand the bonus to every pupil who ever opened a lesson
 * once.
 */
export function streakBonusFor(state) {
  if (!state?.changed || !state?.extended) return 0;
  if (state.current < STREAK_BONUS_FROM_DAY) return 0;
  return STREAK_BONUS_XP;
}

export default {
  STREAK_BONUS_XP,
  STREAK_BONUS_FROM_DAY,
  dayKey,
  daysBetween,
  nextStreak,
  streakBonusFor,
};
