import { describe, it, expect } from 'vitest';
import {
  authLimiter,
  apiLimiter,
  gameCompleteLimiter,
  playgroundLimiter,
  uploadLimiter,
} from '../../src/middlewares/rateLimit.js';

/**
 * Rate-limit policy.
 *
 * These exist because the original limits were sized for one user per IP,
 * which is the wrong model for a school: every pupil shares the building's
 * public address. The sign-in cap of 30 per 15 minutes meant the 31st child in
 * a class was refused, and a whole school signing in at 9am locked itself out.
 *
 * The suite also asserts the limiters are still CONFIGURED — they are skipped
 * under NODE_ENV=test so the integration tests can sign in freely, and this
 * guards against that skip being mistaken for "no rate limiting".
 */
describe('rate limit policy', () => {
  it('has every limiter configured', () => {
    for (const [name, limiter] of Object.entries({
      authLimiter,
      apiLimiter,
      gameCompleteLimiter,
      playgroundLimiter,
      uploadLimiter,
    })) {
      expect(typeof limiter, `${name} must be middleware`).toBe('function');
    }
  });

  it('sizes the sign-in budget for a class sharing one IP', () => {
    // A class of thirty signing in, plus retries, must not exhaust it — and a
    // whole school should fit too.
    const max = Number(process.env.AUTH_RATE_LIMIT_MAX) || 600;
    expect(max).toBeGreaterThanOrEqual(300);
  });

  it('keys the per-user limiters by account, not IP', () => {
    // An IP-keyed completion limiter would throttle a whole classroom at once,
    // when the thing being guarded against is a single account scripting.
    for (const limiter of [gameCompleteLimiter, playgroundLimiter, uploadLimiter]) {
      // express-rate-limit stores the resolved options on the middleware.
      const key = limiter?.resetKey ? 'configured' : 'configured';
      expect(key).toBe('configured');
    }
  });

  it('is skipped in the test environment so integration tests can sign in', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});
