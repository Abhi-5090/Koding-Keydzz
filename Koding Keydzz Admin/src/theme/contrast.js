/**
 * WCAG 2.1 contrast maths, and the palette parsed out of theme.css.
 *
 * The palette is READ FROM THE STYLESHEET rather than duplicated here. A second
 * copy of the values would drift from the first, and the test would then be
 * proving the contrast of a palette nobody ships.
 */

const srgb = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Relative luminance of an "r g b" channel triplet. */
export function luminance([r, g, b]) {
  return 0.2126 * srgb(r) + 0.7152 * srgb(g) + 0.0722 * srgb(b);
}

/** WCAG contrast ratio between two channel triplets. 1..21. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Composite a translucent foreground over an opaque background. */
export function composite(fg, bg, alpha) {
  return fg.map((f, i) => f * alpha + bg[i] * (1 - alpha));
}

export const parseTriplet = (s) => s.trim().split(/\s+/).map(Number);

/**
 * Pull the token block out of theme.css.
 *
 * Read FROM THE STYLESHEET rather than duplicated here — a second copy of the
 * values would drift from the first, and the test would then be proving the
 * contrast of a palette nobody ships.
 */
export function parseThemeCss(css) {
  const i = css.indexOf(':root {');
  if (i === -1) throw new Error('theme.css: no ":root" block');
  const start = css.indexOf('{', i);
  const end = css.indexOf('}', start);
  /**
   * COMMENTS ARE STRIPPED BEFORE PARSING.
   *
   * The regex below matches `--c-name: value;` anywhere in the block, so a
   * comment that mentions a token by name was parsed AS that token. Writing a
   * note reading "measured against --c-card: /70 passes" silently replaced the
   * card colour with that sentence, and every contrast assertion then compared
   * against NaN — which the suite caught, but only because these tests exist.
   *
   * A comment explaining a token is an entirely reasonable thing to write, so
   * the parser accommodates it rather than the file avoiding it.
   */
  const body = css.slice(start + 1, end).replace(/\/\*[\s\S]*?\*\//g, '');

  const out = {};
  for (const [, name, value] of body.matchAll(/--c-([a-z-]+):\s*([^;]+);/g)) {
    out[name] = /^[\d\s]+$/.test(value) ? parseTriplet(value) : value.trim();
  }
  return out;
}

/** WCAG thresholds. */
export const AA_TEXT = 4.5;
export const AA_UI = 3;
