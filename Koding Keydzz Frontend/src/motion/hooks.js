import { useEffect, useLayoutEffect, useRef } from 'react'
import { countUp, growBar, revealIn, revealOnScroll } from './animations'
import { loadGsap, preloadGsap, prefersReducedMotion } from './gsapCore'

/**
 * React bindings for the animation vocabulary.
 *
 * All of them use `useLayoutEffect` rather than `useEffect`. That matters: an
 * entrance animation sets `opacity: 0` as its starting state, and doing that in
 * `useEffect` means the browser has already painted the element at full opacity
 * — the pupil sees a flash of the finished card, then it fades in from nothing.
 * `useLayoutEffect` runs before that paint.
 */

// `useLayoutEffect` warns during server rendering. This app is client-only, but
// the guard keeps the tests (which render in jsdom) quiet and correct.
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect

/**
 * Fade-and-rise a container's children on mount.
 *
 * @param {{ selector?: string, y?: number, delay?: number, stagger?: number, enabled?: boolean }} options
 * @returns a ref to attach to the container
 */
export function useRevealIn({ selector, y, delay, stagger, enabled = true } = {}) {
  const ref = useRef(null)

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !ref.current) return undefined
    const targets = selector
      ? Array.from(ref.current.querySelectorAll(selector))
      : ref.current
    if (Array.isArray(targets) && targets.length === 0) return undefined
    return revealIn(targets, { y, delay, stagger })
  }, [enabled, selector, y, delay, stagger])

  return ref
}

/** Reveal a container's children as they scroll into view. */
export function useRevealOnScroll({ selector, y, stagger, start, enabled = true } = {}) {
  const ref = useRef(null)

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !ref.current) return undefined
    const targets = selector
      ? Array.from(ref.current.querySelectorAll(selector))
      : ref.current
    if (Array.isArray(targets) && targets.length === 0) return undefined
    return revealOnScroll(targets, { y, stagger, start })
  }, [enabled, selector, y, stagger, start])

  return ref
}

/**
 * Count an element's text up to `value`.
 *
 * The element must render the final value as its own children too, so the
 * figure is correct before the tween starts and correct if it never does —
 * screen readers and a failed GSAP load both read the DOM, not the animation.
 */
export function useCountUp(value, { duration, format, enabled = true } = {}) {
  const ref = useRef(null)

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !ref.current) return undefined
    return countUp(ref.current, value, { duration, format })
  }, [value, duration, format, enabled])

  return ref
}

/** Grow a bar to `ratio` (0..1) on mount and whenever it changes. */
export function useGrowBar(ratio, { duration, delay, enabled = true } = {}) {
  const ref = useRef(null)

  useIsomorphicLayoutEffect(() => {
    if (!enabled || !ref.current) return undefined
    return growBar(ref.current, ratio, { duration, delay })
  }, [ratio, duration, delay, enabled])

  return ref
}

/**
 * Run an arbitrary GSAP setup inside a scoped context — for a page whose
 * choreography is too specific for the shared vocabulary (the landing page's
 * parallax hero, say).
 *
 * This replaces an earlier `hooks/useGsap.js` that imported GSAP STATICALLY.
 * That mattered more than it looks: the landing page is eagerly bundled, so a
 * static import there put all 112 kB of GSAP into the first paint of every
 * visit — including the visits of pupils who go straight to /login and never
 * see an animation on it.
 *
 * Two guarantees the old hook did not make:
 *   - `prefers-reduced-motion` is honoured, so the setup simply never runs;
 *   - the page's content is styled VISIBLE in CSS and animated with `from`,
 *     never `fromTo` off a hidden start state. If GSAP arrives late or not at
 *     all, the page is a static page rather than a blank one.
 *
 * @param {(api: { gsap: import('gsap').GSAP, scope: HTMLElement }) => void} setup
 * @param {Array} deps
 * @returns a ref for the scope element
 */
export function useGsapContext(setup, deps = []) {
  const scope = useRef(null)
  const setupRef = useRef(setup)
  setupRef.current = setup

  useIsomorphicLayoutEffect(() => {
    if (!scope.current) return undefined
    // A pupil who asked for less movement gets the page as it already is.
    if (prefersReducedMotion()) return undefined

    let ctx = null
    let cancelled = false

    loadGsap().then((gsap) => {
      if (cancelled || !gsap || !scope.current) return
      // A gsap context reverts the tweens AND kills the ScrollTriggers they
      // created; killing tweens alone leaks the triggers.
      ctx = gsap.context(() => setupRef.current({ gsap, scope: scope.current }), scope)
    })

    return () => {
      cancelled = true
      ctx?.revert()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return scope
}

/**
 * Warm the GSAP chunk while the browser is idle. Mount once, at the app root.
 *
 * Without this the FIRST animation a pupil triggers is also the one that waits
 * on a 110 kB download, so the very interaction meant to feel responsive is the
 * only one that stutters.
 */
export function useGsapPreload() {
  useEffect(() => {
    preloadGsap()
  }, [])
}

export default {
  useRevealIn,
  useRevealOnScroll,
  useCountUp,
  useGrowBar,
  useGsapContext,
  useGsapPreload,
}
