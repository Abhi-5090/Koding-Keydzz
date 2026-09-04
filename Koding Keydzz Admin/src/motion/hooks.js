import { useEffect, useLayoutEffect, useRef } from 'react'
import { countUp, growBar, revealIn, revealOnScroll } from './animations'
import { preloadGsap } from './gsapCore'

/**
 * React bindings for the animation vocabulary.
 *
 * All of them use `useLayoutEffect` rather than `useEffect`. That matters: an
 * entrance animation sets `opacity: 0` as its starting state, and doing that in
 * `useEffect` means the browser has already painted the element at full opacity
 * — the user sees a flash of the finished card, then it fades in from nothing.
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
 * Warm the GSAP chunk while the browser is idle. Mount once, at the app root.
 *
 * Without this the FIRST animation a user triggers is also the one that waits
 * on a 110 kB download, so the very interaction meant to feel responsive is the
 * only one that stutters.
 */
export function useGsapPreload() {
  useEffect(() => {
    preloadGsap()
  }, [])
}

export default { useRevealIn, useRevealOnScroll, useCountUp, useGrowBar, useGsapPreload }
