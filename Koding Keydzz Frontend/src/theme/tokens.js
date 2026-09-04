/**
 * Colour values for places CSS classes cannot reach — inline `style` on a
 * canvas-like surface, an SVG `fill`, a Monaco theme object.
 *
 * Prefer a Tailwind class wherever one works. These exist for the game boards,
 * whose cell backgrounds and badge fills are computed per cell from a world
 * tint, and for third-party components that take colours as JS values.
 *
 * THE DISTINCTION THAT MATTERS HERE
 * ---------------------------------
 * A `tint` is a world's or game's accent — Coding Forest green, Loop Mountain
 * violet, the ember default. Tints are BRAND-CONSTANT: they identify a place in
 * the product and must not shift between themes, or Loop Mountain would stop
 * being purple in daylight.
 *
 * That has a consequence people get wrong: text sitting ON a tint needs a fixed
 * DARK ink in both themes, because every tint is a bright saturated colour.
 * Using the theme's text token there would paint near-white text on a bright
 * green badge in light mode. `ON_TINT` is that fixed ink, and it is deliberately
 * not a theme variable.
 *
 * Everything else — the board's own ground, its gridlines, disabled digits —
 * IS theme-dependent and reads from a CSS variable through `cssVar`.
 */

/** Read a theme token as a usable CSS colour, e.g. cssVar('bg') -> 'rgb(var(--c-bg))'. */
export const cssVar = (name, alpha) =>
  alpha == null ? `rgb(var(--c-${name}))` : `rgb(var(--c-${name}) / ${alpha})`;

/** The board's own ground. Follows the theme. */
export const BOARD_BG = cssVar('bg');
/** A cell/segment surface inside a board. Follows the theme. */
export const BOARD_SURFACE = cssVar('surface');
/** Disabled or secondary marks on a board. Follows the theme. */
export const BOARD_MUTED = cssVar('muted');

/**
 * Ink for text or icons placed on top of a bright tint fill.
 *
 * FIXED in both themes on purpose — see the note above. #001621 is the brand's
 * deepest teal, and it clears 4.5:1 against every tint in data/worldThemes.js.
 */
export const ON_TINT = '#001621';

/** Status colours used as marks on a board, where the theme token is unreachable. */
export const CONFLICT = cssVar('error');
export const CORRECT = cssVar('success');

export default { cssVar, BOARD_BG, BOARD_SURFACE, BOARD_MUTED, ON_TINT, CONFLICT, CORRECT };
