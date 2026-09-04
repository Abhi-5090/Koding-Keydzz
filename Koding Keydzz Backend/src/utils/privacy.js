/**
 * Pure helpers for limiting how much personal data about a child leaves the
 * server on shared/public surfaces (leaderboards, battle results).
 *
 * The product is used by minors, so a full legal name is more than a
 * leaderboard needs. `publicDisplayName` keeps the first name — which is what
 * makes a leaderboard feel personal — and reduces everything after it to an
 * initial.
 */

/**
 * "Bart Simpson"        -> "Bart S."
 * "Bart"                -> "Bart"
 * "Bart J Simpson"      -> "Bart S."   (last token is the surname)
 * "  "                  -> "Student"
 *
 * Never throws; always returns a non-empty string.
 */
export function publicDisplayName(name) {
  const parts = String(name == null ? '' : name)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return 'Student';
  if (parts.length === 1) return parts[0];

  const first = parts[0];
  const surname = parts[parts.length - 1];
  const initial = surname[0];
  return initial ? `${first} ${initial.toUpperCase()}.` : first;
}

/**
 * Strip a raw user id out of a leaderboard row and replace it with a boolean
 * saying whether the row belongs to the requester. Returning the id let an
 * attacker enumerate children and then target them over the socket layer.
 */
export function isSameUser(a, b) {
  return a != null && b != null && String(a) === String(b);
}

/**
 * Escape a user-supplied string so it can be embedded in a Mongo $regex
 * safely.
 *
 * Without this, a teacher typing an ordinary name like "O'Brien (Jr)" — or
 * simply mistyping "(" — reached MongoDB as an invalid regular expression and
 * returned a 500. Patterns like `(a+)+$` are also a ReDoS shape.
 *
 * Also caps the length: a very long pattern is pure cost with no useful match.
 */
export function escapeRegex(input, maxLength = 100) {
  return String(input == null ? '' : input)
    .slice(0, maxLength)
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default { publicDisplayName, isSameUser, escapeRegex };
