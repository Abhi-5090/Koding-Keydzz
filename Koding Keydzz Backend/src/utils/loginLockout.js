/**
 * Pure, side-effect-free helpers for per-account login lockout.
 *
 * These functions never touch the database or the clock directly — the caller
 * passes in the current user's counters and (optionally) `now`, and gets back
 * the next persisted state / a decision. This makes the policy trivially
 * unit-testable (see tests/loginLockout.test.js).
 *
 * Policy: after LOCK_THRESHOLD consecutive wrong passwords the account is locked
 * for LOCK_DURATION_MS. Locking resets the attempt counter (it is re-counted from
 * zero after the lock expires). A successful login clears everything.
 */

export const LOCK_THRESHOLD = 5;
export const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

/** Is the account currently locked at time `now`? */
export function isLocked({ lockUntil } = {}, now = Date.now()) {
  if (!lockUntil) return false;
  return new Date(lockUntil).getTime() > now;
}

/**
 * Whole minutes remaining on an active lock (ceil, minimum 1 so the message
 * never says "0 minutes"). Returns 0 when not locked.
 */
export function lockRemainingMinutes({ lockUntil } = {}, now = Date.now()) {
  if (!isLocked({ lockUntil }, now)) return 0;
  const ms = new Date(lockUntil).getTime() - now;
  return Math.max(1, Math.ceil(ms / 60_000));
}

/**
 * Decide the next lockout state AFTER a failed password attempt.
 * @returns {{ failedLoginAttempts: number, lockUntil: Date|null, locked: boolean }}
 */
export function registerFailedAttempt(
  { failedLoginAttempts = 0 } = {},
  { now = Date.now(), threshold = LOCK_THRESHOLD, lockMs = LOCK_DURATION_MS } = {}
) {
  const attempts = (Number(failedLoginAttempts) || 0) + 1;
  if (attempts >= threshold) {
    // Trip the lock and reset the counter so it re-counts after expiry.
    return { failedLoginAttempts: 0, lockUntil: new Date(now + lockMs), locked: true };
  }
  return { failedLoginAttempts: attempts, lockUntil: null, locked: false };
}

/** Cleared state to persist after a successful login. */
export function resetLockout() {
  return { failedLoginAttempts: 0, lockUntil: null };
}

export default {
  LOCK_THRESHOLD,
  LOCK_DURATION_MS,
  isLocked,
  lockRemainingMinutes,
  registerFailedAttempt,
  resetLockout,
};
