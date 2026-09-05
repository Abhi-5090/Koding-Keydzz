/**
 * Pure helpers for deriving an Organization slug and short code from a name.
 * No DB / network here so they are trivially unit-testable.
 */

/**
 * Slugify an org name: lowercase, strip diacritics-ish punctuation, collapse to
 * hyphen-separated tokens. e.g. "Koding Keydzz Academy" -> "koding-keydzz-academy".
 */
export function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a short uppercase org code, defaulting to 6 chars. Seeds the first
 * characters from the org name's alphanumerics, then pads with random chars so
 * the result is always exactly `length`.
 *
 * WHY `randomChars` EXISTS
 * -----------------------
 * With no random characters this function is entirely DETERMINISTIC for any
 * name of six or more alphanumerics — the padding loop never runs. Two schools
 * sharing a six-character prefix therefore produce the same code, and school
 * names share prefixes constantly: "Delhi Public School Rohini" and "Delhi
 * Public School Dwarka" both yield DELHIP, as do "St Mary's Primary" and
 * "St Mary's Secondary" with STMARY.
 *
 * The caller's collision retry re-called this with the same name and got the
 * same answer every time, so the retry did nothing and the duplicate reached
 * the database, which rejected it with "Duplicate value for code" — an error
 * that meant nothing to the person trying to onboard their second campus, and
 * which no amount of renaming would clear.
 *
 * `randomChars` reserves that many trailing characters for randomness, so a
 * retry genuinely explores a new code while keeping a recognisable prefix.
 */
export function generateOrgCode(name = '', length = 6, { randomChars = 0 } = {}) {
  // Never let the random tail consume the whole code; one seeded character
  // keeps it recognisable as belonging to this school.
  const seeded = Math.max(1, length - Math.max(0, randomChars));
  const base = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, seeded);
  let code = base;
  while (code.length < length) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code.slice(0, length);
}

export default { slugify, generateOrgCode };
