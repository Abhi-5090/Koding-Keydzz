import { describe, it, expect } from 'vitest';
import {
  POLICY,
  perUserKey,
  authLimiter,
  apiLimiter,
  passwordResetLimiter,
  accountCreationLimiter,
  gameCompleteLimiter,
  playgroundLimiter,
  uploadLimiter,
} from '../../src/middlewares/rateLimit.js';

/**
 * RATE-LIMIT POLICY.
 *
 * THE CONSTRAINT EVERYTHING HERE IS SHAPED BY
 * -------------------------------------------
 * A school is one NAT. Every pupil in the building shares its public address,
 * so a limiter sized for one-user-per-IP is wrong in both directions: the
 * original cap of 30 sign-ins per 15 minutes refused the 31st child in a class,
 * and the fix — raising it to 600 — made it useless against credential
 * stuffing.
 *
 * THE RESOLUTION IS TO COUNT ONLY FAILURES
 * ----------------------------------------
 * `skipSuccessfulRequests` means a successful sign-in costs nothing, so the
 * budget is spent exclusively on failures. A class signing in normally never
 * touches it however large the class is, which is what lets the failure budget
 * be small enough to matter.
 *
 * The limiters are SKIPPED under NODE_ENV=test so the integration suite can
 * sign in freely. That is why this file asserts configuration rather than
 * behaviour — and why it exists at all, so the skip is never mistaken for
 * "there is no rate limiting".
 */

/**
 * `express-rate-limit` closes over its options and exposes only
 * `getKey`/`resetKey`, so a limiter's configuration cannot be read back from
 * the middleware. The policy is therefore declared as exported data in
 * rateLimit.js and the limiters are built from it — which is what makes these
 * assertions possible at all.
 */

describe('rate limit policy', () => {
  const ALL = {
    authLimiter,
    apiLimiter,
    passwordResetLimiter,
    accountCreationLimiter,
    gameCompleteLimiter,
    playgroundLimiter,
    uploadLimiter,
  };

  it('has every limiter configured', () => {
    for (const [name, limiter] of Object.entries(ALL)) {
      expect(typeof limiter, `${name} must be middleware`).toBe('function');
    }
  });

  it('COUNTS ONLY FAILED SIGN-INS, which is what lets the budget be small', () => {
    /**
     * The assertion the whole policy rests on, and the one that must not be
     * quietly dropped.
     *
     * Without `skipSuccessfulRequests`, the sign-in cap has to be large enough
     * for every legitimate sign-in in a school within the window — hundreds —
     * and is then far too large to stop anyone working through a credential
     * list. With it, a class signing in successfully spends nothing and the
     * cap can be sized for mistyped passwords instead.
     *
     * A previous version of this file asserted `max >= 300`. That was correct
     * when every attempt counted and is exactly backwards now: it would have
     * blocked this change rather than protecting it.
     */
    expect(POLICY.auth.skipSuccessfulRequests).toBe(true);
  });

  it('sizes the FAILURE budget for a class mistyping, not for an attacker', () => {
    // Generous for a room full of children getting it wrong; useless for
    // someone trying a list of stolen passwords.
    const max = POLICY.auth.max;
    expect(max).toBeGreaterThanOrEqual(30);
    expect(max, 'a large cap here means no protection against credential stuffing')
      .toBeLessThanOrEqual(120);
  });

  it('holds password resets to a much tighter budget than sign-ins', () => {
    /**
     * This endpoint sends mail to an address the CALLER chooses, so it is a
     * mail-bomb vector and a way to burn a sending reputation, not just an auth
     * surface. The per-account cooldown in the service cannot see a caller
     * walking a list of a thousand different addresses; only this can.
     */
    const reset = POLICY.passwordReset;
    const auth = POLICY.auth;
    expect(reset.max).toBeLessThan(auth.max);
    expect(reset.max).toBeLessThanOrEqual(30);
    // Counted over a long window: an hour, not the sign-in window.
    expect(reset.windowMs).toBeGreaterThanOrEqual(30 * 60 * 1000);
  });

  it('does NOT skip successful password-reset requests', () => {
    // Unlike sign-in, a "successful" reset request is precisely the thing being
    // abused — and the endpoint answers identically either way, so there is
    // nothing to distinguish on anyway.
    expect(POLICY.passwordReset.skipSuccessfulRequests).toBeFalsy();
  });

  it('KEYS THE PER-USER LIMITERS BY ACCOUNT, not by IP', () => {
    /**
     * An IP-keyed completion limiter throttles a whole classroom at once, when
     * the thing being guarded against is one account running a script.
     *
     * The previous version of this test was
     *
     *   const key = limiter?.resetKey ? 'configured' : 'configured';
     *   expect(key).toBe('configured');
     *
     * — both branches identical, asserted against itself. It could not fail,
     * for any input, ever. This one actually calls the key generator and
     * checks which value comes back.
     */
    const withUser = { user: { _id: 'user-123' }, ip: '10.0.0.9' };
    const anonymous = { ip: '10.0.0.9' };

    // Every per-user limiter is built from this one function, so asserting it
    // once covers all of them — and the policy below records which limiters
    // are supposed to use it.
    expect(perUserKey(withUser), 'should key on the user id').toBe('user-123');
    // Falls back to the address for an unauthenticated caller rather than
    // throwing or bucketing everyone together under `undefined`.
    expect(perUserKey(anonymous), 'should fall back to the IP').toBe('10.0.0.9');

    for (const name of ['gameComplete', 'upload', 'playground', 'accountCreation']) {
      expect(POLICY[name].perUser, `${name} must be keyed per account`).toBe(true);
    }
  });

  it('leaves the SHARED limiters keyed by address, which is correct for them', () => {
    // The sign-in, reset and general API limiters guard unauthenticated
    // traffic, where there is no account to key on. Marking them `perUser`
    // would be a bug: it would bucket every anonymous caller together.
    expect(POLICY.auth.perUser).toBeUndefined();
    expect(POLICY.passwordReset.perUser).toBeUndefined();
    expect(POLICY.api.perUser).toBeUndefined();
  });

  it('is skipped in the test environment so integration tests can sign in', () => {
    expect(process.env.NODE_ENV).toBe('test');
    // Every limiter is still real middleware — the skip is a test-environment
    // convenience, not an absence of rate limiting.
    for (const [name, limiter] of Object.entries(ALL)) {
      expect(typeof limiter, `${name} must still be middleware`).toBe('function');
    }
  });
});
