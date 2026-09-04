import { describe, it, expect } from 'vitest';
import {
  dayKey,
  daysBetween,
  nextStreak,
  streakBonusFor,
  STREAK_BONUS_XP,
} from '../src/utils/streak.js';

/**
 * DAILY STREAKS.
 *
 * The student XP legend advertised "Daily streak bonus +150" and the server had
 * no streak field, no counter and no award — a promise made to children and
 * never paid. This is the logic that makes it true, tested as pure functions so
 * every awkward case can be stated directly rather than staged through a
 * database.
 *
 * The awkward cases are all about CALENDAR DAYS, not elapsed time, and that is
 * where this kind of code usually goes wrong.
 */

describe('dayKey', () => {
  it('returns the pupil’s LOCAL day, not the UTC one', () => {
    /**
     * The case that decides whether streaks work at all for this product's
     * actual users. 20:00 in Kolkata on the 5th is 14:30 UTC on the 5th — but
     * an evening session at 23:00 IST is 17:30 UTC, and one at 01:00 IST is
     * the PREVIOUS UTC day. Counted in UTC, a child doing their homework after
     * dinner would see their streak break at random.
     */
    const evening = new Date('2026-09-05T18:30:00Z'); // midnight IST on the 6th
    expect(dayKey(evening, 'Asia/Kolkata')).toBe('2026-09-06');
    expect(dayKey(evening, 'UTC')).toBe('2026-09-05');
  });

  it('formats as a sortable YYYY-MM-DD key', () => {
    expect(dayKey(new Date('2026-01-02T06:00:00Z'), 'Asia/Kolkata')).toBe('2026-01-02');
  });

  it('handles a timezone west of UTC', () => {
    // 02:00 UTC on the 6th is still the evening of the 5th in New York.
    expect(dayKey(new Date('2026-09-06T02:00:00Z'), 'America/New_York')).toBe('2026-09-05');
  });

  it('falls back to UTC rather than throwing on a bad timezone', () => {
    // A mistyped organization setting must not break a lesson completion.
    expect(dayKey(new Date('2026-09-05T12:00:00Z'), 'Not/AZone')).toBe('2026-09-05');
  });

  it('returns null for an unusable date', () => {
    expect(dayKey('not a date')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('counts whole calendar days', () => {
    expect(daysBetween('2026-09-05', '2026-09-06')).toBe(1);
    expect(daysBetween('2026-09-05', '2026-09-05')).toBe(0);
    expect(daysBetween('2026-09-05', '2026-09-12')).toBe(7);
  });

  it('crosses a month boundary', () => {
    expect(daysBetween('2026-09-30', '2026-10-01')).toBe(1);
  });

  it('crosses a year boundary', () => {
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('handles a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-02-29')).toBe(1);
    expect(daysBetween('2028-02-29', '2028-03-01')).toBe(1);
  });

  it('is negative when the second key is earlier', () => {
    expect(daysBetween('2026-09-06', '2026-09-05')).toBe(-1);
  });
});

describe('nextStreak', () => {
  it('starts a streak at one', () => {
    const s = nextStreak(null, '2026-09-05');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(1);
    expect(s.changed).toBe(true);
  });

  it('extends on the very next day', () => {
    const s = nextStreak({ current: 3, longest: 5, lastActiveOn: '2026-09-05' }, '2026-09-06');
    expect(s.current).toBe(4);
    expect(s.extended).toBe(true);
    expect(s.reset).toBe(false);
  });

  it('DOES NOTHING on a second activity the same day', () => {
    /**
     * The most important refusal here. This runs on every lesson, quiz and
     * game level, so a child doing five lessons in an afternoon would
     * otherwise reach a five-day streak and collect five bonuses.
     */
    const s = nextStreak({ current: 3, longest: 5, lastActiveOn: '2026-09-05' }, '2026-09-05');
    expect(s.current).toBe(3);
    expect(s.changed).toBe(false);
    expect(streakBonusFor(s)).toBe(0);
  });

  it('resets after a missed day', () => {
    const s = nextStreak({ current: 9, longest: 9, lastActiveOn: '2026-09-05' }, '2026-09-07');
    expect(s.current).toBe(1);
    expect(s.reset).toBe(true);
    expect(s.extended).toBe(false);
  });

  it('REMEMBERS the longest streak through a reset', () => {
    // The number a child is proud of. Losing it on a missed day would make the
    // reset feel like a punishment rather than a fresh start.
    const s = nextStreak({ current: 12, longest: 12, lastActiveOn: '2026-09-05' }, '2026-09-20');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(12);
  });

  it('raises the longest as the current passes it', () => {
    const s = nextStreak({ current: 6, longest: 6, lastActiveOn: '2026-09-05' }, '2026-09-06');
    expect(s.current).toBe(7);
    expect(s.longest).toBe(7);
  });

  it('treats a FUTURE last-active day as the same day, not a break', () => {
    /**
     * Reachable in practice: an administrator moves the organization to a
     * timezone behind the old one, and yesterday's stored key is now
     * "tomorrow". Resetting the child's streak over a settings change would be
     * unfair and completely inexplicable to them.
     */
    const s = nextStreak({ current: 8, longest: 8, lastActiveOn: '2026-09-10' }, '2026-09-05');
    expect(s.current).toBe(8);
    expect(s.changed).toBe(false);
  });

  it('restarts cleanly when a counter is zero but a day is stored', () => {
    const s = nextStreak({ current: 0, longest: 4, lastActiveOn: '2026-09-01' }, '2026-09-05');
    expect(s.current).toBe(1);
    expect(s.longest).toBe(4);
  });

  it('survives a missing day key without corrupting the state', () => {
    const s = nextStreak({ current: 3, longest: 3, lastActiveOn: '2026-09-05' }, null);
    expect(s.current).toBe(3);
    expect(s.changed).toBe(false);
  });
});

describe('streakBonusFor', () => {
  it('pays nothing on day one', () => {
    // A first day is the start of a streak, not the continuation of one.
    // Paying here would hand the bonus to every pupil who opens one lesson.
    expect(streakBonusFor(nextStreak(null, '2026-09-05'))).toBe(0);
  });

  it('pays from day two onward', () => {
    const day2 = nextStreak({ current: 1, longest: 1, lastActiveOn: '2026-09-05' }, '2026-09-06');
    expect(streakBonusFor(day2)).toBe(STREAK_BONUS_XP);
    expect(STREAK_BONUS_XP).toBe(150); // the number the UI advertises
  });

  it('pays nothing on a reset, because nothing was continued', () => {
    const broken = nextStreak(
      { current: 9, longest: 9, lastActiveOn: '2026-09-05' },
      '2026-09-09'
    );
    expect(streakBonusFor(broken)).toBe(0);
  });

  it('pays nothing twice in one day', () => {
    const same = nextStreak({ current: 4, longest: 4, lastActiveOn: '2026-09-05' }, '2026-09-05');
    expect(streakBonusFor(same)).toBe(0);
  });
});

describe('a week of a real child’s use', () => {
  it('builds, breaks and rebuilds correctly', () => {
    // Walked as a sequence because the bugs in this kind of code appear in
    // transitions, not in single steps.
    let state = { current: 0, longest: 0, lastActiveOn: null };
    let paid = 0;

    const doWork = (day) => {
      state = nextStreak(state, day);
      paid += streakBonusFor(state);
    };

    doWork('2026-09-01'); // Tue — day 1
    doWork('2026-09-01'); // ...twice in one day
    doWork('2026-09-02'); // Wed — day 2
    doWork('2026-09-03'); // Thu — day 3
    // Friday missed.
    doWork('2026-09-05'); // Sat — back to day 1
    doWork('2026-09-06'); // Sun — day 2

    expect(state.current).toBe(2);
    expect(state.longest).toBe(3);
    // Bonuses: 09-02, 09-03, and 09-06. Not the repeat, not either day one.
    expect(paid).toBe(3 * STREAK_BONUS_XP);
  });
});
