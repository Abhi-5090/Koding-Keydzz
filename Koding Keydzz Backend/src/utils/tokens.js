import jwt from 'jsonwebtoken';
import { randomUUID, createHash, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

export function signAccessToken(payload) {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.ACCESS_TTL,
  });
}

/**
 * Sign a refresh token.
 *
 * A `jti` (unique token id) is ALWAYS added. Without it, two tokens signed in
 * the same second with the same claims are byte-identical — `iat` has
 * one-second resolution — which broke per-device sessions in two ways:
 *
 *   • Two sign-ins in the same second produced the same token string, so the
 *     two session rows were indistinguishable.
 *   • Rotating one session therefore did not invalidate the presented token,
 *     because an identical token still matched the other row's hash.
 *
 * The jti makes every issued refresh token unique, so rotation and per-device
 * revocation actually mean something.
 */
export function signRefreshToken(payload) {
  return jwt.sign({ ...payload, jti: randomUUID() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.REFRESH_TTL,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

export function generateTokenPair(user) {
  const payload = {
    sub: String(user._id),
    role: user.role,
    org: user.org ? String(user.org) : null,
  };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}

/* ---------------------------------------------------------------------------
 * Refresh-token hashing.
 *
 * These use SHA-256, NOT bcrypt, and that difference is a security fix rather
 * than an optimization.
 *
 * bcrypt silently TRUNCATES its input at 72 bytes. A JWT's first 72 bytes are
 * the fixed header plus the start of the payload — which for this app is the
 * same `sub` for every token belonging to one user. So every refresh token
 * ever issued to a given account hashed to the SAME bcrypt digest, and
 * `compareToken` was really only answering "is this a JWT for this user?"
 * rather than "is this THE stored token". The practical effect was that
 * refresh-token revocation and rotation did not work: any older refresh token
 * for the same account still verified against the stored hash.
 *
 * A plain cryptographic hash is also the correct primitive here. bcrypt exists
 * to slow down guessing of LOW-entropy secrets (passwords). A refresh token is
 * a 200+ character signed random value — it cannot be brute-forced — so the
 * KDF buys nothing and cost real latency on every refresh (which now has to
 * check several candidate sessions).
 *
 * Passwords still use bcrypt via User.setPassword — that is the right place
 * for it, and those are well under the 72-byte limit.
 *
 * NOTE: this changes the stored format, so sessions created before this deploy
 * no longer verify and those users sign in once more. `hashToken` is async to
 * keep the previous call signature.
 * ------------------------------------------------------------------------- */

/** SHA-256 hex digest of a token. Deterministic, no length limit. */
export async function hashToken(token) {
  return createHash('sha256').update(String(token), 'utf8').digest('hex');
}

/** Timing-safe comparison of a token against a stored SHA-256 digest. */
export async function compareToken(token, hash) {
  if (!hash || typeof hash !== 'string') return false;
  const computed = await hashToken(token);
  // A stored bcrypt digest from before this change has a different length, so
  // it simply fails to match — which is the intended "please log in again".
  if (computed.length !== hash.length) return false;
  return timingSafeEqual(Buffer.from(computed, 'utf8'), Buffer.from(hash, 'utf8'));
}

export default {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateTokenPair,
  hashToken,
  compareToken,
};
