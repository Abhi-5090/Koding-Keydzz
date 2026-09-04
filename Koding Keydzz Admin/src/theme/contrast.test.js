import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { contrast, composite, parseThemeCss, AA_TEXT, AA_UI } from './contrast'

/**
 * THE PALETTE IS PROVEN, NOT EYEBALLED.
 *
 * One theme, so this is short — but it is not redundant. The brand is a hot
 * orange used as both ink and fill, which is exactly the kind of colour that
 * drifts under the 4.5:1 line when someone brightens it "just a little" for
 * punch. These cases fail the build instead.
 *
 * The palette is parsed out of theme.css rather than restated here, so the test
 * can only ever prove the contrast of the palette that actually ships.
 */

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(join(here, '..', 'theme.css'), 'utf8')
const T = parseThemeCss(css)

/** Every ground a piece of text can land on. */
const GROUNDS = ['bg', 'bg-elev', 'card', 'surface']

describe('the palette meets WCAG AA', () => {
  it.each(GROUNDS)('primary text is readable on %s', (ground) => {
    expect(contrast(T.text, T[ground])).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each(GROUNDS)('secondary text is readable on %s', (ground) => {
    // Muted text is still body text — it does not get the large-text exemption.
    expect(contrast(T.muted, T[ground])).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each(['bg', 'card', 'surface'])('brand text is readable on %s', (ground) => {
    expect(contrast(T.primary, T[ground])).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each(['success', 'error', 'accent'])('%s is readable as text on a card', (token) => {
    expect(contrast(T[token], T.card)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  /**
   * The pairing every primary button in the app uses: `bg-turmeric text-malt`.
   * A dark label on a hot-orange fill is the only combination that clears AA —
   * white-on-ember is 3.0:1 — so this is the assertion that stops someone
   * "fixing" the button to white text.
   */
  it('the primary button label is readable on its fill', () => {
    expect(contrast(T.bg, T.primary)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it('the primary button label is readable on the hover fill', () => {
    expect(contrast(T.bg, T.accent)).toBeGreaterThanOrEqual(AA_TEXT)
  })

  it.each(['bg', 'card', 'surface'])('the focus ring is visible against %s', (ground) => {
    // 1.4.11: non-text UI needs 3:1. A focus ring nobody can see is the same
    // as no focus ring, and every game here is keyboard-playable by design.
    expect(contrast(T.focus, T[ground])).toBeGreaterThanOrEqual(AA_UI)
  })

  it('the border is visible but not loud', () => {
    // Composited, because the token carries its own alpha.
    const edge = composite(T['border-rgb'], T.card, Number(T['border-a']))
    const delta = contrast(edge, T.card)
    expect(delta).toBeGreaterThan(1.05) // actually visible
    expect(delta).toBeLessThan(3) // a hairline, not a rule
  })
})

describe('the surfaces are distinguishable from each other', () => {
  /**
   * Contrast ratios only ever compare INK to a ground. They cannot tell you
   * whether a card looks raised — for that the grounds have to be compared to
   * EACH OTHER, which is what these do. Without it a palette can pass every
   * check above and still render as one flat slab.
   */
  it('a card lifts off the page', () => {
    expect(contrast(T.card, T.bg)).toBeGreaterThanOrEqual(1.04)
  })

  it('an inset surface recedes from the page', () => {
    expect(contrast(T.bg, T.surface)).toBeGreaterThanOrEqual(1.06)
  })
})

describe('the graphic brand token', () => {
  it('ember matches the brand primary', () => {
    // `ember` marks the places that want the brand hue as a GRAPHIC — a world
    // tint, a star fill, a glow — rather than as readable ink. Same value; the
    // separate name is what keeps the two uses from being conflated.
    expect(T.ember).toEqual([255, 96, 47])
  })

  it('ink on a bright tint is dark, not white', () => {
    // Every world tint is a bright saturated colour, so text on top of one
    // needs a fixed dark ink. White-on-tint fails AA on all of them.
    const ON_TINT = [0, 22, 33] // #001621, from theme/tokens.js
    const TINTS = [
      [45, 190, 138], // Coding Forest
      [71, 166, 240],
      [158, 134, 245], // Loop Mountain
      [232, 166, 61],
      [255, 96, 47], // ember default
    ]
    for (const tint of TINTS) {
      expect(contrast(ON_TINT, tint), `tint ${tint}`).toBeGreaterThanOrEqual(AA_TEXT)
      expect(contrast(ON_TINT, tint)).toBeGreaterThan(contrast([255, 255, 255], tint))
    }
  })
})
