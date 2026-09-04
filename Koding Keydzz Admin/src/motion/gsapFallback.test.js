import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * WHEN THE GSAP CHUNK NEVER ARRIVES.
 *
 * GSAP is loaded on demand — 110 kB kept out of the entry bundle. On a school
 * connection that download can fail, and an entrance animation that has
 * already set `opacity: 0` would then leave the content invisible with no
 * error anywhere. The library is optional polish; the page is not.
 *
 * A separate file because gsapCore memoises its load promise at module scope,
 * so the failing import has to be mocked before the module is first evaluated.
 */

vi.mock('gsap', () => {
  throw new Error('Importing a module script failed.')
})
vi.mock('gsap/ScrollTrigger', () => {
  throw new Error('Importing a module script failed.')
})

beforeEach(() => {
  document.body.innerHTML = ''
  // Motion is NOT reduced here — this is the path where the pupil wants
  // animation and simply cannot have it.
  window.matchMedia = vi.fn().mockImplementation((q) => ({
    matches: false,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }))
})

function el() {
  const node = document.createElement('div')
  document.body.appendChild(node)
  return node
}

describe('a failed GSAP load degrades to no animation, never to blank content', () => {
  it('loadGsap resolves to null rather than rejecting', async () => {
    const { loadGsap } = await import('./gsapCore')
    // Rejecting would produce an unhandled rejection on every animated page.
    await expect(loadGsap()).resolves.toBeNull()
  })

  it('revealIn still ends with the element visible', async () => {
    const { revealIn } = await import('./animations')
    const node = el()
    node.style.opacity = '0'

    revealIn(node)
    // The fallback runs when the import settles, so wait a microtask turn.
    await vi.waitFor(() => expect(node.style.opacity).toBe('1'))
  })

  it('revealOnScroll still ends with the element visible', async () => {
    const { revealOnScroll } = await import('./animations')
    const node = el()
    revealOnScroll(node)
    await vi.waitFor(() => expect(node.style.opacity).toBe('1'))
  })

  it('countUp still shows the real figure', async () => {
    const { countUp } = await import('./animations')
    const node = el()
    countUp(node, 4321)
    await vi.waitFor(() => expect(node.textContent).toBe('4,321'))
  })

  it('growBar still reaches its proportion', async () => {
    const { growBar } = await import('./animations')
    const node = el()
    growBar(node, 0.75)
    await vi.waitFor(() => expect(node.style.transform).toBe('scaleX(0.75)'))
  })

  it('celebrate still reveals the reward and fires its callback', async () => {
    const { celebrate } = await import('./animations')
    const badge = el()
    const stars = [el(), el()]
    const onDone = vi.fn()

    celebrate({ badge, stars }, { onDone })

    await vi.waitFor(() => {
      expect(badge.style.opacity).toBe('1')
      for (const s of stars) expect(s.style.opacity).toBe('1')
      // A follow-on action can be gated on this callback, so a
      // failed download must not strand the user on the reward screen.
      expect(onDone).toHaveBeenCalled()
    })
  })
})
