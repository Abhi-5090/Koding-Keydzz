/**
 * Pure, side-effect-free helpers for kid-friendly login usernames and for
 * resolving a login identifier (username OR email).
 *
 * These never touch the database. The DB-backed uniqueness loop lives in the
 * student services, which pass an `isTaken` predicate into `uniqueUsername`.
 */

// Cap generated usernames so they stay short and typeable for young students.
export const MAX_USERNAME_BASE = 12;

/**
 * Turn a name into a kid-friendly username base: lowercase, letters+digits only
 * (no confusing punctuation/spaces), capped in length. Falls back to 'student'
 * when nothing usable remains.
 */
export function slugifyName(name) {
  const slug = String(name == null ? '' : name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_USERNAME_BASE);
  return slug || 'student';
}

/**
 * Build a candidate username from a base + an optional numeric/string suffix.
 * The base is slugified so callers can pass a raw name. Suffix is appended as-is
 * (expected to be digits). Empty/nullish suffix returns the bare base.
 */
export function usernameCandidate(base, suffix = '') {
  const b = slugifyName(base);
  const s = suffix == null ? '' : String(suffix);
  return s === '' ? b : `${b}${s}`;
}

/** Default random suffix: 3 digits (kid-friendly, avoids letters entirely). */
function defaultRandomDigits() {
  let s = '';
  for (let i = 0; i < 3; i += 1) s += Math.floor(Math.random() * 10);
  return s;
}

/**
 * Resolve a UNIQUE username for `base`, retrying with random digit suffixes.
 *
 * `isTaken(candidate)` returns truthy (sync or async) when the candidate is
 * already used — callers combine a DB check with an in-batch Set so a bulk
 * upload never assigns the same username twice. Pure w.r.t. the DB (all I/O is
 * delegated to `isTaken`), which keeps the retry/dedup logic unit-testable.
 */
export async function uniqueUsername(
  base,
  isTaken,
  { randomDigits = defaultRandomDigits, maxTries = 60 } = {}
) {
  const b = slugifyName(base);
  if (!(await isTaken(b))) return b;
  for (let i = 0; i < maxTries; i += 1) {
    const candidate = usernameCandidate(b, randomDigits(i));
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTaken(candidate))) return candidate;
  }
  // Extremely unlikely fallback: append a time-based suffix that is ~unique.
  return usernameCandidate(b, String(Date.now()).slice(-6));
}

/** Normalize a login identifier (username OR email): trim + lowercase. */
export function normalizeIdentifier(identifier) {
  return String(identifier == null ? '' : identifier).trim().toLowerCase();
}

/**
 * Build the case-insensitive Mongo filter that resolves a login identifier to a
 * user by EITHER email OR username. Used by userRepository.findByLogin.
 */
export function buildLoginFilter(identifier) {
  const id = normalizeIdentifier(identifier);
  return { $or: [{ email: id }, { username: id }] };
}

export default {
  MAX_USERNAME_BASE,
  slugifyName,
  usernameCandidate,
  uniqueUsername,
  normalizeIdentifier,
  buildLoginFilter,
};
