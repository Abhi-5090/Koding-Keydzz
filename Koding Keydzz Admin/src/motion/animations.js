import { loadGsap, prefersReducedMotion } from './gsapCore'

/**
 * The animation vocabulary for the whole app.
 *
 * Every function here obeys the same three rules, so no caller has to remember
 * them:
 *
 *   1. REDUCED MOTION IS THE END STATE, NOT NOTHING. When a user has asked for
 *      less movement the helper applies the finished appearance immediately.
 *      Returning early without doing that is what leaves content stuck at
 *      `opacity: 0` forever — an invisible page, which is far worse than an
 *      un-animated one.
 *   2. TRANSFORM AND OPACITY ONLY. Both are composited off the main thread; a
 *      tween on `height` or `top` re-lays out the page every frame and drops
 *      to single-digit frame rates on a modest laptop.
 *   3. NOTHING BLOCKS. Each returns a cleanup function synchronously, so a
 *      component that unmounts mid-download does not leak a tween onto a
 *      detached node.
 */

/** A no-op cleanup, so callers can always call the return value. */
const NOOP = () => {}

/** Apply the finished appearance with no animation. */
function settle(targets, to = {}) {
  const els = Array.isArray(targets) ? targets : [targets]
  for (const el of els) {
    if (!el?.style) continue
    // Only the properties an entrance would have animated.
    el.style.opacity = to.opacity != null ? String(to.opacity) : '1'
    el.style.transform = 'none'
  }
}

/**
 * Entrance: fade and rise into place.
 *
 * The default 18px is deliberately small. A long travel reads as the interface
 * being slow rather than as polish, and on a list of ten cards it turns the
 * page into a wave.
 */
export function revealIn(target, { y = 18, delay = 0, duration = 0.55, stagger = 0.06 } = {}) {
  if (!target) return NOOP
  if (prefersReducedMotion()) {
    settle(target)
    return NOOP
  }

  let tween = null
  let cancelled = false

  loadGsap().then((gsap) => {
    if (cancelled || !gsap) {
      // GSAP unavailable: show the content rather than leave it hidden.
      settle(target)
      return
    }
    tween = gsap.fromTo(
      target,
      { opacity: 0, y },
      { opacity: 1, y: 0, duration, delay, stagger, clearProps: 'transform' }
    )
  })

  return () => {
    cancelled = true
    tween?.kill()
  }
}

/**
 * Reveal as it scrolls into view.
 *
 * `once: true` by default — an element that re-animates every time it crosses
 * the fold is a distraction on the second pass, and this portal has long scrolling
 * pages (the analytics dashboards, the student roster).
 */
export function revealOnScroll(target, { y = 24, stagger = 0.08, start = 'top 88%' } = {}) {
  if (!target) return NOOP
  if (prefersReducedMotion()) {
    settle(target)
    return NOOP
  }

  let ctx = null
  let cancelled = false

  loadGsap().then((gsap) => {
    if (cancelled || !gsap) {
      settle(target)
      return
    }
    // A gsap context makes cleanup total: it reverts the tweens AND kills the
    // ScrollTriggers they created, which is the part that leaks otherwise.
    ctx = gsap.context(() => {
      gsap.fromTo(
        target,
        { opacity: 0, y },
        {
          opacity: 1,
          y: 0,
          stagger,
          clearProps: 'transform',
          scrollTrigger: { trigger: target, start, once: true },
        }
      )
    })
  })

  return () => {
    cancelled = true
    ctx?.revert()
  }
}

/**
 * Count a number up to its value.
 *
 * Used for KPI tiles and dashboard figures. `onUpdate` writes the text rather
 * than the caller re-rendering, so a 60fps count does not cause 60 React
 * renders a second.
 *
 * Under reduced motion the final value is written once — the number is
 * information, and it must never be withheld because motion was declined.
 */
export function countUp(el, to, { duration = 1.1, format = (n) => Math.round(n).toLocaleString() } = {}) {
  if (!el) return NOOP
  const target = Number(to) || 0

  if (prefersReducedMotion()) {
    el.textContent = format(target)
    return NOOP
  }

  let tween = null
  let cancelled = false

  loadGsap().then((gsap) => {
    if (cancelled || !gsap) {
      el.textContent = format(target)
      return
    }
    const state = { n: 0 }
    tween = gsap.to(state, {
      n: target,
      duration,
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = format(state.n)
      },
      // Guarantees the exact figure at the end: an eased tween can land on
      // 41.9997, and a leaderboard that reads "42" but animates to "41" is
      // worse than no animation.
      onComplete: () => {
        el.textContent = format(target)
      },
    })
  })

  return () => {
    cancelled = true
    tween?.kill()
    el.textContent = format(target)
  }
}

/**
 * An orchestrated arrival for a group of related figures.
 *
 * One orchestrated timeline rather than several independent springs, because
 * the beats have to land in order — the heading settles, then the figures,
 * then the actions. Independent animations on the same overlay read as
 * things happening at random.
 */
export function celebrate(refs = {}, { onDone } = {}) {
  const { badge, stars = [], figures = [], actions } = refs
  const all = [badge, ...stars, ...figures, actions].filter(Boolean)

  if (prefersReducedMotion()) {
    settle(all)
    onDone?.()
    return NOOP
  }

  let tl = null
  let cancelled = false

  loadGsap().then((gsap) => {
    if (cancelled || !gsap) {
      settle(all)
      onDone?.()
      return
    }
    tl = gsap.timeline({ onComplete: onDone })
    if (badge) {
      // Slight overshoot: this is the one place in the app where a bounce is
      // earned. `back.out` is kept modest so it reads as delight, not as a
      // spring toy.
      tl.fromTo(
        badge,
        { opacity: 0, scale: 0.6 },
        { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(1.7)' }
      )
    }
    if (stars.length) {
      tl.fromTo(
        stars,
        { opacity: 0, scale: 0.4, rotate: -25 },
        { opacity: 1, scale: 1, rotate: 0, duration: 0.38, stagger: 0.11, ease: 'back.out(2)' },
        '-=0.15'
      )
    }
    if (figures.length) {
      tl.fromTo(figures, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.34, stagger: 0.07 }, '-=0.1')
    }
    if (actions) {
      // Last on purpose: the buttons should not invite a tap before the child
      // has seen what they earned.
      tl.fromTo(actions, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.34 }, '-=0.05')
    }
  })

  return () => {
    cancelled = true
    tl?.kill()
    settle(all)
  }
}

/**
 * Draw attention to something that just changed — a figure that just changed after a filter. Deliberately ONE short pulse, not a loop: a permanently pulsing
 * element is noise within ten seconds and is impossible to read past.
 */
export function pulseOnce(el, { scale = 1.06 } = {}) {
  if (!el) return NOOP
  if (prefersReducedMotion()) return NOOP

  let tween = null
  let cancelled = false

  loadGsap().then((gsap) => {
    if (cancelled || !gsap) return
    tween = gsap.fromTo(
      el,
      { scale: 1 },
      { scale, duration: 0.22, yoyo: true, repeat: 1, ease: 'power2.inOut', clearProps: 'transform' }
    )
  })

  return () => {
    cancelled = true
    tween?.kill()
  }
}

/**
 * Grow a progress bar to its value.
 *
 * `scaleX` on a full-width element, never `width`: a width tween re-lays out
 * the row on every frame, and on a tablet that is visible as judder.
 */
export function growBar(el, ratio, { duration = 0.8, delay = 0.1 } = {}) {
  if (!el) return NOOP
  const clamped = Math.max(0, Math.min(1, Number(ratio) || 0))

  if (prefersReducedMotion()) {
    el.style.transform = `scaleX(${clamped})`
    return NOOP
  }

  let tween = null
  let cancelled = false

  loadGsap().then((gsap) => {
    if (cancelled || !gsap) {
      el.style.transform = `scaleX(${clamped})`
      return
    }
    tween = gsap.fromTo(
      el,
      { scaleX: 0, transformOrigin: 'left center' },
      { scaleX: clamped, duration, delay, transformOrigin: 'left center' }
    )
  })

  return () => {
    cancelled = true
    tween?.kill()
    el.style.transform = `scaleX(${clamped})`
  }
}

export default { revealIn, revealOnScroll, countUp, celebrate, pulseOnce, growBar }
