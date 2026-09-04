import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiting is DISABLED under NODE_ENV=test.
 *
 * The integration suite performs many logins across its cases (each test sets
 * up fresh orgs and signs in), which legitimately trips the 30-per-15-minutes
 * auth limiter and made every later test fail with 429. Skipping in `test`
 * keeps the limits exactly as they are in development and production — see
 * tests/integration/rateLimit.test.js, which asserts the limiters are still
 * configured and active outside the test environment.
 */
const skipInTest = () => env.NODE_ENV === 'test';

/**
 * Read a positive integer from the environment, falling back to a default.
 * Lets an operator tune the limits for their network without a code change.
 */
function envInt(name, fallback) {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

/**
 * Sign-in attempts per IP.
 *
 * WHY THE DEFAULT IS HIGH (and why 30 was wrong)
 * ----------------------------------------------
 * This limit was 30 per 15 minutes per IP. A school sits behind ONE public
 * IP: when a class of thirty starts a lesson, the thirty-first pupil to sign
 * in was refused, and a whole school signing in at 9am locked itself out
 * completely. The failure mode was a room full of children who cannot log in,
 * with a message implying they had done something wrong.
 *
 * An IP limiter is the wrong tool for credential guessing anyway — the real
 * defence is the PER-ACCOUNT lockout (5 wrong passwords, then a 15-minute
 * lock; see utils/loginLockout.js), which is independent of source IP and is
 * not weakened by a generous IP budget. This limiter's remaining job is only
 * to blunt volumetric abuse.
 *
 * Tune with AUTH_RATE_LIMIT_MAX / AUTH_RATE_LIMIT_WINDOW_MS. A large school
 * behind a single NAT should raise it further.
 */
export const authLimiter = rateLimit({
  windowMs: envInt('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  max: envInt('AUTH_RATE_LIMIT_MAX', 600),
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many sign-in attempts from this network. Please wait a few minutes and try again.',
  },
});

/**
 * General API budget per IP.
 *
 * Also raised for the shared-IP case: 300/minute is roughly ten requests per
 * pupil per minute for a class of thirty, and a dashboard plus a game screen
 * can spend that on its own. Tunable via API_RATE_LIMIT_MAX.
 */
export const apiLimiter = rateLimit({
  windowMs: envInt('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
  max: envInt('API_RATE_LIMIT_MAX', 3000),
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down.',
  },
});

// Game-completion limiter. A legitimate player finishes at most a handful of
// levels a minute; this caps the throughput of any scripted farming attempt
// that survives the catalogue check (e.g. replaying real levels).
/**
 * Level completions.
 *
 * Deliberately keyed PER USER, not per IP: a whole class shares one IP, so an
 * IP-keyed cap would throttle a normal lesson. Per-user is also the right
 * shape for what this guards against — one account scripting completions.
 */
export const gameCompleteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt('GAME_COMPLETE_RATE_LIMIT_MAX', 30),
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : req.ip),
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many level completions, please slow down.',
  },
});

// Per-user limiter for avatar uploads (each one costs remote storage).
// Per USER for the same reason as above — one class, one IP.
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: envInt('UPLOAD_RATE_LIMIT_MAX', 20),
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : req.ip),
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many uploads, please try again later.',
  },
});

// Tighter limiter for the code-execution playground (calls an external sandbox).
// Per USER — a shared school IP would otherwise throttle the whole class.
export const playgroundLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: envInt('PLAYGROUND_RATE_LIMIT_MAX', 20),
  keyGenerator: (req) => (req.user?._id ? String(req.user._id) : req.ip),
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many code runs, please slow down.',
  },
});

export default {
  authLimiter,
  apiLimiter,
  playgroundLimiter,
  gameCompleteLimiter,
  uploadLimiter,
};
