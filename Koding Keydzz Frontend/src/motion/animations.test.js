import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { revealIn, revealOnScroll, countUp, growBar, celebrate, pulseOnce } from './animations'
import { prefersReducedMotion } from './gsapCore'

/**
 * THE FAILURE MODE THESE TESTS EXIST FOR.
 *
 * An entrance animation works by setting `opacity: 0` and then animating to 1.
 * So every path that SKIPS the animation must still apply the finished state —
 * and there are two such paths: a pupil who asked for reduced motion, and a
 * GSAP chunk that failed to download on school Wi-Fi.
 *
 * Get either wrong and the content is not un-animated, it is INVISIBLE. A
 * blank dashboard is a far worse outcome than a static one, and it would only
 * show up on exactly the devices least able to report it. Hence: every helper
 * is asserted to leave its target visible when it does not animate.
 */

function setReducedMotion(reduce) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('prefers-reduced-motion') ? reduce : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
}

function el() {
  const node = document.createElement('div')
  document.body.appendChild(node)
  return node
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('reduced motion is detected', () => {
  it('reports true when the OS asks for less movement', () => {
    setReducedMotion(true)
    expect(prefersReducedMotion()).toBe(true)
  })

  it('reports false otherwise', () => {
    setReducedMotion(false)
    expect(prefersReducedMotion()).toBe(false)
  })

  it('does not throw when matchMedia is missing entirely', () => {
    const saved = window.matchMedia
    delete window.matchMedia
    expect(() => prefersReducedMotion()).not.toThrow()
    expect(prefersReducedMotion()).toBe(false)
    window.matchMedia = saved
  })
})

describe('under reduced motion, content is VISIBLE, not skipped', () => {
  beforeEach(() => setReducedMotion(true))

  it('revealIn leaves the element fully opaque and untransformed', () => {
    const node = el()
    node.style.opacity = '0'
    revealIn(node)
    expect(node.style.opacity).toBe('1')
    expect(node.style.transform).toBe('none')
  })

  it('revealIn settles every element of a list', () => {
    const nodes = [el(), el(), el()]
    revealIn(nodes)
    for (const n of nodes) expect(n.style.opacity).toBe('1')
  })

  it('revealOnScroll settles instead of waiting for a scroll that may never come', () => {
    // This one matters twice over: with no animation there is no ScrollTrigger,
    // so content below the fold would otherwise stay hidden forever.
    const node = el()
    revealOnScroll(node)
    expect(node.style.opacity).toBe('1')
  })

  it('countUp writes the final figure immediately', () => {
    // The number is INFORMATION. It must never be withheld because motion was
    // declined.
    const node = el()
    countUp(node, 1234)
    expect(node.textContent).toBe('1,234')
  })

  it('growBar jumps straight to its proportion', () => {
    const node = el()
    growBar(node, 0.42)
    expect(node.style.transform).toBe('scaleX(0.42)')
  })

  it('celebrate reveals the whole reward overlay and still reports completion', () => {
    const badge = el()
    const stars = [el(), el(), el()]
    const figures = [el()]
    const actions = el()
    const onDone = vi.fn()

    celebrate({ badge, stars, figures, actions }, { onDone })

    for (const n of [badge, ...stars, ...figures, actions]) {
      expect(n.style.opacity).toBe('1')
    }
    // The callback drives what happens next in the UI, so skipping the
    // animation must not skip the callback.
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('pulseOnce simply does nothing — it is pure emphasis, with no end state', () => {
    const node = el()
    expect(() => pulseOnce(node)).not.toThrow()
  })
})

describe('every helper returns a callable cleanup, synchronously', () => {
  beforeEach(() => setReducedMotion(false))

  it.each([
    ['revealIn', () => revealIn(el())],
    ['revealOnScroll', () => revealOnScroll(el())],
    ['countUp', () => countUp(el(), 10)],
    ['growBar', () => growBar(el(), 0.5)],
    ['pulseOnce', () => pulseOnce(el())],
    ['celebrate', () => celebrate({ badge: el() })],
  ])('%s', (_name, run) => {
    // Synchronously, because a component can unmount before the GSAP chunk
    // arrives — the cleanup has to exist to cancel that pending work.
    const cleanup = run()
    expect(typeof cleanup).toBe('function')
    expect(() => cleanup()).not.toThrow()
  })

  it.each([
    ['revealIn', () => revealIn(null)],
    ['countUp', () => countUp(null, 5)],
    ['growBar', () => growBar(null, 0.5)],
    ['pulseOnce', () => pulseOnce(null)],
  ])('%s tolerates a null target (a ref that never attached)', (_name, run) => {
    expect(() => run()()).not.toThrow()
  })
})

describe('growBar clamps its input', () => {
  beforeEach(() => setReducedMotion(true))

  it.each([
    [-1, 'scaleX(0)'],
    [0, 'scaleX(0)'],
    [0.5, 'scaleX(0.5)'],
    [1, 'scaleX(1)'],
    [2, 'scaleX(1)'],
    [Number.NaN, 'scaleX(0)'],
  ])('ratio %s -> %s', (ratio, expected) => {
    // A progress bar fed 1.4 by a rounding error must not render past its
    // track; one fed NaN must render empty rather than disappear.
    const node = el()
    growBar(node, ratio)
    expect(node.style.transform).toBe(expected)
  })
})

describe('countUp formatting', () => {
  beforeEach(() => setReducedMotion(true))

  it('groups thousands by default, so 12345 does not read as a code', () => {
    const node = el()
    countUp(node, 12345)
    expect(node.textContent).toBe('12,345')
  })

  it('accepts a custom formatter', () => {
    const node = el()
    countUp(node, 87, { format: (n) => `${Math.round(n)}%` })
    expect(node.textContent).toBe('87%')
  })

  it('treats a non-numeric value as zero rather than printing NaN', () => {
    const node = el()
    countUp(node, undefined)
    expect(node.textContent).toBe('0')
  })
})
