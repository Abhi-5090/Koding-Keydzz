/**
 * Pure session-policy helpers.
 *
 * These never touch the database or the clock unless you pass `now` — the
 * caller supplies the current session list and gets back the next one, which
 * keeps the policy unit-testable (see tests/sessions.test.js).
 *
 * Policy
 * ------
 *  • MAX_SESSIONS devices may be signed in at once. A student legitimately uses
 *    a lab PC and a tablet; the old single-hash model logged one out when the
 *    other signed in.
 *  • A session goes stale after IDLE_TIMEOUT_MS without use. School devices are
 *    shared between classes, so a forgotten sign-in must not stay valid
 *    indefinitely.
 *  • Refresh tokens ROTATE on every use: the presented token's row is replaced
 *    with the new token's hash, so a captured refresh token stops working as
 *    soon as the real device refreshes.
 */

/** How many concurrent devices one account may have. */
export const MAX_SESSIONS = 5;

/** A session unused for this long is expired, regardless of token TTL. */
export const IDLE_TIMEOUT_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Is this session row still usable at `now`? */
export function isSessionActive(session, now = Date.now()) {
  if (!session || !session.hash) return false;
  const last = new Date(session.lastUsedAt || session.createdAt || 0).getTime();
  if (!Number.isFinite(last) || last === 0) return false;
  return now - last <= IDLE_TIMEOUT_MS;
}

/** Drop stale rows. Returns a new array. */
export function pruneSessions(sessions = [], now = Date.now()) {
  return (sessions || []).filter((s) => isSessionActive(s, now));
}

/**
 * Add a newly issued session, pruning stale rows first and evicting the
 * least-recently-used row if the account is already at MAX_SESSIONS.
 *
 * @returns {Array} the next sessions array
 */
export function addSession(
  sessions = [],
  { hash, userAgent = '' },
  { now = Date.now(), max = MAX_SESSIONS } = {}
) {
  const kept = pruneSessions(sessions, now);

  const next = [
    ...kept,
    { hash, createdAt: new Date(now), lastUsedAt: new Date(now), userAgent },
  ];

  if (next.length <= max) return next;

  // Evict least-recently-used until we're at the cap.
  next.sort(
    (a, b) =>
      new Date(a.lastUsedAt || a.createdAt).getTime() -
      new Date(b.lastUsedAt || b.createdAt).getTime()
  );
  return next.slice(next.length - max);
}

/**
 * Replace the session identified by `matchIndex` with a rotated one.
 * Returns a new array; the other rows keep their timestamps.
 */
export function rotateSession(
  sessions = [],
  matchIndex,
  { hash, userAgent },
  { now = Date.now() } = {}
) {
  const next = [...(sessions || [])];
  if (matchIndex < 0 || matchIndex >= next.length) return next;
  const prev = next[matchIndex];
  next[matchIndex] = {
    hash,
    createdAt: prev.createdAt || new Date(now),
    lastUsedAt: new Date(now),
    userAgent: userAgent || prev.userAgent || '',
  };
  return pruneSessions(next, now);
}

export default {
  MAX_SESSIONS,
  IDLE_TIMEOUT_MS,
  isSessionActive,
  pruneSessions,
  addSession,
  rotateSession,
};
