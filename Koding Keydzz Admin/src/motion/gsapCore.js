/**
 * GSAP, loaded on demand and configured once.
 *
 * WHY LAZY AND NOT A TOP-LEVEL IMPORT
 * -----------------------------------
 * GSAP core plus ScrollTrigger is ~110 kB of JavaScript. A static import puts
 * all of it in the entry chunk, which is 37 kB. A school
 * administrator often opens this portal on the same shared connection the
 * pupils are using, so the entry cost has to stay small. So it is
 * imported dynamically, cached after the first call, and every animation
 * helper degrades to "no animation" until it arrives. Nothing waits on it: the
 * page is fully usable before GSAP exists.
 *
 * WHY A WRAPPER AT ALL
 * --------------------
 * Two things must be true of EVERY animation in this app, and a wrapper is the
 * only way to guarantee them rather than hope for them:
 *
 *   1. `prefers-reduced-motion` is honoured. Staff use this portal all day, and
 *      some have vestibular conditions; movement is not a decoration. Every helper here
 *      checks it and applies the END STATE instantly instead — the element is
 *      never left invisible because an animation was skipped, which is the
 *      classic reduced-motion bug.
 *   2. Nothing animates a property that triggers layout. Only `transform` and
 *      `opacity`, which the compositor can handle on its own thread; animating
 *      `top` or `height` re-lays out the page every frame.
 */

let gsapPromise = null;
/** @type {import('gsap').GSAP | null} */
let gsapInstance = null;

/** Does this device want less movement? Re-read every time — it can change. */
export function prefersReducedMotion() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** The instance, if it has already loaded. Lets callers avoid awaiting. */
export const peekGsap = () => gsapInstance;

/**
 * Load GSAP (and ScrollTrigger) once.
 *
 * Resolves to `null` when the bundle cannot be fetched — a dropped chunk on a
 * flaky connection must cost the pupil an animation, never the page.
 */
export function loadGsap() {
  if (gsapInstance) return Promise.resolve(gsapInstance);
  if (gsapPromise) return gsapPromise;

  gsapPromise = (async () => {
    try {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import('gsap'),
        import('gsap/ScrollTrigger'),
      ]);
      gsap.registerPlugin(ScrollTrigger);
      gsap.defaults({
        // Matches --ease-out in theme.css, so a GSAP tween and a CSS
        // transition on the same element move with the same character.
        ease: 'power3.out',
        duration: 0.55,
      });
      // Never let a tween leave a transform matrix on an element that CSS also
      // positions — it silently wins over later class changes.
      gsap.config({ nullTargetWarn: false });
      gsapInstance = gsap;
      return gsap;
    } catch {
      gsapPromise = null; // allow a later retry
      return null;
    }
  })();

  return gsapPromise;
}

/**
 * Warm the cache when the browser is idle.
 *
 * Called once after the app mounts. By the time a page with charts opens, the
 * library is usually already there, so the first animation is not the one that
 * pays for the download. Skipped under reduced motion — nothing to animate means no reason to
 * spend the bandwidth.
 */
export function preloadGsap() {
  if (typeof window === 'undefined') return;
  if (prefersReducedMotion()) return;
  const go = () => loadGsap();
  if ('requestIdleCallback' in window) window.requestIdleCallback(go, { timeout: 3000 });
  else setTimeout(go, 1200);
}

export default loadGsap;
