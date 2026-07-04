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
 */
export function generateOrgCode(name = '', length = 6) {
  const base = String(name)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, length);
  let code = base;
  while (code.length < length) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code.slice(0, length);
}

export default { slugify, generateOrgCode };
