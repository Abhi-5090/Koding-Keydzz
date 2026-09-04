import { describe, it, expect } from 'vitest';
import {
  CATEGORICAL,
  CATEGORICAL_ALL_PAIRS,
  SEQUENTIAL,
  STATUS,
  CHART_SURFACE,
} from './chartTheme';
import { contrast } from '../../theme/contrast';

/**
 * A PALETTE IS ONLY VALID AGAINST ONE SURFACE.
 *
 * These ramps are re-stepped in OKLCH specifically for #04212E, the card they
 * are drawn on — the design system's UI ramp fails as a series palette there
 * (two of its slots sit 1.8 ΔE apart and two more read as grey). If the card
 * colour ever changes, every value here is invalid until re-checked with
 * `scripts/validate-palette.mjs`.
 *
 * What is asserted here is surface contrast and the structural rules. The
 * perceptual checks — OKLCH lightness band, chroma floor, CVD ΔE — live in
 * that script, because they need the colour-space maths and are run when a
 * colour changes rather than on every test run.
 */

const hex = (h) => {
  const s = h.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16));
};
const vs = (a, b) => contrast(hex(a), hex(b));

/** A mark (line, bar, arc) needs 3:1 against its surface — WCAG 1.4.11. */
const MARK_FLOOR = 3;

describe('every categorical slot is visible on the card', () => {
  it.each(CATEGORICAL)('slot %s clears the mark floor', (c) => {
    expect(vs(c, CHART_SURFACE)).toBeGreaterThanOrEqual(MARK_FLOOR);
  });

  it('slot 1 is the brand ember', () => {
    // Colour follows the entity and slots are assigned in a FIXED order, so
    // the most common series in any chart carries the product's identity.
    expect(CATEGORICAL[0]).toBe('#f45707');
  });

  it('has enough slots to be useful, and not so many that they blur', () => {
    // Past six, adjacent hues stop separating for colour-blind viewers — a 7th
    // series folds into "Other" or becomes small multiples instead.
    expect(CATEGORICAL.length).toBeGreaterThanOrEqual(4);
    expect(CATEGORICAL.length).toBeLessThanOrEqual(6);
  });
});

describe('the donut ramp is capped at three slots', () => {
  it('has at most 3 slots', () => {
    // Every pair in a donut is visually adjacent, so it must pass the
    // all-pairs check — which nothing wider than three does here.
    expect(CATEGORICAL_ALL_PAIRS.length).toBeLessThanOrEqual(3);
  });

  it.each(CATEGORICAL_ALL_PAIRS)('donut slot %s is visible on the card', (c) => {
    expect(vs(c, CHART_SURFACE)).toBeGreaterThanOrEqual(MARK_FLOOR);
  });
});

describe('the sequential ramp encodes magnitude correctly', () => {
  it('is monotonic in lightness', () => {
    // A ramp that is not monotonic encodes magnitude wrongly: two different
    // values would read as the same intensity.
    const lum = SEQUENTIAL.map((c) => contrast(hex(c), [0, 0, 0]));
    for (let i = 1; i < lum.length; i += 1) {
      expect(lum[i]).toBeGreaterThan(lum[i - 1]);
    }
  });

  it('its darkest step is still distinguishable from the card', () => {
    // On a dark card it is the DARK end of the ramp that risks disappearing —
    // the mirror of the problem a light surface would have.
    const darkest = SEQUENTIAL[0];
    expect(vs(darkest, CHART_SURFACE)).toBeGreaterThanOrEqual(1.5);
  });
});

describe('status colours are readable and reserved', () => {
  it.each(Object.keys(STATUS))('status "%s" is readable as text on a card', (key) => {
    expect(vs(STATUS[key], CHART_SURFACE)).toBeGreaterThanOrEqual(4.5);
  });

  it('no status colour doubles as a series colour', () => {
    // Status is RESERVED: good/warning/serious/critical must never be mistaken
    // for "series 5", or a chart legend starts implying severity.
    for (const c of Object.values(STATUS)) {
      expect(CATEGORICAL, `${c} is both a status and a series colour`).not.toContain(c);
    }
  });
});
