import crypto from 'node:crypto';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { hashToken, compareToken } from '../utils/tokens.js';
import { sendMail, passwordResetMessage, mailEnabled, config } from './mailService.js';
import { ROLES } from '../config/permissions.js';

/**
 * SELF-SERVICE PASSWORD RESET.
 *
 * Before this, every reset was somebody else doing it for you: a superadmin
 * reset an admin, an admin reset a teacher, a teacher reset a pupil, and a
 * locked-out superadmin needed shell access to the production host. Defensible
 * for young children; not defensible for staff.
 *
 * THE FOUR PROPERTIES THAT MAKE THIS SAFE
 * ---------------------------------------
 *  1. NO USER ENUMERATION. `request()` returns the SAME answer whether or not
 *     the address exists. A reset form that says "no such account" is a free
 *     tool for discovering which of a school's staff addresses are real.
 *  2. ONLY THE HASH IS STORED. The token is a bearer credential for one
 *     account; a database dump must not contain usable ones.
 *  3. SINGLE USE, SHORT LIFE. 30 minutes, and consumed on completion. A used
 *     token is recorded as used rather than deleted, so a replayed link says
 *     "already used" instead of looking like an unrelated failure.
 *  4. STAFF ONLY, BY DEFAULT. Pupils are not emailed — most have no address,
 *     and a child's password is deliberately something their teacher can
 *     reset. `student:reset_password` remains the route for them.
 *
 * COMPLETING A RESET REVOKES EVERY SESSION. Someone resetting a password is
 * usually doing it because they think it is compromised; leaving the attacker's
 * session alive would defeat the entire exercise.
 */

/** How long a reset link lives. Long enough to read an email, short enough to matter. */
export const RESET_TTL_MINUTES = 30;

/**
 * Minimum gap between reset emails for one account.
 *
 * Without it, this endpoint is a way to send somebody hundreds of emails using
 * only their address. Deliberately silent: the caller still gets the same
 * neutral answer, because telling them "too soon" would confirm the address
 * exists — the very thing property 1 exists to prevent.
 */
const RESEND_COOLDOWN_MS = 60_000;

/** Roles that may reset their own password by email. */
const SELF_RESET_ROLES = [ROLES.SUPERADMIN, ROLES.ADMIN, ROLES.FACULTY];

/**
 * How far back a reset token is still RESOLVABLE (not usable — resolvable).
 *
 * Spent and expired hashes are kept so a replayed or stale link can be told
 * apart from one that never existed. This window stops that record growing
 * into the scan set for ever.
 */
const SCAN_WINDOW_DAYS = 7;

/** The answer given to every reset request, whatever actually happened. */
const NEUTRAL_ANSWER = Object.freeze({
  requested: true,
  message:
    'If that email address belongs to a staff account, a reset link is on its way. ' +
    'Check your inbox, including the spam folder.',
});

/**
 * Ask for a reset link.
 *
 * Returns the neutral answer in every case — unknown address, suspended
 * account, pupil, mail disabled, cooldown. The only thing a caller can learn
 * from this endpoint is that it accepted the request.
 */
export async function request({ email }) {
  const address = String(email || '').trim().toLowerCase();
  if (!address) return NEUTRAL_ANSWER;

  const user = await User.findOne({ email: address })
    .select('+passwordResetRequestedAt name email role status deletedAt')
    .exec();

  // Every one of these is a silent no-op with the same visible outcome.
  if (
    !user ||
    user.deletedAt ||
    user.status === 'suspended' ||
    !SELF_RESET_ROLES.includes(user.role)
  ) {
    return NEUTRAL_ANSWER;
  }

  if (
    user.passwordResetRequestedAt &&
    Date.now() - user.passwordResetRequestedAt.getTime() < RESEND_COOLDOWN_MS
  ) {
    return NEUTRAL_ANSWER;
  }

  const cfg = config();
  if (!mailEnabled() || !cfg.appUrl) {
    /**
     * No transport, or nowhere for the link to point.
     *
     * Still the neutral answer: an attacker must not be able to tell a
     * misconfigured deployment from an unknown address. The operator is told
     * on the server, where it belongs.
     */
    // eslint-disable-next-line no-console
    console.warn(
      '[password-reset] a reset was requested but ' +
        (mailEnabled() ? 'APP_URL is not set' : 'MAIL_TRANSPORT is disabled') +
        ' — no link was sent'
    );
    return NEUTRAL_ANSWER;
  }

  // 32 bytes of CSPRNG, URL-safe. Long enough that guessing is not a strategy.
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date();

  await User.updateOne(
    { _id: user._id },
    {
      $set: {
        passwordResetTokenHash: await hashToken(token),
        passwordResetExpiresAt: new Date(now.getTime() + RESET_TTL_MINUTES * 60_000),
        passwordResetRequestedAt: now,
        passwordResetUsedAt: null,
      },
    }
  );

  const resetUrl = `${cfg.appUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const message = passwordResetMessage({
    name: user.name,
    resetUrl,
    expiresMinutes: RESET_TTL_MINUTES,
  });

  // Failure here is logged inside sendMail and does not change the answer.
  await sendMail({ to: user.email, ...message });

  return NEUTRAL_ANSWER;
}

/**
 * Is this token currently usable? Used by the reset screen to decide whether
 * to show a form or an explanation, before the user types anything.
 *
 * Unlike `request`, this one DOES distinguish its failures — by the time
 * somebody is holding a token, "expired" and "already used" are the two things
 * they need to be told apart, and neither reveals whether any address exists.
 */
export async function inspect({ token }) {
  const found = await findByToken(token);
  if (!found.user) return { valid: false, reason: found.reason };
  return { valid: true, name: found.user.name || null };
}

/**
 * Finish a reset: set the new password, consume the token, end every session.
 */
export async function complete({ token, newPassword }) {
  const { user, reason } = await findByToken(token);
  if (!user) {
    throw ApiError.badRequest(
      reason === 'used'
        ? 'That reset link has already been used. Request a new one.'
        : 'That reset link is invalid or has expired. Request a new one.'
    );
  }

  // Staff floor. The same 8 characters they were provisioned with — a reset
  // must not be a way to end up with a weaker account.
  if (String(newPassword || '').length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }

  await user.setPassword(newPassword);

  /**
   * The reset clears `mustChangePassword` as well.
   *
   * The user has just chosen this password themselves, which is exactly what
   * the flag demands. Leaving it set would force them to change the password
   * they set thirty seconds ago.
   */
  user.mustChangePassword = false;

  /**
   * THE HASH IS KEPT, and `passwordResetUsedAt` is stamped instead.
   *
   * Nulling the hash here was a real bug: the token then could not be resolved
   * at all on a replay, so a link somebody clicked twice reported "invalid or
   * expired" — indistinguishable from a link that never existed, and exactly
   * the confusing answer `passwordResetUsedAt` was added to avoid.
   *
   * Keeping a spent hash is safe. It is a SHA-256 digest, so it grants nothing
   * without its preimage, and it is marked used so the preimage grants nothing
   * either. What it buys is a truthful message.
   */
  user.passwordResetExpiresAt = null;
  user.passwordResetUsedAt = new Date();
  // A successful reset also clears any lockout — otherwise someone who was
  // locked out by guesses cannot get back in even with the right password.
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  user.sessions = [];
  await user.save();

  return { reset: true };
}

/**
 * Resolve a token to its user.
 *
 * Scans only accounts with a live reset in progress, then compares in a
 * timing-safe way. There is no index on the hash on purpose: the candidate set
 * is tiny (accounts with a pending reset), and indexing a secret's digest
 * invites looking accounts up BY it.
 */
async function findByToken(token) {
  const raw = String(token || '');
  if (!raw) return { user: null, reason: 'invalid' };

  /**
   * The candidate set is bounded by REQUEST AGE, not by expiry.
   *
   * Bounding it by expiry would make an expired token unresolvable, which
   * would report it as "invalid" — losing the distinction this function exists
   * to draw. Bounding by request age keeps the scan small (staff who reset in
   * the last week, which for a school is a handful) while still resolving both
   * of the interesting failures precisely. Anything older than the window
   * reads as invalid, which by then is the honest answer.
   */
  const scanSince = new Date(Date.now() - SCAN_WINDOW_DAYS * 86_400_000);

  const candidates = await User.find({
    passwordResetTokenHash: { $ne: null },
    passwordResetRequestedAt: { $gte: scanSince },
  })
    .select(
      '+passwordResetTokenHash +passwordResetExpiresAt +passwordResetUsedAt +passwordResetRequestedAt +passwordHash name email role status deletedAt sessions failedLoginAttempts lockUntil mustChangePassword'
    )
    .exec();

  for (const candidate of candidates) {
    // eslint-disable-next-line no-await-in-loop
    if (!(await compareToken(raw, candidate.passwordResetTokenHash))) continue;

    if (candidate.deletedAt || candidate.status === 'suspended') {
      return { user: null, reason: 'invalid' };
    }
    if (candidate.passwordResetUsedAt) {
      return { user: null, reason: 'used' };
    }
    if (
      !candidate.passwordResetExpiresAt ||
      candidate.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      return { user: null, reason: 'expired' };
    }
    return { user: candidate, reason: null };
  }

  return { user: null, reason: 'invalid' };
}

export default { request, inspect, complete, RESET_TTL_MINUTES };
