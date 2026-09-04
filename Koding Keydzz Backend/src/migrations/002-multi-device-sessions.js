/**
 * Migration 002 — single-session -> multi-device sessions.
 *
 * `User.refreshTokenHash` held ONE session per account, so signing in on a
 * second device silently revoked the first. Sessions now live in a
 * `User.sessions` array with per-device rotation and an idle timeout.
 *
 * Note that this CLEARS stale session state rather than carrying it forward:
 * the old digests were bcrypt, which truncates at 72 bytes, and every JWT for
 * one user shares its first 72 bytes — so all of a user's refresh tokens
 * hashed identically and revocation never actually worked. There is nothing
 * worth migrating, and everyone signs in once more after the deploy, which
 * also invalidates any token relying on the broken comparison.
 */
export const name = '002-multi-device-sessions';

export default async function up() {
  await import('../../scripts/migrate-sessions.mjs');
}
