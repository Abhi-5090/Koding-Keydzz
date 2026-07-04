import { describe, it, expect } from 'vitest';
import {
  LOCK_THRESHOLD,
  LOCK_DURATION_MS,
  isLocked,
  lockRemainingMinutes,
  registerFailedAttempt,
  resetLockout,
} from '../src/utils/loginLockout.js';

const NOW = 1_700_000_000_000; // fixed reference time

describe('isLocked', () => {
  it('is false when there is no lockUntil', () => {
    expect(isLocked({ lockUntil: null }, NOW)).toBe(false);
    expect(isLocked({}, NOW)).toBe(false);
  });

  it('is true while lockUntil is in the future', () => {
    expect(isLocked({ lockUntil: new Date(NOW + 60_000) }, NOW)).toBe(true);
  });

  it('is false once lockUntil has passed (expiry)', () => {
    expect(isLocked({ lockUntil: new Date(NOW - 1) }, NOW)).toBe(false);
    expect(isLocked({ lockUntil: new Date(NOW) }, NOW)).toBe(false);
  });

  it('accepts a date string or Date for lockUntil', () => {
    expect(isLocked({ lockUntil: new Date(NOW + 1000).toISOString() }, NOW)).toBe(true);
  });
});

describe('lockRemainingMinutes', () => {
  it('returns 0 when not locked', () => {
    expect(lockRemainingMinutes({ lockUntil: null }, NOW)).toBe(0);
    expect(lockRemainingMinutes({ lockUntil: new Date(NOW - 5) }, NOW)).toBe(0);
  });

  it('ceils to whole minutes and never reports 0 while locked', () => {
    expect(lockRemainingMinutes({ lockUntil: new Date(NOW + 1000) }, NOW)).toBe(1);
    expect(lockRemainingMinutes({ lockUntil: new Date(NOW + 60_000) }, NOW)).toBe(1);
    expect(lockRemainingMinutes({ lockUntil: new Date(NOW + 61_000) }, NOW)).toBe(2);
    expect(lockRemainingMinutes({ lockUntil: new Date(NOW + 15 * 60_000) }, NOW)).toBe(15);
  });
});

describe('registerFailedAttempt (attempts → lock)', () => {
  it('increments below the threshold without locking', () => {
    const r = registerFailedAttempt({ failedLoginAttempts: 0 }, { now: NOW });
    expect(r).toEqual({ failedLoginAttempts: 1, lockUntil: null, locked: false });

    const r4 = registerFailedAttempt({ failedLoginAttempts: 3 }, { now: NOW });
    expect(r4).toEqual({ failedLoginAttempts: 4, lockUntil: null, locked: false });
  });

  it('locks on the threshold-th consecutive failure and resets the counter', () => {
    const r = registerFailedAttempt(
      { failedLoginAttempts: LOCK_THRESHOLD - 1 },
      { now: NOW }
    );
    expect(r.locked).toBe(true);
    expect(r.failedLoginAttempts).toBe(0);
    expect(r.lockUntil).toBeInstanceOf(Date);
    expect(r.lockUntil.getTime()).toBe(NOW + LOCK_DURATION_MS);
  });

  it('treats a missing/undefined counter as 0', () => {
    expect(registerFailedAttempt({}, { now: NOW })).toEqual({
      failedLoginAttempts: 1,
      lockUntil: null,
      locked: false,
    });
    expect(registerFailedAttempt(undefined, { now: NOW }).failedLoginAttempts).toBe(1);
  });

  it('honors custom threshold and lock duration', () => {
    const r = registerFailedAttempt(
      { failedLoginAttempts: 1 },
      { now: NOW, threshold: 2, lockMs: 1000 }
    );
    expect(r.locked).toBe(true);
    expect(r.lockUntil.getTime()).toBe(NOW + 1000);
  });

  it('models a full lock cycle: 5 wrong passwords in a row trips the lock', () => {
    let state = { failedLoginAttempts: 0 };
    let last;
    for (let i = 0; i < LOCK_THRESHOLD; i += 1) {
      last = registerFailedAttempt(state, { now: NOW });
      state = { failedLoginAttempts: last.failedLoginAttempts };
    }
    expect(last.locked).toBe(true);
    // After expiry the account is usable again (isLocked flips to false).
    expect(isLocked(last, NOW + LOCK_DURATION_MS + 1)).toBe(false);
  });
});

describe('resetLockout (reset on success)', () => {
  it('clears both counters', () => {
    expect(resetLockout()).toEqual({ failedLoginAttempts: 0, lockUntil: null });
  });
});
