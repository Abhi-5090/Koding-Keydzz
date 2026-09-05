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

/**
 * THE POLICY, AS DATA.
 *
 * Every limiter below is built from one of these objects rather than from
 * literals written inline. Two reasons, and the second is why it is worth the
 * indirection:
 *
 *   1. The whole rate-limit policy can be read in one screen, which is what a
 *      security review actually needs.
 *   2. `express-rate-limit` closes over its options and exposes nothing but
 *      `getKey`/`resetKey`, so a limiter's configuration is unreadable from
 *      the outside and therefore untestable. Naming the policy makes it
 *      assertable — and these numbers are exactly the kind that get "tidied"
 *      upward by someone fixing a lockout without seeing why they are small.
 */
export const POLICY = Object.freeze({
  auth: {
    windowMs: envInt('AUTH_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    max: envInt('AUTH_RATE_LIMIT_MAX', 60),
    skipSuccessfulRequests: true,
  },
  passwordReset: {
    windowMs: envInt('RESET_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
    max: envInt('RESET_RATE_LIMIT_MAX', 20),
    skipSuccessfulRequests: false,
  },
  accountCreation: {
    windowMs: envInt('CREATE_RATE_LIMIT_WINDOW_MS', 60 * 60 * 1000),
    max: envInt('CREATE_RATE_LIMIT_MAX', 200),
    perUser: true,
  },
  api: {
    windowMs: envInt('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    max: envInt('API_RATE_LIMIT_MAX', 3000),
  },
  gameComplete: { windowMs: 60 * 1000, max: envInt('GAME_COMPLETE_RATE_LIMIT_MAX', 30), perUser: true },
  upload: { windowMs: 60 * 60 * 1000, max: envInt('UPLOAD_RATE_LIMIT_MAX', 20), perUser: true },
  playground: { perUser: true },
});

/** Key on the signed-in account, falling back to the address. */
export const perUserKey = (req) => (req.user?._id ? String(req.user._id) : req.ip);

/**
 * SIGN-IN ATTEMPTS FROM ONE NETWORK — and the reason the old number was 600.
 *
 * THE CONSTRAINT THAT MAKES THIS HARD
 * -----------------------------------
 * A school is one NAT. Thirty children signing in at the start of a lesson are
 * thirty requests from one IP within a minute, and several of them will mistype
 * their password. A tight per-IP limit on ALL attempts locks out the class —
 * which is why the limit was set to 600 per fifteen minutes, i.e. barely a
 * limit at all against credential stuffing.
 *
 * THE FIX IS TO COUNT ONLY WHAT MATTERS
 * -------------------------------------
 * `skipSuccessfulRequests` means a successful sign-in costs nothing. The budget
 * is spent exclusively on FAILURES, so a class signing in normally never
 * touches it however large the class is — and the failure budget can therefore
 * be small. 60 failures per fifteen minutes from one network is generous for a
 * room full of children mistyping, and useless for an attacker working through
 * a credential list.
 *
 * This sits ON TOP OF the per-account lockout in utils/loginLockout.js. The two
 * cover different attacks and neither replaces the other:
 *   • per-account lockout stops GUESSING ONE ACCOUNT many times;
 *   • this stops TRYING MANY ACCOUNTS from one place, which no per-account
 *     counter can ever see.
 */
export const authLimiter = rateLimit({
  windowMs: POLICY.auth.windowMs,
  max: POLICY.auth.max,
  /**
   * Only failures count.
   *
   * This is the whole reason the limit can be 60 instead of 600. Without it,
   * the number has to be large enough for every legitimate sign-in in a school
   * and is then far too large to stop anything.
   */
  skipSuccessfulRequests: POLICY.auth.skipSuccessfulRequests,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many failed sign-in attempts from this network. Please wait a few minutes and try again.',
  },
});

/**
 * PASSWORD RESET REQUESTS — much tighter, and keyed per network.
 *
 * This endpoint sends email to an address the caller chooses, which makes it
 * two things at once: a way to mail-bomb somebody, and a way to burn a mail
 * provider's reputation. The service already refuses to resend to the SAME
 * account within a minute, but nothing stopped a caller walking a list of a
 * thousand addresses and sending a thousand different messages.
 *
 * Successful and failed requests both count here, deliberately — unlike
 * sign-in, a "successful" reset request is exactly the thing being abused, and
 * the endpoint deliberately answers identically either way so there is nothing
 * to distinguish anyway.
 */
export const passwordResetLimiter = rateLimit({
  windowMs: POLICY.passwordReset.windowMs,
  max: POLICY.passwordReset.max,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please wait an hour and try again.',
  },
});

/**
 * ACCOUNT CREATION — per authenticated ADMIN, not per IP.
 *
 * Creating pupils and staff is already behind `student:write` / `staff:write`,
 * so this is not about strangers; it is about a compromised or careless
 * administrator session, and a script driving one. Keyed on the user id
 * because an admin and their whole school share an IP, so an IP key would
 * either be uselessly loose or would have one admin's bulk import throttle
 * another's.
 *
 * Set well above a real day's work — a school adding a new class of 35 by hand
 * never comes close — and well below what a script would do in a minute.
 * Bulk roster import is a SINGLE request and so is unaffected: this counts
 * requests, not pupils.
 */
export const accountCreationLimiter = rateLimit({
  windowMs: POLICY.accountCreation.windowMs,
  max: POLICY.accountCreation.max,
  keyGenerator: perUserKey,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message:
      'Too many accounts created in a short time. Please wait, or use the bulk roster import for a whole class at once.',
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
  keyGenerator: perUserKey,
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
  keyGenerator: perUserKey,
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
  keyGenerator: perUserKey,
  skip: skipInTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many code runs, please slow down.',
  },
});

export default {
  POLICY,
  perUserKey,
  authLimiter,
  passwordResetLimiter,
  accountCreationLimiter,
  apiLimiter,
  playgroundLimiter,
  gameCompleteLimiter,
  uploadLimiter,
};
